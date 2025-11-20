interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
}

interface LiquidityPosition {
  pairAddress: string;
  token0: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  liquidityBalance: string;
  poolOwnership: string;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  valueUSD?: number;
}

interface AddLiquidityResponse {
  success: boolean;
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    tokenA: {
      address: string;
      symbol: string;
      decimals: number;
      amountDesired: string;
      amountMin: string;
      userBalance: string; // REAL balance from blockchain
    };
    tokenB: {
      address: string;
      symbol: string;
      decimals: number;
      amountDesired: string;
      amountMin: string;
      userBalance: string; // REAL balance from blockchain
    };
    deadline: number;
    slippagePercent: number;
    balanceCheck: string; // 'PASSED' if real balance validation passed
  };
  message: string;
}

interface ApproveResponse {
  approved?: boolean;
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  message: string;
}

interface RemoveLiquidityResponse {
  success: boolean;
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    tokenA: {
      address: string;
      symbol: string;
      decimals: number;
      expectedAmount: string;
      amountMin: string;
    };
    tokenB: {
      address: string;
      symbol: string;
      decimals: number;
      expectedAmount: string;
      amountMin: string;
    };
    liquidityAmount: string;
    userLpBalance: string; // REAL LP balance from blockchain
    deadline: number;
    slippagePercent: number;
  };
  message: string;
}

