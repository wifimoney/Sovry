// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MockERC20.sol";

/// @notice Mock ERC20 with 6 decimals to simulate RT (royalty token)
contract MockERC20_6 is MockERC20 {
    constructor(string memory name, string memory symbol) MockERC20(name, symbol) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
