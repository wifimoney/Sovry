const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();

console.log('⚡ Routes using worker memory cache for real-time updates');

// GET /api/pools - Get pools with pricing from worker
router.get("/pools", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: GET /api/pools');
    
    const worker = require('./workerInstance');
    const result = await worker.processPoolsRequest();
    
    if (!result.success) {
      console.warn('⚠️ [API] Worker failed to process pools request');
      return res.json({
        success: false,
        error: result.error,
        data: []
      });
    }

    console.log(`✅ [API] Worker processed ${result.pools.length} pools with pricing`);
    
    res.json({
      success: true,
      data: result.pools,
      ipPrice: result.ipPrice,
      timestamp: result.timestamp,
      source: result.source
    });
  } catch (error) {
    console.error('❌ [API] Error processing pools request:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

// GET /api/ip-price - Get current IP price from worker cache
router.get("/ip-price", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: GET /api/ip-price');
    
    const worker = require('./workerInstance');
    const status = await worker.getStatus();
    
    if (status.cachedPrice && status.cachedPrice !== 'none') {
      console.log(`✅ [API] Retrieved cached IP price: $${status.cachedPrice}`);
      res.json({
        success: true,
        price: parseFloat(status.cachedPrice),
        source: 'Worker Memory Cache',
        timestamp: status.lastUpdate
      });
    } else {
      console.warn('⚠️ [API] No cached IP price found');
      res.status(404).json({
        success: false,
        error: 'IP price not available in cache. Background worker may not be running.',
        suggestion: 'Start the worker.js process to fetch and cache IP prices',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ [API] Error in /api/ip-price:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/refresh-price - Force refresh IP price
router.post("/refresh-price", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/refresh-price');
    
    const worker = require('./workerInstance');
    const result = await worker.forceUpdatePrice();
    
    if (result.success) {
      console.log(`💾 [API] Updated worker cache: price:IP:USD = ${result.price}`);
      res.json({
        success: true,
        price: result.price,
        source: 'StoryScan API',
        timestamp: result.timestamp
      });
    } else {
      console.warn('⚠️ [API] Failed to get fresh IP price from StoryScan');
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to fetch IP price from StoryScan API',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ [API] Error in /api/refresh-price:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/worker/status - Get worker status
router.get("/worker/status", async (req, res) => {
  try {
    const worker = require('./workerInstance');
    const status = await worker.getStatus();
    
    res.json({
      success: true,
      worker: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/liquidity/add - Prepare add liquidity transaction
router.post("/liquidity/add", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/liquidity/add');
    
    const { tokenA, tokenB, amountADesired, amountBDesired, userAddress, slippagePercent = 0.5 } = req.body;
    
    // Validate required fields
    if (!tokenA || !tokenB || !amountADesired || !amountBDesired || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenA, tokenB, amountADesired, amountBDesired, userAddress'
      });
    }
    
    // Validate amounts
    if (parseFloat(amountADesired) <= 0 || parseFloat(amountBDesired) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amounts must be greater than 0'
      });
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenA) || !ethers.utils.isAddress(tokenB) || !ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const liquidityService = require('./services/liquidityService');
    const txData = await liquidityService.prepareAddLiquidity(
      tokenA,
      tokenB,
      amountADesired,
      amountBDesired,
      userAddress,
      slippagePercent
    );
    
    console.log(`✅ [API] Prepared add liquidity transaction for ${userAddress}`);
    
    res.json({
      success: true,
      transaction: txData,
      message: 'Transaction prepared successfully. Send this transaction using your wallet.'
    });
  } catch (error) {
    console.error('❌ [API] Error preparing add liquidity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to prepare add liquidity transaction'
    });
  }
});

// POST /api/liquidity/approve - Approve LP tokens for remove liquidity
router.post("/liquidity/approve", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/liquidity/approve');
    
    const { tokenA, tokenB, userAddress } = req.body;
    
    // Validate required fields
    if (!tokenA || !tokenB || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenA, tokenB, userAddress'
      });
    }
    
    const liquidityService = require('./services/liquidityService');
    
    // Prepare approve transaction
    const approveData = await liquidityService.approveLiquidityTokens(
      tokenA,
      tokenB,
      userAddress
    );
    
    console.log(`✅ [API] Prepared approve transaction for ${userAddress}`);
    
    res.json({
      success: true,
      transaction: approveData,
      message: approveData.message || 'Transaction prepared successfully. Send this transaction using your wallet.'
    });
  } catch (error) {
    console.error('❌ [API] Error preparing approve:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to prepare approve transaction'
    });
  }
});

// POST /api/liquidity/remove - Prepare remove liquidity transaction
router.post("/liquidity/remove", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/liquidity/remove');
    
    const { tokenA, tokenB, liquidityAmount, userAddress, slippagePercent = 0.5 } = req.body;
    
    // Validate required fields
    if (!tokenA || !tokenB || !liquidityAmount || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenA, tokenB, liquidityAmount, userAddress'
      });
    }
    
    // Validate amounts
    if (parseFloat(liquidityAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Liquidity amount must be greater than 0'
      });
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenA) || !ethers.utils.isAddress(tokenB) || !ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const liquidityService = require('./services/liquidityService');
    const txData = await liquidityService.prepareRemoveLiquidity(
      tokenA,
      tokenB,
      liquidityAmount,
      userAddress,
      slippagePercent
    );
    
    console.log(`✅ [API] Prepared remove liquidity transaction for ${userAddress}`);
    
    res.json({
      success: true,
      transaction: txData,
      message: 'Transaction prepared successfully. Send this transaction using your wallet.'
    });
  } catch (error) {
    console.error('❌ [API] Error preparing remove liquidity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to prepare remove liquidity transaction'
    });
  }
});

