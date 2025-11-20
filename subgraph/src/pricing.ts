import { BigDecimal, BigInt, Address } from "@graphprotocol/graph-ts"
import { Token, Bundle, Pool } from "../generated/schema"

// Grade Startup: Price Oracle Utilities
export const WIP_ADDRESS = Address.fromString("0x1514000000000000000000000000000000000000")

// Pyth Network Price Feed IDs (Story Protocol)
export const IP_USD_FEED_ID = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c19d" // IP/USD feed ID

// Pyth Contract Address (Story Protocol Testnet)
// Note: This would be the actual Pyth contract address on Story Protocol
export const PYTH_CONTRACT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000") // Placeholder

// Convert token amounts to BigDecimal
export function convertTokenToDecimal(amount: BigInt, decimals: BigInt): BigDecimal {
  if (decimals == BigInt.fromI32(0)) {
    return amount.toBigDecimal()
  }
  return amount.toBigDecimal().div(BigDecimal.fromString("1").plus(decimals.toBigDecimal()))
}

// Get WIP price in USD using Pyth Oracle
export function getWIPPriceUSD(): BigDecimal {
  let bundle = Bundle.load("1")
  if (bundle === null) {
    bundle = new Bundle("1")
    // Default IP price - would be updated from Pyth oracle
    bundle.ethPriceUSD = BigDecimal.fromString("0.50") // Default $0.50 per IP
    bundle.save()
  }
  return bundle.ethPriceUSD
}

// Update WIP price from Pyth Oracle (placeholder for future implementation)
export function updateWIPPriceFromPyth(): void {
  // This would fetch price from Pyth oracle
  // For now, we'll use a reasonable default
  let bundle = Bundle.load("1")
  if (bundle === null) {
    bundle = new Bundle("1")
  }
  
  // TODO: Implement actual Pyth price fetching
  // For now, set a reasonable IP price based on market data
  bundle.ethPriceUSD = BigDecimal.fromString("0.50") // $0.50 per IP token
  bundle.save()
}

// Calculate token price in WIP based on pool reserves
export function findWIPPriceUSD(token: Token): BigDecimal {
  if (token.id == WIP_ADDRESS.toHexString()) {
    return BigDecimal.fromString("1")
  }
  
  // For IP tokens, calculate price based on WIP reserves in pools
  // This is a simplified version - in production would use multiple pools
  return BigDecimal.zero()
}

// Calculate token price in USD
export function findUSDPrice(token: Token): BigDecimal {
  let wipPriceUSD = getWIPPriceUSD()
  let tokenPriceWIP = findWIPPriceUSD(token)
  return wipPriceUSD.times(tokenPriceWIP)
}

// Get tracked amount for USD calculations
export function getTrackedAmountUSD(
  tokenAmount: BigDecimal,
  token: Token,
  wipAmount: BigDecimal
): BigDecimal {
  let wipPriceUSD = getWIPPriceUSD()
  
  // For IP tokens, use their market value
  if (token.id != WIP_ADDRESS.toHexString()) {
    // Calculate IP token value based on WIP pair
    return wipAmount.times(wipPriceUSD)
  }
  
  // For WIP, use direct USD value
  return wipAmount.times(wipPriceUSD)
}

// Calculate TVL in USD for a pool
export function getPoolTvlUSD(pool: Pool): BigDecimal {
  let token0 = Token.load(pool.token0)
  let token1 = Token.load(pool.token1)
  
  if (token0 === null || token1 === null) {
    return BigDecimal.zero()
  }
  
  let wipPriceUSD = getWIPPriceUSD()
  
  // Calculate TVL based on WIP reserves (more conservative)
  if (token0.id == WIP_ADDRESS.toHexString()) {
    return pool.reserve0.times(wipPriceUSD).times(BigDecimal.fromString("2"))
  }
  if (token1.id == WIP_ADDRESS.toHexString()) {
    return pool.reserve1.times(wipPriceUSD).times(BigDecimal.fromString("2"))
  }
  
  // If no WIP in pool, estimate based on token prices
  let token0PriceUSD = findUSDPrice(token0)
  let token1PriceUSD = findUSDPrice(token1)
  
  return pool.reserve0.times(token0PriceUSD).plus(pool.reserve1.times(token1PriceUSD))
}
