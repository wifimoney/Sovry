import { PairCreated } from "../generated/SovryFactory/SovryFactory"
import { Factory, Pool, Token } from "../generated/schema"
import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"

export function handlePairCreated(event: PairCreated): void {
  let factory = Factory.load("0xCfc99DFD727beE966beB1f11E838f5fCb4413707")
  if (factory == null) {
    factory = new Factory("0xCfc99DFD727beE966beB1f11E838f5fCb4413707")
    factory.poolCount = BigInt.zero()
    factory.totalVolumeUSD = BigDecimal.zero()
    factory.totalLiquidityUSD = BigDecimal.zero()
  }
  factory.poolCount = factory.poolCount.plus(BigInt.fromI32(1))
  factory.save()

  let token0 = new Token(event.params.token0.toHex())
  token0.symbol = "UNKNOWN"
  token0.name = "Unknown Token"
  token0.decimals = BigInt.fromI32(18)
  token0.totalLiquidity = BigDecimal.zero()
  token0.volume = BigDecimal.zero()
  token0.volumeUSD = BigDecimal.zero()
  token0.txCount = BigInt.zero()
  token0.save()

  let token1 = new Token(event.params.token1.toHex())
  token1.symbol = "UNKNOWN"
  token1.name = "Unknown Token"
  token1.decimals = BigInt.fromI32(18)
  token1.totalLiquidity = BigDecimal.zero()
  token1.volume = BigDecimal.zero()
  token1.volumeUSD = BigDecimal.zero()
  token1.txCount = BigInt.zero()
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