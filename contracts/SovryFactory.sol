// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {SovryPool} from "./SovryPool.sol";

contract SovryFactory is AccessControl {
    bytes32 public constant FEE_TO_SETTER_ROLE = keccak256("FEE_TO_SETTER_ROLE");
    bytes32 public constant PAIR_CREATOR_ROLE = keccak256("PAIR_CREATOR_ROLE");

    address public immutable WIP;
    bytes32 public immutable INIT_CODE_PAIR_HASH;

    address public feeTo;
    address public feeToSetter;

    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    // 🛡️ SECURITY: Rate limiting for pair creation
    mapping(address => uint256) public lastPairCreation;
    uint256 public constant PAIR_CREATION_COOLDOWN = 1 minutes;

    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 length);
    event FeeToUpdated(address indexed newFeeTo);
    event FeeToSetterUpdated(address indexed previousSetter, address indexed newSetter);

    error IdenticalAddresses();
    error ZeroAddress();
    error PairExists();
    error PairCreationFailed();
    error CooldownNotPassed();

    constructor(address wip, address admin, address initialFeeToSetter, address initialFeeTo) {
        if (wip == address(0) || admin == address(0) || initialFeeToSetter == address(0)) revert ZeroAddress();
        WIP = wip;
        INIT_CODE_PAIR_HASH = keccak256(type(SovryPool).creationCode);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAIR_CREATOR_ROLE, admin); // Admin can create pairs

        feeToSetter = initialFeeToSetter;
        _grantRole(FEE_TO_SETTER_ROLE, initialFeeToSetter);
        emit FeeToSetterUpdated(address(0), initialFeeToSetter);

        feeTo = initialFeeTo;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function setFeeTo(address newFeeTo) public onlyRole(FEE_TO_SETTER_ROLE) {
        feeTo = newFeeTo;
        emit FeeToUpdated(newFeeTo);
    }

    function setFeeToSetter(address newSetter) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newSetter == address(0)) revert ZeroAddress();
        address previousSetter = feeToSetter;
        if (previousSetter != address(0)) {
            _revokeRole(FEE_TO_SETTER_ROLE, previousSetter);
        }
        feeToSetter = newSetter;
        _grantRole(FEE_TO_SETTER_ROLE, newSetter);
        emit FeeToSetterUpdated(previousSetter, newSetter);
    }

    function createPair(address tokenA, address tokenB) external onlyRole(PAIR_CREATOR_ROLE) returns (address pair) {
        // 🛡️ SECURITY: Rate limiting
        require(block.timestamp >= lastPairCreation[msg.sender] + PAIR_CREATION_COOLDOWN, "CooldownNotPassed()");
        lastPairCreation[msg.sender] = block.timestamp;

        // 🛡️ SECURITY: Input validation
        if (tokenA == tokenB) revert IdenticalAddresses();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        require(tokenA == WIP || tokenB == WIP, "Sovry: Pair must include WIP");

        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (getPair[token0][token1] != address(0)) revert PairExists();

        // 🛡️ SECURITY: Safe pair creation
        bytes memory bytecode = type(SovryPool).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        
        assembly {
            pair := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (pair == address(0)) revert PairCreationFailed();

        // 🛡️ SECURITY: Initialize pool after creation
        SovryPool(pair).initialize(token0, token1);

        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
