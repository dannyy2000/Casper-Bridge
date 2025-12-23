// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title CasperBridgeWrapper
 * @dev Wrapped CSPR (wCSPR) token on Ethereum with bridge functionality
 *
 * This contract mints wCSPR when CSPR is locked on Casper Network,
 * and burns wCSPR to initiate unlock on Casper Network.
 */
contract CasperBridgeWrapper is ERC20, Ownable, ReentrancyGuard, Pausable {

    // Events
    event AssetMinted(
        address indexed user,
        uint256 amount,
        string sourceChain,
        string sourceTxHash,
        uint256 indexed nonce
    );

    event AssetBurned(
        address indexed user,
        uint256 amount,
        string destinationChain,
        string destinationAddress,
        uint256 indexed nonce
    );

    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);
    event RequiredSignaturesUpdated(uint256 newRequirement);

    // State variables
    mapping(address => bool) public validators;
    mapping(uint256 => bool) public processedNonces;

    uint256 public requiredSignatures;
    uint256 public nonce;
    uint256 public totalBridged;
    uint256 public minBurnAmount;

    address[] public validatorList;

    // Structs
    struct MintProof {
        string sourceChain;
        string sourceTxHash;
        uint256 amount;
        address recipient;
        uint256 nonce;
        bytes[] validatorSignatures;
    }

    /**
     * @dev Constructor
     * @param _requiredSignatures Number of validator signatures required
     * @param _minBurnAmount Minimum amount that can be burned (to prevent spam)
     */
    constructor(
        uint256 _requiredSignatures,
        uint256 _minBurnAmount
    ) ERC20("Wrapped Casper", "wCSPR") Ownable(msg.sender) {
        require(_requiredSignatures > 0, "Invalid signature requirement");

        requiredSignatures = _requiredSignatures;
        minBurnAmount = _minBurnAmount;

        // Owner is first validator
        validators[msg.sender] = true;
        validatorList.push(msg.sender);
        emit ValidatorAdded(msg.sender);
    }

    /**
     * @dev Create message hash for validator signatures
     * @notice This hash ensures all validators sign the same data
     * @param proof The mint proof containing transaction details
     * @return bytes32 The message hash that validators must sign
     */
    function _getMessageHash(MintProof calldata proof) private pure returns (bytes32) {
        // Create deterministic hash from proof data
        // All validators must sign THIS EXACT message
        return keccak256(abi.encodePacked(
            proof.sourceChain,      // "casper"
            proof.sourceTxHash,     // Transaction hash on Casper
            proof.amount,           // Amount being bridged
            proof.recipient,        // Who receives the tokens
            proof.nonce            // Unique nonce to prevent replays
        ));
    }

    /**
     * @dev Verify validator signatures on a proof
     * @notice Checks that enough valid validators signed the message
     * @param proof The proof with signatures to verify
     * @return bool True if proof has sufficient valid signatures
     */
    function _verifySignatures(MintProof calldata proof) private view returns (bool) {
        bytes32 messageHash = _getMessageHash(proof);
        // Convert to Ethereum signed message hash (adds prefix)
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        uint256 validSignatures = 0;

        // Track which validators have signed to prevent duplicate counting
        // Using dynamic array in memory to store signers we've seen
        address[] memory seenSigners = new address[](proof.validatorSignatures.length);
        uint256 seenCount = 0;

        for (uint256 i = 0; i < proof.validatorSignatures.length; i++) {
            // Recover the signer's address from the signature
            address signer = ECDSA.recover(ethSignedMessageHash, proof.validatorSignatures[i]);

            // Check if this signer is a registered validator
            if (!validators[signer]) {
                continue; // Skip invalid validators
            }

            // Check if we've already counted this validator
            bool isDuplicate = false;
            for (uint256 j = 0; j < seenCount; j++) {
                if (seenSigners[j] == signer) {
                    isDuplicate = true;
                    break;
                }
            }

            // Only count if not a duplicate
            if (!isDuplicate) {
                seenSigners[seenCount] = signer;
                seenCount++;
                validSignatures++;
            }
        }

        // Require at least M-of-N validators signed
        return validSignatures >= requiredSignatures;
    }

    /**
     * @dev Mint wCSPR when CSPR is locked on Casper
     * @param proof Proof of lock event from Casper Network
     */
    function mint(MintProof calldata proof)
        external
        nonReentrant
        whenNotPaused
    {
        // Verify nonce hasn't been processed (prevents replay attacks)
        require(!processedNonces[proof.nonce], "Proof already processed");

        // Verify sufficient validator signatures
        require(
            proof.validatorSignatures.length >= requiredSignatures,
            "Insufficient validator signatures"
        );

        // CRITICAL SECURITY: Verify cryptographic signatures
        // This ensures the proof is authentic and signed by real validators
        require(_verifySignatures(proof), "Invalid validator signatures");

        // Mark nonce as processed
        processedNonces[proof.nonce] = true;

        // Update total bridged
        totalBridged += proof.amount;

        // Mint tokens to recipient
        _mint(proof.recipient, proof.amount);

        emit AssetMinted(
            proof.recipient,
            proof.amount,
            proof.sourceChain,
            proof.sourceTxHash,
            proof.nonce
        );
    }

    /**
     * @dev Burn wCSPR to unlock CSPR on Casper Network
     * @param amount Amount to burn
     * @param destinationChain Target chain (should be "casper")
     * @param destinationAddress Casper address to receive unlocked CSPR
     */
    function burn(
        uint256 amount,
        string calldata destinationChain,
        string calldata destinationAddress
    )
        external
        nonReentrant
        whenNotPaused
    {
        require(amount >= minBurnAmount, "Amount below minimum");
        require(bytes(destinationAddress).length > 0, "Invalid destination");

        // Burn tokens
        _burn(msg.sender, amount);

        // Update state
        totalBridged -= amount;
        uint256 currentNonce = nonce;
        nonce++;

        emit AssetBurned(
            msg.sender,
            amount,
            destinationChain,
            destinationAddress,
            currentNonce
        );
    }

    /**
     * @dev Add a new validator (owner only)
     * @param validator Address to add as validator
     */
    function addValidator(address validator) external onlyOwner {
        require(validator != address(0), "Invalid validator address");
        require(!validators[validator], "Already a validator");

        validators[validator] = true;
        validatorList.push(validator);

        emit ValidatorAdded(validator);
    }

    /**
     * @dev Remove a validator (owner only)
     * @param validator Address to remove
     */
    function removeValidator(address validator) external onlyOwner {
        require(validators[validator], "Not a validator");

        validators[validator] = false;

        // Remove from list
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validatorList[i] == validator) {
                validatorList[i] = validatorList[validatorList.length - 1];
                validatorList.pop();
                break;
            }
        }

        emit ValidatorRemoved(validator);
    }

    /**
     * @dev Update required signatures (owner only)
     * @param _requiredSignatures New requirement
     */
    function setRequiredSignatures(uint256 _requiredSignatures)
        external
        onlyOwner
    {
        require(_requiredSignatures > 0, "Must require at least 1 signature");
        require(
            _requiredSignatures <= validatorList.length,
            "Requirement exceeds validator count"
        );

        requiredSignatures = _requiredSignatures;
        emit RequiredSignaturesUpdated(_requiredSignatures);
    }

    /**
     * @dev Update minimum burn amount (owner only)
     * @param _minBurnAmount New minimum
     */
    function setMinBurnAmount(uint256 _minBurnAmount) external onlyOwner {
        minBurnAmount = _minBurnAmount;
    }

    /**
     * @dev Pause contract (owner only, emergency use)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract (owner only)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get all validators
     * @return Array of validator addresses
     */
    function getValidators() external view returns (address[] memory) {
        return validatorList;
    }

    /**
     * @dev Check if nonce was processed
     * @param _nonce Nonce to check
     * @return bool Whether nonce was processed
     */
    function isNonceProcessed(uint256 _nonce) external view returns (bool) {
        return processedNonces[_nonce];
    }

    /**
     * @dev Get contract info
     * @return contractNonce Current nonce
     * @return bridgedAmount Total amount bridged
     * @return validatorCount Number of validators
     */
    function getInfo()
        external
        view
        returns (
            uint256 contractNonce,
            uint256 bridgedAmount,
            uint256 validatorCount
        )
    {
        return (nonce, totalBridged, validatorList.length);
    }
}
