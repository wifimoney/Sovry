// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IWIP} from "./interfaces/IWIP.sol";

interface ISovryFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);

    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface ISovryPool is IERC20 {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

    function mint(address to) external returns (uint256 liquidity);

    function burn(address to) external returns (uint256 amount0, uint256 amount1);

    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

contract SovryRouter {
    using SafeERC20 for IERC20;

    address public immutable factory;
    address public immutable WIP;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "SovryRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _WIP) {
        require(_factory != address(0) && _WIP != address(0), "SovryRouter: ZERO_ADDRESS");
        factory = _factory;
        WIP = _WIP;
    }

    receive() external payable {
        require(msg.sender == WIP, "SovryRouter: ONLY_WIP");
    }

    struct LiquidityAmounts {
        uint256 amountA;
        uint256 amountB;
        uint256 liquidity;
    }

    // ---------------------------------------------------------------------
    // Liquidity
    // ---------------------------------------------------------------------

    function addLiquidityIP(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountIPMin,
        address to,
        uint256 deadline
    )
        external
        payable
        ensure(deadline)
        returns (uint256 amountToken, uint256 amountIP, uint256 liquidity)
    {
        require(token != WIP, "SovryRouter: INVALID_TOKEN");
        (amountToken, amountIP) = _addLiquidity(token, WIP, amountTokenDesired, msg.value, amountTokenMin, amountIPMin);

        address pair = pairFor(token, WIP);
        IERC20(token).safeTransferFrom(msg.sender, pair, amountToken);
        IWIP(WIP).deposit{value: amountIP}();
        IWIP(WIP).transfer(pair, amountIP);
        liquidity = ISovryPool(pair).mint(to);

        if (msg.value > amountIP) {
            _safeTransferIP(msg.sender, msg.value - amountIP);
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = pairFor(tokenA, tokenB);
        ISovryPool(pair).transferFrom(msg.sender, pair, liquidity);
        (amountA, amountB) = ISovryPool(pair).burn(to);
        require(amountA >= amountAMin, "SovryRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "SovryRouter: INSUFFICIENT_B_AMOUNT");
    }

    // ---------------------------------------------------------------------
    // Swaps
    // ---------------------------------------------------------------------

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        require(path.length >= 2, "SovryRouter: INVALID_PATH");
        IERC20(path[0]).safeTransferFrom(msg.sender, pairFor(path[0], path[1]), amountIn);
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        uint256 balanceAfter = IERC20(path[path.length - 1]).balanceOf(to);
        require(balanceAfter - balanceBefore >= amountOutMin, "SovryRouter: INSUFFICIENT_OUTPUT");
    }

    function swapExactIPForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path.length >= 2 && path[0] == WIP, "SovryRouter: INVALID_PATH");
        amounts = getAmountsOut(msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "SovryRouter: INSUFFICIENT_OUTPUT_AMOUNT");

        IWIP(WIP).deposit{value: amounts[0]}();
        IWIP(WIP).transfer(pairFor(path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapTokensForExactIP(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(path.length >= 2 && path[path.length - 1] == WIP, "SovryRouter: INVALID_PATH");
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "SovryRouter: EXCESSIVE_INPUT_AMOUNT");

        IERC20(path[0]).safeTransferFrom(msg.sender, pairFor(path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWIP(WIP).withdraw(amounts[amounts.length - 1]);
        _safeTransferIP(to, amounts[amounts.length - 1]);
    }

    // ---------------------------------------------------------------------
    // Internal liquidity math
    // ---------------------------------------------------------------------

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (ISovryFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            ISovryFactory(factory).createPair(tokenA, tokenB);
        }

        (uint256 reserveA, uint256 reserveB) = _getReserves(tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            amountA = amountADesired;
            amountB = amountBDesired;
        } else {
            uint256 amountBOptimal = quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "SovryRouter: INSUFFICIENT_B_AMOUNT");
                amountA = amountADesired;
                amountB = amountBOptimal;
            } else {
                uint256 amountAOptimal = quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal >= amountAMin, "SovryRouter: INSUFFICIENT_A_AMOUNT");
                amountA = amountAOptimal;
                amountB = amountBDesired;
            }
        }
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function quote(uint256 amountA, uint256 reserveA, uint256 reserveB) public pure returns (uint256 amountB) {
        require(amountA > 0, "SovryRouter: INSUFFICIENT_AMOUNT");
        require(reserveA > 0 && reserveB > 0, "SovryRouter: INSUFFICIENT_LIQUIDITY");
        amountB = (amountA * reserveB) / reserveA;
    }

    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "SovryRouter: INSUFFICIENT_INPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SovryRouter: INSUFFICIENT_LIQUIDITY");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    function getAmountIn(uint256 amountOut, uint256 reserveIn, uint256 reserveOut) public pure returns (uint256 amountIn) {
        require(amountOut > 0, "SovryRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        require(reserveIn > 0 && reserveOut > 0, "SovryRouter: INSUFFICIENT_LIQUIDITY");
        uint256 numerator = reserveIn * amountOut * 1000;
        uint256 denominator = (reserveOut - amountOut) * 997;
        amountIn = (numerator / denominator) + 1;
    }

    function getAmountsOut(uint256 amountIn, address[] calldata path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "SovryRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 i; i < path.length - 1; i++) {
            (uint256 reserveIn, uint256 reserveOut) = _getReserves(path[i], path[i + 1]);
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }

    function getAmountsIn(uint256 amountOut, address[] calldata path) public view returns (uint256[] memory amounts) {
        require(path.length >= 2, "SovryRouter: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        for (uint256 i = path.length - 1; i > 0; i--) {
            (uint256 reserveIn, uint256 reserveOut) = _getReserves(path[i - 1], path[i]);
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }

    function pairFor(address tokenA, address tokenB) public view returns (address pair) {
        pair = ISovryFactory(factory).getPair(tokenA, tokenB);
        require(pair != address(0), "SovryRouter: PAIR_NOT_FOUND");
    }

    function _swap(uint256[] memory amounts, address[] calldata path, address finalRecipient) internal {
        for (uint256 i; i < path.length - 1; i++) {
            address recipient = i < path.length - 2 ? pairFor(path[i + 1], path[i + 2]) : finalRecipient;
            _swapExactOut(amounts[i + 1], path[i], path[i + 1], recipient);
        }
    }

    function _swapSupportingFeeOnTransferTokens(address[] calldata path, address finalRecipient) internal {
        for (uint256 i; i < path.length - 1; i++) {
            address recipient = i < path.length - 2 ? pairFor(path[i + 1], path[i + 2]) : finalRecipient;
            _swapSupportingFeeStep(path[i], path[i + 1], recipient);
        }
    }

    function _swapExactOut(uint256 amountOut, address input, address output, address recipient) private {
        (address token0,) = _sortTokens(input, output);
        (uint256 amount0Out, uint256 amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
        ISovryPool(pairFor(input, output)).swap(amount0Out, amount1Out, recipient, new bytes(0));
    }

    function _swapSupportingFeeStep(address input, address output, address recipient) private {
        (address token0,) = _sortTokens(input, output);
        ISovryPool pair = ISovryPool(pairFor(input, output));
        (uint112 reserve0, uint112 reserve1,) = pair.getReserves();
        (uint256 reserveInput, uint256 reserveOutput) = input == token0
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));
        uint256 balanceInput = IERC20(input).balanceOf(address(pair));
        uint256 amountInput = balanceInput - reserveInput;
        uint256 amountOutput = getAmountOut(amountInput, reserveInput, reserveOutput);
        (uint256 amount0Out, uint256 amount1Out) = input == token0
            ? (uint256(0), amountOutput)
            : (amountOutput, uint256(0));
        pair.swap(amount0Out, amount1Out, recipient, new bytes(0));
    }

    function _getReserves(address tokenA, address tokenB) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0,) = _sortTokens(tokenA, tokenB);
        (uint112 reserve0, uint112 reserve1,) = ISovryPool(pairFor(tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    function _sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "SovryRouter: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "SovryRouter: ZERO_ADDRESS");
    }

    function _safeTransferIP(address to, uint256 value) internal {
        (bool success,) = to.call{value: value}("");
        require(success, "SovryRouter: IP_TRANSFER_FAILED");
    }
}
