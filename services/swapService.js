require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

class SwapService {
  constructor() {
    // Story Protocol Aeneid Testnet RPC
    this.rpcUrl = process.env.RPC_PROVIDER_URL || 'https://aeneid.storyrpc.io';
    this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    
    // Uniswap V2 Router ABI
    this.routerABI = [
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
      'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
      'function factory() external pure returns (address)',
      'function WETH() external pure returns (address)'
    ];
    
    // ERC20 ABI
    this.erc20ABI = [
      'function balanceOf(address account) view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) returns (bool)',
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)'
    ];
    
    // Uniswap V2 Pair ABI
    this.pairABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function totalSupply() external view returns (uint)'
    ];
    
    this.routerAddress = process.env.UNISWAP_V2_ROUTER_ADDRESS;
    this.factoryAddress = process.env.UNISWAP_V2_FACTORY_ADDRESS;
  }
  
  /**
   * Get real token information from blockchain
   */
  async getTokenInfo(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);
      
      return { name, symbol, decimals };
    } catch (error) {
      console.error('❌ Error getting token info from blockchain:', error);
      throw error;
    }
  }
  
  /**
   * Get user's real token balance from blockchain
   */
  async getTokenBalance(tokenAddress, userAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, this.erc20ABI, this.provider);
      const balance = await tokenContract.balanceOf(userAddress);
      return balance.toString();
    } catch (error) {
      console.error('❌ Error getting token balance from blockchain:', error);
      throw error;
    }
  }
  
  /**
   * Get real pair reserves from blockchain
   */
  async getPairReserves(tokenA, tokenB) {
    try {
      // Get pair address from factory
      const factoryContract = new ethers.Contract(
        this.factoryAddress,
        ['function getPair(address tokenA, address tokenB) external view returns (address pair)'],
        this.provider
      );
      
      const pairAddress = await factoryContract.getPair(tokenA, tokenB);
      
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error('Pair does not exist');
      }
      
      const pairContract = new ethers.Contract(pairAddress, this.pairABI, this.provider);
      
      const [reserves, token0, token1] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1()
      ]);
      
      return {
        pairAddress,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        token0,
        token1
      };
    } catch (error) {
      console.error('❌ Error getting pair reserves from blockchain:', error);
      throw error;
    }
  }
  
  /**
   * Calculate swap output amount using real reserves
   */
  calculateSwapOutput(amountIn, reserveIn, reserveOut) {
    // Uniswap V2 formula: amountOut = amountIn * reserveOut * 997 / (reserveIn * 1000 + amountIn * 997)
    const amountInWithFee = amountIn * 997;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 1000) + amountInWithFee;
    const amountOut = numerator / denominator;
    
    return amountOut.toString();
  }
  
  /**
   * Get swap amounts from router contract
   */
  async getSwapAmounts(amountIn, path) {
    try {
      const routerContract = new ethers.Contract(this.routerAddress, this.routerABI, this.provider);
      const amounts = await routerContract.getAmountsOut(amountIn, path);
      return amounts.map(amount => amount.toString());
    } catch (error) {
      console.error('❌ Error getting swap amounts from router:', error);
      throw error;
    }
  }
  
  /**
   * Prepare swap transaction with real data
   */
  async prepareSwap(tokenIn, tokenOut, amountIn, userAddress, slippagePercent = 0.5) {
    try {
      // Get real token info
      const [tokenInInfo, tokenOutInfo] = await Promise.all([
        this.getTokenInfo(tokenIn),
        this.getTokenInfo(tokenOut)
      ]);
      
      // Get REAL user balance from blockchain
      const userBalance = await this.getTokenBalance(tokenIn, userAddress);
      
      // Convert amount to wei
      const amountInWei = ethers.utils.parseUnits(amountIn.toString(), tokenInInfo.decimals);
      
      // VALIDATE: Check if user has REAL balance
      if (amountInWei > userBalance) {
        throw new Error(`Insufficient ${tokenInInfo.symbol} balance. You have ${ethers.utils.formatUnits(userBalance, tokenInInfo.decimals)} ${tokenInInfo.symbol}, but trying to swap ${amountIn} ${tokenInInfo.symbol}`);
      }
      
      console.log(`✅ Balance Check Passed - User has ${ethers.utils.formatUnits(userBalance, tokenInInfo.decimals)} ${tokenInInfo.symbol}`);
      
      // Create path for swap
      const path = [tokenIn, tokenOut];
      
      // Get expected output amounts from router
      const amounts = await this.getSwapAmounts(amountInWei, path);
      const expectedAmountOut = amounts[amounts.length - 1];
      
      // Calculate minimum amount with slippage
      const slippageMultiplier = (100 - slippagePercent) / 100;
      const amountOutMin = (expectedAmountOut * slippageMultiplier).toString();
      
      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + (20 * 60);
      
      // Create router contract instance
      const routerContract = new ethers.Contract(this.routerAddress, this.routerABI, this.provider);
      
      // Encode transaction data
      const txData = routerContract.interface.encodeFunctionData('swapExactTokensForTokens', [
        amountInWei,
        amountOutMin,
        path,
        userAddress,
        deadline
      ]);
      
      return {
        to: this.routerAddress,
        data: txData,
        value: '0', // No ETH for ERC20 swaps
        gasLimit: '200000', // Estimated gas limit
        tokenIn: {
          address: tokenIn,
          symbol: tokenInInfo.symbol,
          decimals: tokenInInfo.decimals,
          amountIn: amountIn,
          userBalance: ethers.utils.formatUnits(userBalance, tokenInInfo.decimals) // REAL balance
        },
        tokenOut: {
          address: tokenOut,
          symbol: tokenOutInfo.symbol,
          decimals: tokenOutInfo.decimals,
          expectedAmountOut: ethers.utils.formatUnits(expectedAmountOut, tokenOutInfo.decimals),
          amountOutMin: ethers.utils.formatUnits(amountOutMin, tokenOutInfo.decimals)
        },
        path,
        deadline,
        slippagePercent,
        balanceCheck: 'PASSED' // Real balance validation passed
      };
    } catch (error) {
      console.error('❌ Error preparing swap:', error);
      throw error;
    }
  }
  
  /**
   * Get swap quote without executing
   */
  async getSwapQuote(tokenIn, tokenOut, amountIn) {
    try {
      // Get real token info
      const [tokenInInfo, tokenOutInfo] = await Promise.all([
        this.getTokenInfo(tokenIn),
        this.getTokenInfo(tokenOut)
      ]);
      
      // Convert amount to wei
      const amountInWei = ethers.utils.parseUnits(amountIn.toString(), tokenInInfo.decimals);
      
      // Create path for swap
      const path = [tokenIn, tokenOut];
      
      // Get expected output amounts from router
      const amounts = await this.getSwapAmounts(amountInWei, path);
      const expectedAmountOut = amounts[amounts.length - 1];
      
      // Get price impact using real reserves
      const reserves = await this.getPairReserves(tokenIn, tokenOut);
      const isToken0In = reserves.token0.toLowerCase() === tokenIn.toLowerCase();
      const reserveIn = isToken0In ? reserves.reserve0 : reserves.reserve1;
      const reserveOut = isToken0In ? reserves.reserve1 : reserves.reserve0;
      
      // Calculate price impact
      const priceImpact = ((parseFloat(amountInWei) / (parseFloat(reserveIn) + parseFloat(amountInWei))) * 100).toFixed(2);
      
      return {
        tokenIn: {
          address: tokenIn,
          symbol: tokenInInfo.symbol,
          amountIn
        },
        tokenOut: {
          address: tokenOut,
          symbol: tokenOutInfo.symbol,
          expectedAmountOut: ethers.utils.formatUnits(expectedAmountOut, tokenOutInfo.decimals)
        },
        priceImpact: `${priceImpact}%`,
        route: [tokenInInfo.symbol, tokenOutInfo.symbol],
        reserves: {
          [tokenInInfo.symbol]: ethers.utils.formatUnits(reserveIn, tokenInInfo.decimals),
          [tokenOutInfo.symbol]: ethers.utils.formatUnits(reserveOut, tokenOutInfo.decimals)
        }
      };
    } catch (error) {
      console.error('❌ Error getting swap quote:', error);
      throw error;
    }
  }
  
  /**
   * Get all available pairs from Goldsky (real data)
   */
  async getAvailablePairs() {
    try {
      const pricingService = require('./pricingService');
      const pools = await pricingService.getPoolsFromGoldsky();
      
      // Get token info for each pool
      const enrichedPools = await Promise.all(pools.map(async (pool) => {
        const [token0Info, token1Info] = await Promise.all([
          this.getTokenInfo(pool.token0.id),
          this.getTokenInfo(pool.token1.id)
        ]);
        
        return {
          ...pool,
          token0: {
            ...pool.token0,
            ...token0Info
          },
          token1: {
            ...pool.token1,
            ...token1Info
          }
        };
      }));
      
      return enrichedPools;
    } catch (error) {
      console.error('❌ Error getting available pairs:', error);
      throw error;
    }
  }
}

module.exports = new SwapService();
