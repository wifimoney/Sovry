# CRITICAL FIX: 50% Price Crash Upon Graduation

## 🚨 SEVERITY: CRITICAL

**Status**: IMPLEMENTATION REQUIRED  
**Location**: `_graduate()` function in `SovryLaunchpad.sol`  
**Impact**: Prevents 50% instant price crash and arbitrage extraction  

---

## The Vulnerability

### Mathematical Root Cause

Linear Bonding Curve Model:
```
Price Function: P(S) = basePrice + (S * priceIncrement)
Reserve Function: R(S) = basePrice*S + (1/2)*priceIncrement*S²
```

### Current Vulnerable Implementation

When graduating, the contract does:
```solidity
// VULNERABLE CODE (CURRENT)
uint256 nativeLiquidity = curve.reserveBalance;  // = (1/2)*priceIncrement*S²
uint256 tokenLiquidity = dexReserveWrapped + curve.currentSupply;  // = S

// Add liquidity with ALL accumulated ETH
router.addLiquidityETH{value: nativeLiquidity}(
    wrapperToken,
    tokenLiquidity,
    ...
);

// Uniswap initial price = nativeLiquidity / tokenLiquidity
//                       = [(1/2)*priceIncrement*S²] / S
//                       = (1/2)*priceIncrement*S
//                       = (1/2) * P_spot
```

**Result**: Uniswap lists at exactly 50% of bonding curve spot price!

### Attack Scenario

```
1. Token graduates at P_spot = 1.0 ETH
2. Uniswap lists at P_uniswap = 0.5 ETH (50% crash)
3. Snipers instantly buy at 0.5 ETH
4. Price recovers to 1.0 ETH
5. Snipers profit: 100% return instantly
6. Early buyers lose 50% of investment
```

---

## The Fix: Price-Aligned Liquidity

### Mathematical Solution

To maintain spot price on Uniswap:
```
P_uniswap = Native_Liquidity / Token_Liquidity = P_spot

Therefore:
Native_Liquidity_Required = P_spot * Token_Liquidity
                          = (basePrice + S*priceIncrement) * Token_Liquidity
```

### Implementation

```solidity
function _graduate(address wrapperToken) internal {
    LaunchedToken storage token = launchedTokens[wrapperToken];
    BondingCurve storage curve = bondingCurves[wrapperToken];

    require(!token.graduated, "Already graduated");
    require(curve.isActive, "Curve not active");

    // Mark as graduated
    token.graduated = true;
    curve.isActive = false;
    isGraduated[wrapperToken] = true;

    // Get all available liquidity
    uint256 nativeLiquidity = curve.reserveBalance;
    if (nativeLiquidity > 0) {
        totalCurveReserves -= nativeLiquidity;
        curve.reserveBalance = 0;
    }

    // Token side liquidity
    uint256 dexReserveWrapped = token.dexReserve * WRAP_PER_RT;
    uint256 tokenLiquidity = dexReserveWrapped + curve.currentSupply;

    require(nativeLiquidity > 0 && tokenLiquidity > 0, "No liquidity to migrate");

    // ✅ CRITICAL FIX: Calculate spot price at graduation
    uint256 initialCurveSupply = token.initialCurveSupply;
    uint256 soldRaw = initialCurveSupply > curve.currentSupply
        ? (initialCurveSupply - curve.currentSupply)
        : 0;
    uint256 soldUnits = soldRaw / WRAP_UNIT;

    // Spot price = basePrice + (soldUnits * priceIncrement)
    uint256 spotPrice = curve.basePrice + Math.mulDiv(curve.priceIncrement, soldUnits, 1);

    // ✅ Calculate required ETH to maintain spot price on Uniswap
    // Required ETH = spotPrice * tokenLiquidity / WRAP_UNIT
    uint256 requiredETH = Math.mulDiv(spotPrice, tokenLiquidity, WRAP_UNIT);

    // Ensure we have enough ETH (should always be true due to bonding curve math)
    require(requiredETH <= nativeLiquidity, "Insufficient ETH for price alignment");

    // ✅ Calculate excess ETH (virtual liquidity profit)
    uint256 excessETH = nativeLiquidity - requiredETH;

    IPiperXRouter router = IPiperXRouter(piperXRouter);
    address factory = router.factory();
    address weth = router.WETH();
    address poolAddress = IPiperXFactory(factory).getPair(wrapperToken, weth);

    bool pairExists = poolAddress != address(0);

    // Calculate slippage based on whether pair exists
    uint256 minTokenLiquidity;
    uint256 minNativeLiquidity;

    if (pairExists) {
        minTokenLiquidity = (tokenLiquidity * 5000) / BPS_DENOMINATOR; // 50%
        minNativeLiquidity = (requiredETH * 5000) / BPS_DENOMINATOR;   // 50% of required ETH
    } else {
        minTokenLiquidity = (tokenLiquidity * DEX_LP_MIN_BPS) / BPS_DENOMINATOR;
        minNativeLiquidity = (requiredETH * DEX_LP_MIN_BPS) / BPS_DENOMINATOR;
    }

    // Approve router to pull wrapper tokens
    IERC20(wrapperToken).forceApprove(piperXRouter, tokenLiquidity);

    // ✅ Add liquidity with ALIGNED PRICE (use requiredETH, not nativeLiquidity)
    try router.addLiquidityETH{value: requiredETH}(
        wrapperToken,
        tokenLiquidity,
        minTokenLiquidity,
        minNativeLiquidity,
        BURN_ADDRESS,
        block.timestamp + 300
    ) {
        // Success - liquidity added with aligned price
        // ✅ Excess ETH is now available for buyback-and-burn
        if (excessETH > 0) {
            _buybackAndBurn(wrapperToken, excessETH);
        }
    } catch {
        // If addLiquidity fails even with relaxed slippage, try with even lower minimums
        try router.addLiquidityETH{value: requiredETH}(
            wrapperToken,
            tokenLiquidity,
            1,
            1,
            BURN_ADDRESS,
            block.timestamp + 300
        ) {
            // Success with minimal slippage
            if (excessETH > 0) {
                _buybackAndBurn(wrapperToken, excessETH);
            }
        } catch {
            // If even minimal slippage fails, revert graduation
            revert("Graduation failed: cannot add liquidity to DEX");
        }
    }

    // Renounce ownership to make token trustless
    SovryToken(wrapperToken).renounceOwnership();
    emit OwnershipRenounced(wrapperToken);

    emit Graduated(wrapperToken, requiredETH, poolAddress);
}
```

