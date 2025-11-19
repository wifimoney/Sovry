import { BigInt, BigDecimal, Address, Bytes } from "@graphprotocol/graph-ts"
// Import Event
import { PairCreated } from "../generated/SovryFactory/SovryFactory"
import { RoyaltyPaid } from "../generated/RoyaltyModule/RoyaltyModule"
import { Swap, Sync, Mint, Burn } from "../generated/templates/SovryPool/SovryPool"
// Import Schema
import { Factory, Pool, Token, IPAsset, RoyaltyPayment } from "../generated/schema"
// Import Template
import { SovryPool as PoolTemplate } from "../generated/templates"
// Import Contract Binding
import { ERC20 } from "../generated/SovryFactory/ERC20"

// Konstanta
const WIP_ADDRESS = "0x1514000000000000000000000000000000000000"
const ZERO_BD = BigDecimal.fromString("0")
const ZERO_BI = BigInt.fromI32(0)

// --- HELPER FUNCTIONS ---
function fetchTokenSymbol(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)
  let symbolValue = contract.try_symbol()
  return symbolValue.reverted ? "UNKNOWN" : symbolValue.value
}

function fetchTokenName(tokenAddress: Address): string {
  let contract = ERC20.bind(tokenAddress)
  let nameValue = contract.try_name()
  return nameValue.reverted ? "Unknown Token" : nameValue.value
}

function fetchTokenDecimals(tokenAddress: Address): BigInt {
  let contract = ERC20.bind(tokenAddress)
  let decimalValue = contract.try_decimals()
  return decimalValue.reverted ? BigInt.fromI32(18) : BigInt.fromI32(decimalValue.value)
}

// --- HANDLER 1: PAIR CREATED ---
export function handlePairCreated(event: PairCreated): void {
  let factory = Factory.load("1")
  if (factory === null) {
    factory = new Factory("1")
    factory.poolCount = ZERO_BI
    factory.totalVolumeUSD = ZERO_BD
    factory.totalLiquidityUSD = ZERO_BD
    factory.save()
  }
  factory.poolCount = factory.poolCount.plus(BigInt.fromI32(1))
  factory.save()

  let token0 = Token.load(event.params.token0.toHexString())
  if (token0 === null) {
    token0 = new Token(event.params.token0.toHexString())
    token0.symbol = fetchTokenSymbol(event.params.token0)
    token0.name = fetchTokenName(event.params.token0)
    token0.decimals = fetchTokenDecimals(event.params.token0)
    token0.totalLiquidity = ZERO_BD
    token0.volume = ZERO_BD
    token0.volumeUSD = ZERO_BD
    token0.txCount = ZERO_BI
    token0.save()
  }

  let token1 = Token.load(event.params.token1.toHexString())
  if (token1 === null) {
    token1 = new Token(event.params.token1.toHexString())
    token1.symbol = fetchTokenSymbol(event.params.token1)
    token1.name = fetchTokenName(event.params.token1)
    token1.decimals = fetchTokenDecimals(event.params.token1)
    token1.totalLiquidity = ZERO_BD
    token1.volume = ZERO_BD
    token1.volumeUSD = ZERO_BD
    token1.txCount = ZERO_BI
    token1.save()
  }

  let pool = new Pool(event.params.pair.toHexString())
  pool.token0 = token0.id
  pool.token1 = token1.id
  pool.reserve0 = ZERO_BD
  pool.reserve1 = ZERO_BD
  pool.totalSupply = ZERO_BD
  pool.volumeUSD = ZERO_BD
  pool.txCount = ZERO_BI
  pool.createdAtTimestamp = event.block.timestamp
  pool.createdAtBlockNumber = event.block.number
  pool.save()

  PoolTemplate.create(event.params.pair)
}

// --- HANDLER 2: ROYALTY PAID (FINAL FIX) ---
export function handleRoyaltyPaid(event: RoyaltyPaid): void {
  // Ambil data dari parameter event yang SUDAH VALID
  let targetIpId = event.params.receiverIpId.toHexString() 
  let tokenAddr = event.params.token.toHexString()
  let amount = event.params.amount
  
  // Parameter ke-3 di Event RoyaltyPaid adalah 'sender' (bukan payer)
  // Lihat baris 262 di file RoyaltyModule.ts yang Anda upload
  let payerAddr = event.params.sender 

  // Filter WIP (Case Insensitive)
  if (tokenAddr.toLowerCase() != WIP_ADDRESS.toLowerCase()) return

  let ipAsset = IPAsset.load(targetIpId)
  if (ipAsset === null) {
    ipAsset = new IPAsset(targetIpId)
    // Konversi Address ke Bytes dengan Bytes.fromHexString()
    ipAsset.royaltyVault = Bytes.fromHexString(event.params.receiverIpId.toHexString())
    ipAsset.totalRevenueWIP = ZERO_BI
    
    let token = Token.load(targetIpId)
    if (token) {
       ipAsset.token = token.id
       token.ipAsset = ipAsset.id
       token.save()
    }
  }
  
  ipAsset.totalRevenueWIP = ipAsset.totalRevenueWIP.plus(amount)
  ipAsset.save()

  let paymentId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let payment = new RoyaltyPayment(paymentId)
  
  payment.targetIp = targetIpId
  // Konversi Address ke Bytes
  payment.token = Bytes.fromHexString(event.params.token.toHexString())
  payment.amount = amount
  // Konversi Address ke Bytes
  payment.payer = Bytes.fromHexString(payerAddr.toHexString())
  
  payment.timestamp = event.block.timestamp
  payment.txHash = event.transaction.hash
  payment.save()
}

// --- HANDLER 3: POOL UPDATES ---
export function handleSync(event: Sync): void {
  let pool = Pool.load(event.address.toHexString())
  if (pool !== null) {
    pool.reserve0 = event.params.reserve0.toBigDecimal()
    pool.reserve1 = event.params.reserve1.toBigDecimal()
    pool.save()
  }
}

export function handleSwap(event: Swap): void {
  let pool = Pool.load(event.address.toHexString())
  if (pool !== null) {
    pool.txCount = pool.txCount.plus(BigInt.fromI32(1))
    pool.save()
  }
}

// Placeholder handler
export function handleMint(event: Mint): void {}
export function handleBurn(event: Burn): void {}