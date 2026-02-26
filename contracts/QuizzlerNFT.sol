// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./QstnNFT.sol";

/// @title A Quizzler contract for creating and managing surveys with NFT rewards
/// @notice This contract allows for the creation, funding, and management of surveys and their NFT rewards
contract QuizzlerNFT is Initializable, ReentrancyGuardUpgradeable, OwnableUpgradeable {
    /// @notice Address used as gas station for the server's manager wallet
    address public gasStation;

    /// @notice Address used as owner for the gas station account
    address public gasOwner;

    /// @notice Tracks manager permissions for addresses
    mapping(address => bool) public managers;
    /// @notice Stores survey data by survey ID
    mapping(string => SurveyStruct) public surveys;
    /// @notice Users rewarded for participating in surveys
    mapping(string => mapping(address => bool)) public surveysUsersRewarded;
    /// @notice Records used proof tokens to prevent reuse
    mapping(bytes32 => bool) public proofTokens;

    /// @notice Structure to store survey information
    struct SurveyStruct {
        address surveyCreator;
        address nftContract;
        uint256 participantsLimit;
        uint256 participantsRewarded;
        bytes32 surveyHash;
        bool isCanceled;
    }

    /// @notice Structure to store survey creation parameters
    struct SurveyCreationParams {
        bytes32 token;
        uint256 timeToExpire;
        address owner;
        string surveyId;
        string name;
        string symbol;
        string baseTokenURI;
        uint256 participantsLimit;
        bytes32 surveyHash;
        uint256 amountToGasStation;
    }

    /// @notice Emitted when a survey is created
    event SurveyCreated(
        string indexed surveyId,
        address indexed creator,
        address indexed nft,
        uint256 participantsLimit,
        bytes32 surveyHash
    );
    /// @notice Emitted when a survey is funded
    event SurveyFunded(string indexed surveyId, address indexed creator, uint256 fundingAmount);
    /// @notice Emitted when a reward is paid to a participant
    event RewardPaid(address indexed participant, string indexed surveyId);
    /// @notice Emitted when a survey is finished
    event SurveyFinished(string indexed surveyId);
    /// @notice Emitted when a survey is canceled
    event SurveyCanceled(string indexed surveyId);
    /// @notice Emitted when a manager's status is updated
    event UpdateManager(address indexed manager, bool status);

    /// @notice Ensures only managers can call a function
    modifier onlyManager() {
        require(managers[msg.sender], "Quizzler: only manager or owner can call this function");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Fallback function that reverts any Ether sent to the contract
    receive() external payable {
        revert("Quizzler: Uncaught receive error");
    }

    /// @notice Initializes the contract setting up initial roles and states
    fallback() external payable {
        revert("Quizzler: Uncaught fallback error");
    }

    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        managers[msg.sender] = true;
    }

    /// @notice Sets or unsets an address as a manager
    /// @param _manager Address of the manager
    /// @param _status Boolean representing the desired manager status
    function setManager(address _manager, bool _status) external onlyOwner {
        require(_manager != address(0), "PrivateStaking: invalid manager address");

        managers[_manager] = _status;

        emit UpdateManager(_manager, _status);
    }

    /// @notice Allows the owner to specify the gas station address
    /// @param _gasStation Address of the gas station
    /// @param _gasOwner Address of the gas station owner
    function setGasStation(address _gasStation, address _gasOwner) external onlyOwner {
        require(_gasStation != address(0), "PrivateStaking: invalid gas station address");
        require(_gasOwner != address(0), "PrivateStaking: invalid gas owner address");

        gasStation = _gasStation;
        gasOwner = _gasOwner;
    }

    /// @notice Returns detailed information about a survey
    /// @param _surveyId The unique identifier of the survey
    /// @return surveyCreator The creator of the survey
    /// @return nftContract The address of the NFT contract for the survey
    /// @return participantsLimit The maximum number of participants allowed
    /// @return participantsRewarded The number of participants already rewarded
    /// @return surveyHash The unique hash of the survey for verification
    /// @return isCanceled Whether the survey has been canceled
    function getSurvey(string memory _surveyId)
        external
        view
        returns (
            address surveyCreator,
            address nftContract,
            uint256 participantsLimit,
            uint256 participantsRewarded,
            bytes32 surveyHash,
            bool isCanceled
        )
    {
        surveyCreator = surveys[_surveyId].surveyCreator;
        nftContract = surveys[_surveyId].nftContract;
        participantsLimit = surveys[_surveyId].participantsLimit;
        participantsRewarded = surveys[_surveyId].participantsRewarded;
        surveyHash = surveys[_surveyId].surveyHash;
        isCanceled = surveys[_surveyId].isCanceled;
    }

    /// @notice Create a new survey
    /// @param _surveyId The unique identifier for the new survey
    /// @param _name The name of the new survey
    /// @param _symbol The symbol of the new survey
    /// @param _baseTokenURI The base URI for the new survey
    /// @param _participantsLimit The max number of participants allowed
    /// @param _surveyHash A unique hash representing the survey
    /// @dev Emits a SurveyCreated event upon successful creation
    function _createSurvey(
        string memory _surveyId,
        string memory _name,
        string memory _symbol,
        string memory _baseTokenURI,
        uint256 _participantsLimit,
        bytes32 _surveyHash
    ) internal returns (bool result) {
        require(surveys[_surveyId].surveyCreator == address(0), "Quizzler: survey already exists");

        QstnNFT newNFT = new QstnNFT(_name, _symbol, _baseTokenURI);

        surveys[_surveyId] = SurveyStruct({
            surveyCreator: msg.sender,
            nftContract: address(newNFT),
            participantsLimit: _participantsLimit,
            participantsRewarded: 0,
            surveyHash: _surveyHash,
            isCanceled: false
        });

        emit SurveyCreated(_surveyId, msg.sender, address(newNFT), _participantsLimit, _surveyHash);

        return true;
    }

    /// @notice Generates a proof for survey creating
    function createProof(SurveyCreationParams memory params) public view returns (bytes32 message) {
        if (proofTokens[params.token]) {
            message = bytes32(0);
        } else {
            message = keccak256(
                abi.encodePacked(
                    getChainID(),
                    params.token,
                    params.timeToExpire,
                    params.owner,
                    params.surveyId,
                    params.name,
                    params.symbol,
                    params.baseTokenURI,
                    params.participantsLimit,
                    params.surveyHash,
                    params.amountToGasStation
                )
            );
        }
    }

    /// @notice Funds a survey verifying all conditions are met
    function createSurvey(bytes memory _signature, SurveyCreationParams memory params) external payable nonReentrant {
        require(msg.sender == params.owner, "Quizzler: only survey creator can fund the survey");
        bytes32 message = createProof(params);

        address signer = preAuthValidations(message, params.token, params.timeToExpire, _signature);

        require(
            _createSurvey(
                params.surveyId,
                params.name,
                params.symbol,
                params.baseTokenURI,
                params.participantsLimit,
                params.surveyHash
            ),
            "Quizzler: survey creation failed"
        );

        require(managers[signer], "Quizzler: invalid signer");
        require(msg.value == params.amountToGasStation, "Quizzler: invalid trx value");

        (bool success,) = payable(gasStation).call{value: params.amountToGasStation}("");
        require(success, "Transfer failed");

        emit SurveyFunded(params.surveyId, msg.sender, msg.value);
    }

    /// @notice Generates a proof for survey cancellation
    function cancelProof(bytes32 _token, uint256 _timeToExpire, string memory _surveyId)
        public
        view
        returns (bytes32 message)
    {
        if (proofTokens[_token]) {
            message = bytes32(0);
        } else {
            message = keccak256(abi.encodePacked(getChainID(), _token, _timeToExpire, _surveyId));
        }
    }

    /// @notice Cancels a survey and refunds the unspent funds
    function cancelSurvey(bytes memory _signature, bytes32 _token, uint256 _timeToExpire, string memory _surveyId)
        external
        nonReentrant
    {
        require(surveys[_surveyId].surveyCreator != address(0), "Quizzler: survey does not exist");
        require(!surveys[_surveyId].isCanceled, "Quizzler: survey is already canceled");
        require(
            msg.sender == surveys[_surveyId].surveyCreator || managers[msg.sender],
            "Quizzler: only survey creator or manager can cancel the survey"
        );
        require(
            surveys[_surveyId].participantsLimit > surveys[_surveyId].participantsRewarded,
            "Quizzler: all participants have been rewarded"
        );

        bytes32 message = cancelProof(_token, _timeToExpire, _surveyId);

        address signer = preAuthValidations(message, _token, _timeToExpire, _signature);

        require(managers[signer], "Quizzler: invalid signer");

        surveys[_surveyId].isCanceled = true;

        emit SurveyCanceled(_surveyId);
    }

    /// @notice Generates a proof for rewarding
    function rewardProof(
        bytes32 _token,
        uint256 _timeToExpire,
        string[] memory _surveyIds,
        address[] memory _participantsEncoded
    ) public view returns (bytes32 message) {
        if (proofTokens[_token]) {
            message = bytes32(0);
        } else {
            message = keccak256(
                abi.encodePacked(getChainID(), _token, _timeToExpire, _surveyIds.length, _participantsEncoded.length)
            );
        }
    }

    /// @notice Distributes rewards to survey participants
    function payRewards(
        bytes memory _signature,
        bytes32 _token,
        uint256 _timeToExpire,
        string[] memory _surveyIds,
        address[] memory _participantsEncoded
    ) external nonReentrant {
        require(
            _surveyIds.length == _participantsEncoded.length,
            "Quizzler: Mismatch between survey IDs and participant data lengths"
        );

        bytes32 message = rewardProof(_token, _timeToExpire, _surveyIds, _participantsEncoded);

        address signer = preAuthValidations(message, _token, _timeToExpire, _signature);

        require(managers[signer], "Quizzler: invalid signer");

        for (uint256 j = 0; j < _participantsEncoded.length; j++) {
            string memory surveyId = _surveyIds[j];
            require(!surveys[surveyId].isCanceled, "Quizzler: Survey has been canceled");
            require(
                surveys[surveyId].participantsRewarded < surveys[surveyId].participantsLimit,
                "Quizzler: All participants have been rewarded"
            );
            require(
                !surveysUsersRewarded[surveyId][_participantsEncoded[j]], "Quizzler: User has already been rewarded"
            );

            QstnNFT(surveys[surveyId].nftContract).mint(_participantsEncoded[j]);

            surveys[surveyId].participantsRewarded++;
            surveysUsersRewarded[surveyId][_participantsEncoded[j]] = true;

            emit RewardPaid(_participantsEncoded[j], surveyId);

            if (surveys[surveyId].participantsRewarded == surveys[surveyId].participantsLimit) {
                emit SurveyFinished(surveyId);
            }
        }
    }

    /// @notice Validates the message and signature
    /// @param _message The message that the user signed
    /// @param _token The unique token for each delegated function
    /// @param _timeToExpire The time to expire the token
    /// @param _signature Signature
    /// @return address Signer of the message
    function preAuthValidations(bytes32 _message, bytes32 _token, uint256 _timeToExpire, bytes memory _signature)
        public
        returns (address)
    {
        require(_message != bytes32(0), "Quizzler: invalid message hash");
        require(!proofTokens[_token], "Quizzler: proof token has already been used");
        require(block.timestamp <= _timeToExpire, "Quizzler: proof token has expired");

        address signer = getSigner(_message, _signature);
        require(signer != address(0), "Access: Zero address not allowed");

        proofTokens[_token] = true;

        return signer;
    }

    /// @notice Find the signer
    /// @param message The message that the user signed
    /// @param signature Signature
    /// @return address Signer of the message
    function getSigner(bytes32 message, bytes memory signature) public pure returns (address) {
        message = MessageHashUtils.toEthSignedMessageHash(message);
        address signer = ECDSA.recover(message, signature);
        return signer;
    }

    /// @notice Get the ID of the executing chain
    /// @return uint256 value
    function getChainID() public view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
