import { PairCreated } from "../generated/SovryFactory/SovryFactory"
import { Factory, Pool, Token, Bundle } from "../generated/schema"
import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts"
import { updateWIPPriceFromPyth } from "./pricing"
import { updateTokenMetadata, getTokenSymbol, getTokenName } from "./tokenMetadata"

export function handlePairCreated(event: PairCreated): void {
  let factory = Factory.load("0xAc903015B6828A5290DF0e42504423EBB295c8a3")
  if (factory == null) {
    factory = new Factory("0xAc903015B6828A5290DF0e42504423EBB295c8a3")
    factory.poolCount = BigInt.zero()
    factory.totalVolumeUSD = BigDecimal.zero()
    factory.totalLiquidityUSD = BigDecimal.zero()
    factory.totalFeesUSD = BigDecimal.zero()
    factory.untrackedVolumeUSD = BigDecimal.zero()
  }
  factory.poolCount = factory.poolCount.plus(BigInt.fromI32(1))
  factory.save()

  // Grade Startup: Initialize Bundle for Price Oracle with Pyth
  let bundle = Bundle.load("1")
  if (bundle == null) {
    bundle = new Bundle("1")
    updateWIPPriceFromPyth() // Initialize with Pyth price
    bundle.save()
  } else {
    updateWIPPriceFromPyth() // Update price on new pool creation
    bundle.save()
  }

  // Grade Startup: Enhanced Token 0 with Metadata
  let token0 = new Token(event.params.token0.toHex())
  updateTokenMetadata(token0, event.params.token0)
  token0.totalLiquidity = BigDecimal.zero()
  token0.volume = BigDecimal.zero()
  token0.volumeUSD = BigDecimal.zero()
  token0.txCount = BigInt.zero()
  // Grade Startup: Price tracking
  token0.derivedETH = BigDecimal.zero()
  token0.derivedUSD = BigDecimal.zero()
  token0.save()

  // Grade Startup: Enhanced Token 1 with Metadata
  let token1 = new Token(event.params.token1.toHex())
  updateTokenMetadata(token1, event.params.token1)
  token1.totalLiquidity = BigDecimal.zero()
  token1.volume = BigDecimal.zero()
  token1.volumeUSD = BigDecimal.zero()
  token1.txCount = BigInt.zero()
  // Grade Startup: Price tracking
  token1.derivedETH = BigDecimal.zero()
  token1.derivedUSD = BigDecimal.zero()
  token1.save()

  let pool = new Pool(event.params.pair.toHex())
  pool.token0 = token0.id
  pool.token1 = token1.id
  pool.reserve0 = BigDecimal.zero()
  pool.reserve1 = BigDecimal.zero()
  pool.totalSupply = BigDecimal.zero()
  pool.volumeUSD = BigDecimal.zero()
  pool.txCount = BigInt.zero()
  pool.createdAtTimestamp = event.block.timestamp
  pool.createdAtBlockNumber = event.block.number
  pool.save()
}