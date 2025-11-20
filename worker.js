// Sovry Backend Worker
// Implements the sequence diagram architecture
// Runs every 1 minute to fetch IP price and cache in memory

require('dotenv').config();
const storyscanService = require('./services/storyscanService');
const pricingService = require('./services/pricingService');

class SovryWorker {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.memoryCache = {
      price: null,
      timestamp: null
    };
  }

  /**
   * Initialize memory cache
   */
  async initializeCache() {
    console.log('⚡ Using in-memory cache for real-time updates');
    this.memoryCache = {
      price: null,
      timestamp: null
    };
    return true;
  }

  /**
   * Background Process: Fetch IP price from StoryScan and cache in memory
   * This runs every 1 minute for real-time updates
   */
  async updateIPPrice() {
    try {
      console.log('🔄 [BACKGROUND] Starting IP price update process...');
      console.log('📡 [BACKGROUND] Calling StoryScan API: GET /api/v2/stats');
      
      // Get IP price from StoryScan API with fallback
      const ipPrice = await storyscanService.getIPPriceWithFallback();
      
      if (ipPrice === null) {
        console.error('❌ [BACKGROUND] Failed to get IP price from StoryScan');
        return {
          success: false,
          error: 'Failed to fetch IP price from StoryScan'
        };
      }

      // Cache in memory for real-time updates
      this.memoryCache.price = ipPrice.toString();
      this.memoryCache.timestamp = new Date().toISOString();
      console.log(`💾 [BACKGROUND] Cached in memory: price:IP:USD = ${ipPrice}`);
      console.log(`✅ [BACKGROUND] IP price update completed: $${ipPrice}`);
        
      return {
        success: true,
        price: ipPrice,
        timestamp: new Date().toISOString(),
        source: 'StoryScan API'
      };
    } catch (error) {
      console.error('❌ [BACKGROUND] Error in IP price update:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * User Request Process: Handle /api/pools request
   * Gets reserves from Goldsky, price from memory cache, calculates final price
   */
  async processPoolsRequest() {
    try {
      console.log('🌐 [USER REQUEST] Processing /api/pools request...');
      
      // Step 1: Get pool reserves from Goldsky (Database)
      console.log('📊 [USER REQUEST] Fetching reserves from Goldsky DB...');
      const poolsData = await pricingService.getPoolsFromGoldsky();
      
      if (!poolsData || poolsData.length === 0) {
        console.warn('⚠️ [USER REQUEST] No pools data from Goldsky');
        return {
          success: false,
          error: 'No pools data available',
          pools: []
        };
      }

      console.log(`📋 [USER REQUEST] Retrieved ${poolsData.length} pools from Goldsky`);

      // Step 2: Get IP price from memory cache
      console.log('💾 [USER REQUEST] Fetching price:IP:USD from memory cache...');
      const cachedIPPrice = this.memoryCache.price;
      
      if (!cachedIPPrice) {
        console.warn('⚠️ [USER REQUEST] No cached IP price in memory');
        return {
          success: false,
          error: 'IP price not available in cache - worker may be starting',
          pools: []
        };
      }

      const ipPrice = parseFloat(cachedIPPrice);
      console.log(`💰 [USER REQUEST] Retrieved from memory: price:IP:USD = ${ipPrice}`);

      // Step 3: Calculate prices for each pool
      const processedPools = [];
      
      for (const pool of poolsData) {
        console.log(`🧮 [USER REQUEST] Calculating price for pool ${pool.id}...`);
        console.log(`📊 [USER REQUEST] Pool reserves - WIP: ${pool.reserve0}, Token: ${pool.reserve1}`);
        
        // Calculate: (reserve0/reserve1) * ipPrice (as per sequence diagram)
        const reserve0 = parseFloat(pool.reserve0);
        const reserve1 = parseFloat(pool.reserve1);
        const calculatedPrice = (reserve0 / reserve1) * ipPrice;
        
        console.log(`📈 [USER REQUEST] Calculation: (${reserve0}/${reserve1}) * ${ipPrice} = $${calculatedPrice.toFixed(2)}`);
        
        processedPools.push({
          ...pool,
          priceUSD: calculatedPrice.toFixed(2),
          calculation: `(${reserve0}/${reserve1}) * ${ipPrice}`,
          ipPrice: ipPrice,
          timestamp: new Date().toISOString()
        });
      }

      console.log(`✅ [USER REQUEST] Processed ${processedPools.length} pools with pricing`);
      
      return {
        success: true,
        pools: processedPools,
        ipPrice: ipPrice,
        timestamp: new Date().toISOString(),
        source: 'Goldsky + Redis Cache'
      };
    } catch (error) {
      console.error('❌ [USER REQUEST] Error processing pools request:', error);
      return {
        success: false,
        error: error.message,
        pools: []
      };
    }
  }

  /**
   * Start the background worker
   * Runs every 1 minute (60,000 ms) for real-time updates
   */
  async start() {
    if (this.isRunning) {
      console.log('⚠️ Worker is already running');
      return;
    }

    console.log('🚀 Starting Sovry Backend Worker...');
    
    // Initialize memory cache
    const cacheInitialized = await this.initializeCache();
    if (!cacheInitialized) {
      console.error('❌ Failed to start worker - Cache initialization failed');
      return;
    }

    this.isRunning = true;
    
    // Run immediately on start
    console.log('⚡ Running initial IP price update...');
    await this.updateIPPrice();
    
    // Then run every 1 minute for real-time swap features
    console.log('⏰ Scheduling background updates every 1 minute for real-time swap...');
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.updateIPPrice();
      }
    }, 60000); // 1 minute = 60,000 ms

    console.log('✅ Sovry Backend Worker started successfully');
    console.log('📋 Worker Status:');
    console.log('   - Background Updates: Every 1 minute (real-time)');
    console.log('   - StoryScan API: https://aeneid.storyscan.io/api/v2/stats');
    console.log('   - Memory Cache: price:IP:USD (1 min TTL)');
    console.log('   - User Endpoint: /api/pools');
    console.log('   - Real-time Features: Swap, Liquidity, Pools');
  }

  /**
   * Stop the background worker
   */
  async stop() {
    console.log('🛑 Stopping Sovry Backend Worker...');
    
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log('✅ Sovry Backend Worker stopped');
  }

  /**
   * Get worker status
   */
  async getStatus() {
    try {
      const cachedPrice = this.memoryCache ? this.memoryCache.price : null;
      const lastUpdate = this.memoryCache ? this.memoryCache.timestamp : null;
      
      return {
        isRunning: this.isRunning,
        cache: 'memory',
        cachedPrice: cachedPrice || 'none',
        lastUpdate: lastUpdate || 'never',
        nextUpdate: this.isRunning ? 'in 1 minute' : 'not scheduled'
      };
    } catch (error) {
      return {
        isRunning: this.isRunning,
        cache: 'error',
        error: error.message
      };
    }
  }

  /**
   * Manual price update trigger
   */
  async forceUpdatePrice() {
    console.log('🔄 Manual price update triggered...');
    return await this.updateIPPrice();
  }
}

// Create and export shared worker instance
const sharedWorker = new SovryWorker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await sharedWorker.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await sharedWorker.stop();
  process.exit(0);
});

// Start worker if this file is run directly
if (require.main === module) {
  sharedWorker.start();
}

module.exports = sharedWorker;
