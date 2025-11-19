import { Redis } from '@upstash/redis'

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Cache keys
const CACHE_KEYS = {
  POOLS: 'sovry:pools',
  POOL_DATA: (poolId: string) => `sovry:pool:${poolId}`,
  USER_POOLS: (address: string) => `sovry:user:${address}:pools`,
  SWAP_HISTORY: (address: string) => `sovry:user:${address}:swaps`,
  TOKEN_PRICES: 'sovry:token:prices',
  GOLDSKY_RESPONSE: 'sovry:goldsky:pools',
} as const

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  POOLS: 300, // 5 minutes
  POOL_DATA: 180, // 3 minutes
  USER_DATA: 600, // 10 minutes
  TOKEN_PRICES: 120, // 2 minutes
  GOLDSKY_RESPONSE: 240, // 4 minutes
} as const

export interface CachedPool {
  id: string
  token0: {
    id: string
    symbol: string
    name: string
  }
  token1: {
    id: string
    symbol: string
    name: string
  }
  reserve0: string
  reserve1: string
  totalSupply: string
  volumeUSD: string
  txCount: string
  createdAtTimestamp: string
  cached_at: number
}

export interface SwapTransaction {
  id: string
  pool: string
  token0Symbol: string
  token1Symbol: string
  amount0: string
  amount1: string
  timestamp: number
  txHash: string
}

export class RedisService {
  // --- POOL CACHING ---
  static async cachePoolsData(pools: CachedPool[]): Promise<void> {
    try {
      const poolsWithTimestamp = pools.map(pool => ({
        ...pool,
        cached_at: Date.now()
      }))
      
      await redis.setex(
        CACHE_KEYS.POOLS,
        CACHE_TTL.POOLS,
        JSON.stringify(poolsWithTimestamp)
      )
      
      console.log(`✅ Cached ${pools.length} pools to Redis`)
    } catch (error) {
      console.error('❌ Failed to cache pools data:', error)
    }
  }

  static async getCachedPoolsData(): Promise<CachedPool[] | null> {
    try {
      const cached = await redis.get(CACHE_KEYS.POOLS)
      if (cached) {
        const pools = JSON.parse(cached as string) as CachedPool[]
        console.log(`✅ Retrieved ${pools.length} pools from Redis cache`)
        return pools
      }
      return null
    } catch (error) {
      console.error('❌ Failed to get cached pools:', error)
      return null
    }
  }

  static async cacheGoldskyResponse(response: any): Promise<void> {
    try {
      const responseWithTimestamp = {
        ...response,
        cached_at: Date.now()
      }
      
      await redis.setex(
        CACHE_KEYS.GOLDSKY_RESPONSE,
        CACHE_TTL.GOLDSKY_RESPONSE,
        JSON.stringify(responseWithTimestamp)
      )
      
      console.log('✅ Cached Goldsky response to Redis')
    } catch (error) {
      console.error('❌ Failed to cache Goldsky response:', error)
    }
  }

  static async getCachedGoldskyResponse(): Promise<any | null> {
    try {
      const cached = await redis.get(CACHE_KEYS.GOLDSKY_RESPONSE)
      if (cached) {
        const response = JSON.parse(cached as string)
        console.log('✅ Retrieved Goldsky response from Redis cache')
        return response
      }
      return null
    } catch (error) {
      console.error('❌ Failed to get cached Goldsky response:', error)
      return null
    }
  }

  // --- USER DATA CACHING ---
  static async cacheUserPools(userAddress: string, pools: string[]): Promise<void> {
    try {
      const userPoolsData = {
        pools,
        cached_at: Date.now()
      }
      
      await redis.setex(
        CACHE_KEYS.USER_POOLS(userAddress.toLowerCase()),
        CACHE_TTL.USER_DATA,
        JSON.stringify(userPoolsData)
      )
      
      console.log(`✅ Cached user pools for ${userAddress}`)
    } catch (error) {
      console.error('❌ Failed to cache user pools:', error)
    }
  }

  static async getCachedUserPools(userAddress: string): Promise<string[] | null> {
    try {
      const cached = await redis.get(CACHE_KEYS.USER_POOLS(userAddress.toLowerCase()))
      if (cached) {
        const data = JSON.parse(cached as string)
        console.log(`✅ Retrieved user pools for ${userAddress} from cache`)
        return data.pools
      }
      return null
    } catch (error) {
      console.error('❌ Failed to get cached user pools:', error)
      return null
    }
  }

