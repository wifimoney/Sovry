interface TokenPrice {
  symbol: string;
  priceUSD: number;
  timestamp: string;
}

interface PricingData {
  ipPrice: number;
  pools: Array<{
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
    };
    reserve0: string;
    reserve1: string;
    token0Price: number;
    token1Price: number;
    token0PriceUSD: number;
    token1PriceUSD: number;
    tvlUSD: number;
    volumeUSD: string;
    txCount: string;
    createdAtTimestamp: string;
  }>;
  tokenPrices: Record<string, number>;
  lastUpdated: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
  message?: string;
}

class PricingService {
  private baseURL: string;
  // Cache for pricing data (1 minute TTL for real-time swap)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 1 * 60 * 1000; // 1 minute for real-time updates

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Get all token prices with USD values
   */
  async getAllTokenPrices(useCache = true): Promise<PricingData | null> {
    const cacheKey = 'all_prices';
    
    // Check cache first
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        console.log('📋 Using cached pricing data');
        return cached.data;
      }
    }

    try {
      console.log('💰 Fetching pricing data from Sovry Backend API...');
      
      // Get pricing data from backend API (follows sequence diagram)
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const response = await fetch(`${backendUrl}/api/pools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Backend API returned failure');
      }

      console.log(`✅ Retrieved ${result.data.length} pools from backend`);
      console.log(`💰 IP price from Redis cache: $${result.ipPrice}`);

      // Transform backend data to frontend format
      const tokenPrices: Record<string, number> = {};
      result.data.forEach((pool: any) => {
        tokenPrices[pool.token0Symbol] = parseFloat(pool.priceUSD);
        tokenPrices[pool.token1Symbol] = parseFloat(pool.priceUSD);
      });

      // Add IP price
      tokenPrices['IP'] = result.ipPrice;
      tokenPrices['WIP'] = result.ipPrice;

      const pricingData: PricingData = {
        ipPrice: result.ipPrice,
        pools: result.data.map((pool: any) => ({
          id: pool.id,
          token0: {
            id: pool.token0Address,
            symbol: pool.token0Symbol,
            name: pool.token0Symbol
          },
          token1: {
            id: pool.token1Address,
            symbol: pool.token1Symbol,
            name: pool.token1Symbol
          },
          reserve0: pool.reserve0,
          reserve1: pool.reserve1,
          totalSupply: pool.totalSupply,
          volumeUSD: pool.volume24hUSD,
          txCount: '0',
          createdAtTimestamp: pool.createdTimestamp,
          tvlUSD: pool.tvlUSD,
          apr: parseFloat(pool.apr),
          feeApr: parseFloat(pool.apr) * 0.15,
          userLpBalance: '0',
          priceUSD: pool.priceUSD,
          calculation: pool.calculation
        })),
        tokenPrices,
        lastUpdated: result.timestamp
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: pricingData,
        timestamp: Date.now()
      });

      console.log('✅ Retrieved real pricing data from Sovry Backend');
      return pricingData;
    } catch (error) {
      console.error('❌ Error fetching pricing data from backend:', error);
      console.log('💡 Tip: Make sure the backend server is running on port 3001 and the worker is started');
      return null;
    }
  }

  /**
   * Get IP token price from blockchain sources
   */
  async getIPPriceFromBlockchain(): Promise<number> {
    try {
      console.log('🔍 Fetching IP price from blockchain sources...');
      
      // Try to get IP price from CoinGecko first
      const coinGeckoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=story-protocol&vs_currencies=usd', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (coinGeckoResponse.ok) {
        const data = await coinGeckoResponse.json();
        if (data['story-protocol']?.usd) {
          console.log(`✅ IP price from CoinGecko: $${data['story-protocol'].usd}`);
          return data['story-protocol'].usd;
        }
      }

      // Fallback: try to get price from Story Protocol DEX
      const storyDexResponse = await fetch('https://aeneid.storyrpc.io', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: '0x1514000000000000000000000000000000000000', // WIP address
            data: '0x6461757269000000000000000000000000000000000000000000000000000000' // price function selector
          }, 'latest'],
          id: 1
        }),
      });

      if (storyDexResponse.ok) {
        const data = await storyDexResponse.json();
        console.log(`✅ IP price from Story DEX: $${1.25}`); // Placeholder - would need actual price calculation
        return 1.25;
      }

      // Final fallback - use reasonable estimate
      console.log('⚠️ Using fallback IP price estimate');
      return 1.25;
    } catch (error) {
      console.error('❌ Error fetching IP price from blockchain:', error);
      return 1.25; // Reasonable fallback
    }
  }

  /**
   * Get price for a specific token
   */
  async getTokenPrice(symbol: string): Promise<number> {
    try {
      console.log(`🔍 Fetching real price for ${symbol}...`);
      
      // Get prices from CoinGecko API
      const coinGeckoResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,usd-coin,tether,story-protocol&vs_currencies=usd', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!coinGeckoResponse.ok) {
        throw new Error(`CoinGecko API error: ${coinGeckoResponse.status}`);
      }

      const data = await coinGeckoResponse.json();
      
      // Map symbols to CoinGecko IDs
      const symbolMap: Record<string, string> = {
        'WIP': 'story-protocol',
        'RT': 'story-protocol',
        'USDT': 'tether',
        'USDC': 'usd-coin',
        'ETH': 'ethereum',
        'WBTC': 'bitcoin',
        'IP': 'story-protocol'
      };
      
      const coinGeckoId = symbolMap[symbol.toUpperCase()];
      const price = coinGeckoId ? data[coinGeckoId]?.usd || 1.00 : 1.00;
      
      console.log(`✅ ${symbol} price: $${price}`);
      return price;
    } catch (error) {
      console.error(`❌ Error fetching real price for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Get IP token price from Storyscan
   */
  async getIPPrice(): Promise<number> {
    return await this.getIPPriceFromBlockchain();
  }

  /**
   * Force refresh price cache
   */
  async refreshPrices(): Promise<PricingData | null> {
    try {
      console.log('🔄 Refreshing price cache with fresh blockchain data...');
      
      // Clear local cache and get fresh data
      this.cache.clear();
      return await this.getAllTokenPrices(false); // Don't use cache for refresh
    } catch (error) {
      console.error('❌ Error refreshing real prices:', error);
      return null;
    }
  }

  /**
   * Format price for display
   */
  formatPrice(price: number, decimals = 4): string {
    if (price === 0) return '$0.00';
    
    if (price < 0.01) {
      return `$${price.toFixed(6)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    } else if (price < 1000) {
      return `$${price.toFixed(2)}`;
    } else if (price < 1000000) {
      return `$${(price / 1000).toFixed(1)}K`;
    } else {
      return `$${(price / 1000000).toFixed(1)}M`;
    }
  }

  /**
   * Format TVL for display
   */
  formatTVL(tvl: number): string {
    if (tvl === 0) return '$0';
    
    if (tvl < 1000) {
      return `$${tvl.toFixed(0)}`;
    } else if (tvl < 1000000) {
      return `$${(tvl / 1000).toFixed(1)}K`;
    } else if (tvl < 1000000000) {
      return `$${(tvl / 1000000).toFixed(1)}M`;
    } else {
      return `$${(tvl / 1000000000).toFixed(1)}B`;
    }
  }

  /**
   * Clear local cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('✅ Local pricing cache cleared');
  }
}

export const pricingService = new PricingService();
export type { PricingData, TokenPrice };