// GET /api/liquidity/positions/:userAddress - Get user's liquidity positions
router.get("/liquidity/positions/:userAddress", async (req, res) => {
  console.log('🌐 [API] Received request: GET /api/liquidity/positions');
  console.log('📍 [API] User address:', req.params.userAddress);
  
  try {
    const { userAddress } = req.params;
    
    // Validate address format
    if (!ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const liquidityService = require('./services/liquidityService');
    console.log(`🔍 [API] Calling liquidity service for ${userAddress}`);
    const positions = await liquidityService.getUserLiquidityPositions(userAddress);
    console.log(`📊 [API] Service returned ${positions.positions.length} positions`);
    console.log(`📋 [API] First position:`, positions.positions[0]);
    
    console.log(`✅ [API] Retrieved liquidity positions for ${userAddress}`);
    
    res.json({
      success: true,
      positions,
      userAddress
    });
  } catch (error) {
    console.error('❌ [API] Error getting liquidity positions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get liquidity positions'
    });
  }
});

// GET /api/liquidity/pair/:tokenA/:tokenB - Get pair information
router.get("/liquidity/pair/:tokenA/:tokenB", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: GET /api/liquidity/pair');
    
    const { tokenA, tokenB } = req.params;
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenA) || !ethers.utils.isAddress(tokenB)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const liquidityService = require('./services/liquidityService');
    const pairInfo = await liquidityService.getPairInfo(tokenA, tokenB);
    
    // Get token info for both tokens
    const [tokenAInfo, tokenBInfo] = await Promise.all([
      liquidityService.getTokenInfo(tokenA),
      liquidityService.getTokenInfo(tokenB)
    ]);
    
    console.log(`✅ [API] Retrieved pair info for ${tokenA}/${tokenB}`);
    
    res.json({
      success: true,
      pair: {
        ...pairInfo,
        tokenA: {
          address: tokenA,
          ...tokenAInfo
        },
        tokenB: {
          address: tokenB,
          ...tokenBInfo
        }
      }
    });
  } catch (error) {
    console.error('❌ [API] Error getting pair info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get pair information'
    });
  }
});