  // --- SWAP HISTORY ---
  static async addSwapToHistory(userAddress: string, swap: SwapTransaction): Promise<void> {
    try {
      const key = CACHE_KEYS.SWAP_HISTORY(userAddress.toLowerCase())
      
      // Get existing history
      const existing = await redis.get(key)
      let swapHistory: SwapTransaction[] = []
      
      if (existing) {
        const data = JSON.parse(existing as string)
        swapHistory = data.swaps || []
      }
      
      // Add new swap to beginning of array
      swapHistory.unshift(swap)
      
      // Keep only last 50 swaps
      if (swapHistory.length > 50) {
        swapHistory = swapHistory.slice(0, 50)
      }
      
      const historyData = {
        swaps: swapHistory,
        updated_at: Date.now()
      }
      
      await redis.setex(
        key,
        CACHE_TTL.USER_DATA,
        JSON.stringify(historyData)
      )
      
      console.log(`✅ Added swap to history for ${userAddress}`)
    } catch (error) {
      console.error('❌ Failed to add swap to history:', error)
    }
  }

  static async getUserSwapHistory(userAddress: string): Promise<SwapTransaction[]> {
    try {
      const cached = await redis.get(CACHE_KEYS.SWAP_HISTORY(userAddress.toLowerCase()))
      if (cached) {
        const data = JSON.parse(cached as string)
        console.log(`✅ Retrieved swap history for ${userAddress}`)
        return data.swaps || []
      }
      return []
    } catch (error) {
      console.error('❌ Failed to get swap history:', error)
      return []
    }
  }

  // --- TOKEN PRICES ---
  static async cacheTokenPrices(prices: Record<string, number>): Promise<void> {
    try {
      const pricesWithTimestamp = {
        prices,
        cached_at: Date.now()
      }
      
      await redis.setex(
        CACHE_KEYS.TOKEN_PRICES,
        CACHE_TTL.TOKEN_PRICES,
        JSON.stringify(pricesWithTimestamp)
      )
      
      console.log('✅ Cached token prices to Redis')
    } catch (error) {
      console.error('❌ Failed to cache token prices:', error)
    }
  }

  static async getCachedTokenPrices(): Promise<Record<string, number> | null> {
    try {
      const cached = await redis.get(CACHE_KEYS.TOKEN_PRICES)
      if (cached) {
        const data = JSON.parse(cached as string)
        console.log('✅ Retrieved token prices from cache')
        return data.prices
      }
      return null
    } catch (error) {
      console.error('❌ Failed to get cached token prices:', error)
      return null
    }
  }

  // --- CACHE MANAGEMENT ---
  static async clearCache(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Clear specific pattern (Note: Upstash Redis may not support SCAN)
        console.log(`🧹 Clearing cache pattern: ${pattern}`)
      } else {
        // Clear all Sovry cache keys
        const keys = Object.values(CACHE_KEYS).filter(key => typeof key === 'string')
        for (const key of keys) {
          await redis.del(key as string)
        }
        console.log('🧹 Cleared all Sovry cache')
      }
    } catch (error) {
      console.error('❌ Failed to clear cache:', error)
    }
  }

  static async getCacheStats(): Promise<{
    pools: boolean
    goldsky: boolean
    uptime: string
  }> {
    try {
      const poolsExist = await redis.exists(CACHE_KEYS.POOLS)
      const goldskyExist = await redis.exists(CACHE_KEYS.GOLDSKY_RESPONSE)
      
      return {
        pools: poolsExist === 1,
        goldsky: goldskyExist === 1,
        uptime: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Failed to get cache stats:', error)
      return {
        pools: false,
        goldsky: false,
        uptime: 'Error'
      }
    }
  }

  // --- HEALTH CHECK ---
  static async healthCheck(): Promise<boolean> {
    try {
      const testKey = 'sovry:health:test'
      const testValue = Date.now().toString()
      
      await redis.set(testKey, testValue, { ex: 10 })
      const retrieved = await redis.get(testKey)
      await redis.del(testKey)
      
      return retrieved === testValue
    } catch (error) {
      console.error('❌ Redis health check failed:', error)
      return false
    }
  }
}

export default RedisService