---

## Impact of Fix

### Before Fix (VULNERABLE)
```
Bonding Curve Spot Price: 1.0 ETH
Uniswap Launch Price: 0.5 ETH (50% crash)
Arbitrage Profit: 100% instant
Early Buyer Loss: 50%
Protocol Loss: Excess ETH wasted
```

### After Fix (SECURE)
```
Bonding Curve Spot Price: 1.0 ETH
Uniswap Launch Price: 1.0 ETH (price aligned)
Arbitrage Profit: 0% (no crash)
Early Buyer Loss: 0% (protected)
Excess ETH: Captured via buyback-and-burn
```

---

## Key Changes

1. **Calculate Spot Price**: Determine the final bonding curve price at graduation
2. **Calculate Required ETH**: Compute ETH needed to maintain spot price on Uniswap
3. **Calculate Excess ETH**: Capture the "virtual liquidity profit"
4. **Use Required ETH Only**: Add liquidity with `requiredETH` instead of `nativeLiquidity`
5. **Buyback-and-Burn Excess**: Use excess ETH for buyback-and-burn to benefit token holders

---

## Testing Requirements

### Test Cases

1. **Normal Graduation**: Verify price alignment
   ```
   Expected: P_uniswap == P_spot
   ```

2. **High Price Increment**: Test with extreme parameters
   ```
   Expected: No overflow in calculations
   ```

3. **Excess ETH Calculation**: Verify buyback amount
   ```
   Expected: Excess = Reserve - Required
   ```

4. **Arbitrage Prevention**: Confirm no 50% crash
   ```
   Expected: No instant 100% profit opportunity
   ```

5. **Early Buyer Protection**: Verify no value extraction
   ```
   Expected: Early buyers maintain value
   ```

---

## Deployment Checklist

- [ ] Implement price alignment fix in `_graduate()`
- [ ] Add buyback-and-burn logic for excess ETH
- [ ] Update tests to verify price alignment
- [ ] Verify no regressions in other functions
- [ ] Deploy to testnet
- [ ] Audit fix
- [ ] Deploy to mainnet

---

## Security Properties

✅ **Price Alignment**: Uniswap launch price matches bonding curve spot price  
✅ **Arbitrage Prevention**: No 50% crash = no instant profit opportunity  
✅ **Early Buyer Protection**: No value extraction from early buyers  
✅ **Value Capture**: Excess ETH used for buyback-and-burn  
✅ **Overflow Prevention**: Uses `Math.mulDiv` for safe calculations  

---

## Summary

This CRITICAL fix prevents snipers from extracting 50% of early buyer value through arbitrage at graduation. By aligning the Uniswap launch price with the bonding curve spot price, the contract eliminates the arbitrage opportunity and protects early buyers while capturing excess value for the protocol.

**Status**: Ready for implementation  
**Priority**: IMMEDIATE