// POST /api/swap/prepare - Prepare swap transaction with real data
router.post("/swap/prepare", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/swap/prepare');
    
    const { tokenIn, tokenOut, amountIn, userAddress, slippagePercent = 0.5 } = req.body;
    
    // Validate required fields
    if (!tokenIn || !tokenOut || !amountIn || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenIn, tokenOut, amountIn, userAddress'
      });
    }
    
    // Validate amounts
    if (parseFloat(amountIn) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenIn) || !ethers.utils.isAddress(tokenOut) || !ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const swapService = require('./services/swapService');
    const txData = await swapService.prepareSwap(
      tokenIn,
      tokenOut,
      amountIn,
      userAddress,
      slippagePercent
    );
    
    console.log(`✅ [API] Prepared swap transaction for ${userAddress}`);
    
    res.json({
      success: true,
      transaction: txData,
      message: 'Swap transaction prepared successfully. Send this transaction using your Dynamic wallet.'
    });
  } catch (error) {
    console.error('❌ [API] Error preparing swap:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to prepare swap transaction'
    });
  }
});

// POST /api/swap/quote - Get swap quote with real prices
router.post("/swap/quote", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: POST /api/swap/quote');
    
    const { tokenIn, tokenOut, amountIn } = req.body;
    
    // Validate required fields
    if (!tokenIn || !tokenOut || !amountIn) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: tokenIn, tokenOut, amountIn'
      });
    }
    
    // Validate amounts
    if (parseFloat(amountIn) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenIn) || !ethers.utils.isAddress(tokenOut)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const swapService = require('./services/swapService');
    const quote = await swapService.getSwapQuote(tokenIn, tokenOut, amountIn);
    
    console.log(`✅ [API] Generated swap quote for ${amountIn} ${quote.tokenIn.symbol}`);
    
    res.json({
      success: true,
      quote,
      message: 'Swap quote generated with real blockchain data'
    });
  } catch (error) {
    console.error('❌ [API] Error generating swap quote:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to generate swap quote'
    });
  }
});

// GET /api/swap/pairs - Get all available pairs with real data
router.get("/swap/pairs", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: GET /api/swap/pairs');
    
    const swapService = require('./services/swapService');
    const pairs = await swapService.getAvailablePairs();
    
    console.log(`✅ [API] Retrieved ${pairs.length} available pairs from Goldsky`);
    
    res.json({
      success: true,
      pairs,
      totalPairs: pairs.length,
      source: 'Goldsky Subgraph + Blockchain'
    });
  } catch (error) {
    console.error('❌ [API] Error getting swap pairs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get available pairs'
    });
  }
});

// GET /api/swap/balance/:tokenAddress/:userAddress - Get real token balance
router.get("/swap/balance/:tokenAddress/:userAddress", async (req, res) => {
  try {
    console.log('🌐 [API] Received request: GET /api/swap/balance');
    
    const { tokenAddress, userAddress } = req.params;
    
    // Validate address format
    if (!ethers.utils.isAddress(tokenAddress) || !ethers.utils.isAddress(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid address format'
      });
    }
    
    const swapService = require('./services/swapService');
    const [balance, tokenInfo] = await Promise.all([
      swapService.getTokenBalance(tokenAddress, userAddress),
      swapService.getTokenInfo(tokenAddress)
    ]);
    
    console.log(`✅ [API] Retrieved balance for ${userAddress}`);
    
    res.json({
      success: true,
      balance: ethers.utils.formatUnits(balance, tokenInfo.decimals),
      formattedBalance: `${ethers.utils.formatUnits(balance, tokenInfo.decimals)} ${tokenInfo.symbol}`,
      token: {
        address: tokenAddress,
        symbol: tokenInfo.symbol,
        name: tokenInfo.name,
        decimals: tokenInfo.decimals
      },
      userAddress
    });
  } catch (error) {
    console.error('❌ [API] Error getting token balance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to get token balance'
    });
  }
});

module.exports = router;
