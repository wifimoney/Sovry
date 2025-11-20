import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Token } from "../generated/schema"

// Grade Startup: Enhanced Token Metadata Handler
export function updateTokenMetadata(token: Token, tokenAddress: Address): void {
  // Known token mappings for Story Protocol ecosystem
  let knownTokens = getKnownTokenMappings()
  
  if (knownTokens.has(tokenAddress.toHexString())) {
    let metadata = knownTokens.get(tokenAddress.toHexString())
    if (metadata) {
      token.symbol = metadata.symbol
      token.name = metadata.name
      token.decimals = metadata.decimals
    }
  }
  
  // For unknown tokens, try to fetch from contract (future implementation)
  if (token.symbol == "UNKNOWN") {
    // TODO: Implement ERC20 metadata fetching
    token.symbol = "UNKNOWN"
    token.name = "Unknown Token"
    token.decimals = BigInt.fromI32(18) // Default to 18 decimals
  }
}

// Known token mappings for Story Protocol
function getKnownTokenMappings(): Map<string, TokenMetadata> {
  let mappings = new Map<string, TokenMetadata>()
  
  // WIP - Wrapped IP
  mappings.set(
    "0x1514000000000000000000000000000000000000",
    new TokenMetadata("WIP", "Wrapped IP", BigInt.fromI32(18))
  )
  
  // Add more known tokens as they become available
  // Example: IP - Native Story Protocol token
  // mappings.set(
  //   "0x0000000000000000000000000000000000000000",
  //   new TokenMetadata("IP", "Story Protocol", BigInt.fromI32(18))
  // )
  
  return mappings
}

// Token metadata class
class TokenMetadata {
  symbol: string
  name: string
  decimals: BigInt
  
  constructor(symbol: string, name: string, decimals: BigInt) {
    this.symbol = symbol
    this.name = name
    this.decimals = decimals
  }
}

// Get token symbol for display
export function getTokenSymbol(tokenAddress: Address): string {
  let knownTokens = getKnownTokenMappings()
  let metadata = knownTokens.get(tokenAddress.toHexString())
  
  if (metadata) {
    return metadata.symbol
  }
  
  return "UNKNOWN"
}

// Get token name for display
export function getTokenName(tokenAddress: Address): string {
  let knownTokens = getKnownTokenMappings()
  let metadata = knownTokens.get(tokenAddress.toHexString())
  
  if (metadata) {
    return metadata.name
  }
  
  return "Unknown Token"
}

// Check if token is WIP
export function isWIP(tokenAddress: Address): boolean {
  return tokenAddress.equals(Address.fromString("0x1514000000000000000000000000000000000000"))
}

// Check if token is a royalty token (IP asset)
export function isRoyaltyToken(tokenAddress: Address): boolean {
  // For now, consider all non-WIP tokens as potential royalty tokens
  return !isWIP(tokenAddress)
}