interface UserPositionsResponse {
  success: boolean;
  positions: LiquidityPosition[];
  totalValueUSD: string;
  totalLPBalance: string;
  userAddress: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

class LiquidityService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Get REAL token balance from blockchain
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<TokenBalance> {
    try {
      console.log(`🔍 Fetching REAL balance for token ${tokenAddress}...`);
      
      const response = await fetch(`${this.baseURL}/api/swap/balance/${tokenAddress}/${userAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get token balance');
      }

      console.log(`✅ Real balance retrieved: ${result.balance} ${result.token.symbol}`);
      
      return {
        address: result.token.address,
        symbol: result.token.symbol,
        name: result.token.name,
        decimals: result.token.decimals,
        balance: result.balance,
        formattedBalance: result.formattedBalance
      };
    } catch (error) {
      console.error('❌ Error fetching real token balance:', error);
      throw error;
    }
  }

  /**
   * Get user's REAL liquidity positions from Goldsky subgraph
   */
  async getUserLiquidityPositions(userAddress: string): Promise<UserPositionsResponse> {
    try {
      console.log(`🔍 Fetching REAL liquidity positions for ${userAddress}...`);
      
      const response = await fetch(`${this.baseURL}/api/liquidity/positions/${userAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get liquidity positions');
      }

      console.log(`✅ Retrieved ${result.positions.length} REAL liquidity positions`);
      
      return result;
    } catch (error) {
      console.error('❌ Error fetching real liquidity positions:', error);
      throw error;
    }
  }

  /**
   * Prepare add liquidity transaction with REAL balance validation
   */
  async prepareAddLiquidity(
    tokenA: string,
    tokenB: string,
    amountADesired: string,
    amountBDesired: string,
    userAddress: string,
    slippagePercent: number = 0.5
  ): Promise<AddLiquidityResponse> {
    try {
      console.log('🔍 Preparing add liquidity with REAL balance validation...');
      
      const response = await fetch(`${this.baseURL}/api/liquidity/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenA,
          tokenB,
          amountADesired,
          amountBDesired,
          userAddress,
          slippagePercent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to prepare add liquidity');
      }

      console.log(`✅ Add liquidity prepared with REAL balance check: ${result.transaction.balanceCheck}`);
      console.log(`✅ Real Token A balance: ${result.transaction.tokenA.userBalance} ${result.transaction.tokenA.symbol}`);
      console.log(`✅ Real Token B balance: ${result.transaction.tokenB.userBalance} ${result.transaction.tokenB.symbol}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error preparing add liquidity:', error);
      throw error;
    }
  }

  /**
   * Approve LP tokens for remove liquidity
   */
  async approveLiquidityTokens(
    tokenA: string,
    tokenB: string,
    userAddress: string
  ): Promise<ApproveResponse> {
    try {
      console.log('🔍 Checking LP token allowance...');
      
      const response = await fetch(`${this.baseURL}/api/liquidity/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenA,
          tokenB,
          userAddress
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to prepare approve transaction');
      }

      return result.transaction;
    } catch (error) {
      console.error('❌ Error preparing approve transaction:', error);
      throw error;
    }
  }

  /**
   * Prepare remove liquidity transaction with REAL balance validation
   */
  async prepareRemoveLiquidity(
    tokenA: string,
    tokenB: string,
    liquidityAmount: string,
    userAddress: string,
    slippagePercent: number = 0.5
  ): Promise<RemoveLiquidityResponse> {
    try {
      console.log('🔍 Preparing remove liquidity with REAL balance validation...');
      
      const response = await fetch(`${this.baseURL}/api/liquidity/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenA,
          tokenB,
          liquidityAmount,
          userAddress,
          slippagePercent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to prepare remove liquidity');
      }

      console.log(`✅ Remove liquidity prepared with REAL LP balance: ${result.transaction.userLpBalance}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error preparing remove liquidity:', error);
      throw error;
    }
  }

  /**
   * Calculate liquidity value based on REAL pool data
   */
  async calculateLiquidityValue(
    token0Amount: string,
    token1Amount: string,
    token0Address: string,
    token1Address: string
  ): Promise<{ token0ValueUSD: number; token1ValueUSD: number; totalValueUSD: number }> {
    try {
      console.log('🔍 Calculating REAL liquidity value...');
      
      // Get real prices from backend
      const pricingResponse = await fetch(`${this.baseURL}/api/pools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!pricingResponse.ok) {
        throw new Error(`Failed to get pricing data: ${pricingResponse.status}`);
      }

      const pricingResult = await pricingResponse.json();
      
      if (!pricingResult.success) {
        throw new Error(pricingResult.error || 'Failed to get pricing data');
      }

      // Find the pool for our token pair
      const pool = pricingResult.data.find((p: any) => 
        (p.token0Address === token0Address && p.token1Address === token1Address) ||
        (p.token0Address === token1Address && p.token1Address === token0Address)
      );

      if (!pool) {
        throw new Error('Pool not found for token pair');
      }

      const priceUSD = parseFloat(pool.priceUSD);
      
      // Calculate values based on real prices
      const token0ValueUSD = parseFloat(token0Amount) * priceUSD;
      const token1ValueUSD = parseFloat(token1Amount) * priceUSD;
      const totalValueUSD = token0ValueUSD + token1ValueUSD;

      console.log(`✅ REAL liquidity value calculated: $${totalValueUSD.toFixed(2)}`);
      
      return {
        token0ValueUSD,
        token1ValueUSD,
        totalValueUSD
      };
    } catch (error) {
      console.error('❌ Error calculating real liquidity value:', error);
      throw error;
    }
  }

  /**
   * Format balance for display
   */
  formatBalance(balance: string, decimals: number, symbol: string): string {
    const numBalance = parseFloat(balance);
    
    if (numBalance === 0) return `0 ${symbol}`;
    
    if (numBalance < 0.000001) {
      return `${numBalance.toExponential(2)} ${symbol}`;
    } else if (numBalance < 0.001) {
      return `${numBalance.toFixed(6)} ${symbol}`;
    } else if (numBalance < 1) {
      return `${numBalance.toFixed(4)} ${symbol}`;
    } else if (numBalance < 1000) {
      return `${numBalance.toFixed(2)} ${symbol}`;
    } else {
      return `${numBalance.toLocaleString()} ${symbol}`;
    }
  }

  /**
   * Format USD value for display
   */
  formatUSDValue(value: number): string {
    if (value === 0) return '$0.00';
    
    if (value < 0.01) {
      return `$${value.toFixed(4)}`;
    } else if (value < 1) {
      return `$${value.toFixed(2)}`;
    } else if (value < 1000) {
      return `$${value.toFixed(2)}`;
    } else if (value < 1000000) {
      return `$${(value / 1000).toFixed(1)}K`;
    } else {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
  }
}

export const liquidityService = new LiquidityService();
export type { 
  TokenBalance, 
  LiquidityPosition, 
  AddLiquidityResponse, 
  RemoveLiquidityResponse, 
  UserPositionsResponse 
};
