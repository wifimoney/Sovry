const storyscanService = require('./storyscanService');
const axios = require('axios');

class PricingService {
  constructor() {
    this.goldskyEndpoint = process.env.GOLDSKY_ENDPOINT;
    this.goldskyApiKey = process.env.GOLDSKY_API_KEY;
    
    // Cache for prices (5 minutes TTL)
    this.priceCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get pool data from Goldsky
   * @returns {Promise<Array>} Pool data with reserves
   */
  async getPoolsFromGoldsky() {
    try {
      console.log('🔍 Fetching pools data from Goldsky...');
      
      const query = `
        query GetPools {
          pools(first: 100, orderBy: volumeUSD, orderDirection: desc) {
            id
            token0 {
              id
              symbol
              name
            }
            token1 {
              id
              symbol
              name
            }
            reserve0
            reserve1
            totalSupply
            volumeUSD
            txCount
            createdAtTimestamp
          }
        }
      `;

      const response = await axios.post(this.goldskyEndpoint, {
        query
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.goldskyApiKey}`
        },
        timeout: 15000
      });

      if (response.data && response.data.data && response.data.data.pools) {
        console.log(`✅ Retrieved ${response.data.data.pools.length} pools from Goldsky`);
        return response.data.data.pools;
      }

      console.warn('⚠️ No pools data found in Goldsky response');
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch pools from Goldsky:', error.message);
      return [];
    }
  }

  /**
   * Calculate token price based on pool reserves and IP price
   * @param {Object} pool - Pool data from Goldsky
   * @param {number} ipPrice - IP price in USD
   * @returns {Object} Token prices
   */
  calculateTokenPrices(pool, ipPrice) {
    try {
      const reserve0 = parseFloat(pool.reserve0);
      const reserve1 = parseFloat(pool.reserve1);
      
      if (reserve0 === 0 || reserve1 === 0) {
        return { token0Price: 0, token1Price: 0 };
      }

      let token0Price = 0;
      let token1Price = 0;

      // Check if token0 or token1 is IP
      if (pool.token0.symbol === 'IP') {
        token0Price = ipPrice;
        // Calculate token1 price based on reserve ratio
        token1Price = (reserve0 / reserve1) * ipPrice;
      } else if (pool.token1.symbol === 'IP') {
        token1Price = ipPrice;
        // Calculate token0 price based on reserve ratio
        token0Price = (reserve1 / reserve0) * ipPrice;
      } else {
        // If neither token is IP, we need another reference
        // For now, return 0 or implement additional logic
        console.warn(`⚠️ Pool ${pool.id} doesn't contain IP token`);
        return { token0Price: 0, token1Price: 0 };
      }

      return {
        token0Price: Math.max(0, token0Price),
        token1Price: Math.max(0, token1Price)
      };
    } catch (error) {
      console.error('❌ Error calculating token prices:', error);
      return { token0Price: 0, token1Price: 0 };
    }
  }

  /**
   * Get all token prices with USD values
   * @param {boolean} useCache - Whether to use cached data
   * @returns {Promise<Object>} Token prices and pool data
   */
  async getAllTokenPrices(useCache = true) {
    const cacheKey = 'all_token_prices';
    
    // Check cache first
    if (useCache && this.priceCache.has(cacheKey)) {
      const cached = this.priceCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        console.log('✅ Using cached token prices');
        return cached.data;
      }
    }

    try {
      // Get IP price from Storyscan
      const ipPrice = await storyscanService.getIPPriceWithFallback();
      
      // Get pools data from Goldsky
      const pools = await this.getPoolsFromGoldsky();
      
      const enrichedPools = pools.map(pool => {
        const prices = this.calculateTokenPrices(pool, ipPrice);
        
        return {
          ...pool,
          token0Price: prices.token0Price,
          token1Price: prices.token1Price,
          token0PriceUSD: prices.token0Price,
          token1PriceUSD: prices.token1Price,
          // Calculate pool TVL
          tvlUSD: (parseFloat(pool.reserve0) * prices.token0Price) + 
                  (parseFloat(pool.reserve1) * prices.token1Price)
        };
      });

      // Create token price lookup
      const tokenPrices = {};
      enrichedPools.forEach(pool => {
        tokenPrices[pool.token0.symbol] = pool.token0PriceUSD;
        tokenPrices[pool.token1.symbol] = pool.token1PriceUSD;
      });

      const result = {
        ipPrice,
        pools: enrichedPools,
        tokenPrices,
        lastUpdated: new Date().toISOString()
      };

      // Cache the result
      this.priceCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      console.log(`✅ Calculated prices for ${enrichedPools.length} pools`);
      return result;
    } catch (error) {
      console.error('❌ Failed to get token prices:', error);
      return {
        ipPrice: 0,
        pools: [],
        tokenPrices: {},
        lastUpdated: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Get price for a specific token
   * @param {string} tokenSymbol - Token symbol
   * @returns {Promise<number>} Token price in USD
   */
  async getTokenPrice(tokenSymbol) {
    try {
      const allPrices = await this.getAllTokenPrices();
      return allPrices.tokenPrices[tokenSymbol] || 0;
    } catch (error) {
      console.error(`❌ Failed to get price for ${tokenSymbol}:`, error);
      return 0;
    }
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
    console.log('✅ Price cache cleared');
  }
}

module.exports = new PricingService();
