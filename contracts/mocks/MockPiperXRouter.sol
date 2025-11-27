// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPiperXRouter {
    // State to record the last addLiquidityETH call for assertions in tests
    address public lastToken;
    uint256 public lastAmountTokenDesired;
    uint256 public lastAmountETH;
    address public lastTo;

    event AddLiquidityETHCalled(address token, uint256 amountTokenDesired, uint256 amountETH, address to);

    event SwapExactETHForTokensCalled(uint256 amountOutMin, address[] path, address to, uint256 amountIn);

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        // Record call data for testing
        lastToken = token;
        lastAmountTokenDesired = amountTokenDesired;
        lastAmountETH = msg.value;
        lastTo = to;

        emit AddLiquidityETHCalled(token, amountTokenDesired, msg.value, to);

        // Simulate success
        return (amountTokenDesired, msg.value, 1000);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts) {
        emit SwapExactETHForTokensCalled(amountOutMin, path, to, msg.value);

        amounts = new uint256[](2);
        amounts[0] = msg.value;
        amounts[1] = amountOutMin;
        return amounts;
    }
}
