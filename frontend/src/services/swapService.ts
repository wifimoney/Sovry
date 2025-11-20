interface SwapQuote {
  tokenIn: {
    address: string;
    symbol: string;
    amountIn: string;
  };
  tokenOut: {
    address: string;
    symbol: string;
    expectedAmountOut: string;
  };
  priceImpact: string;
  route: string[];
  reserves: {
    [key: string]: string;
  };
}

interface PrepareSwapResponse {
  success: boolean;
  transaction: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    tokenIn: {
      address: string;
      symbol: string;
      decimals: number;
      amountIn: string;
      userBalance: string; // REAL balance from blockchain
    };
    tokenOut: {
      address: string;
      symbol: string;
      decimals: number;
      expectedAmountOut: string;
      amountOutMin: string;
    };
    path: string[];
    deadline: number;
    slippagePercent: number;
    balanceCheck: string; // 'PASSED' if real balance validation passed
  };
  message: string;
}

interface AvailablePair {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  volumeUSD: string;
  priceUSD?: number;
}

interface PairsResponse {
  success: boolean;
  pairs: AvailablePair[];
  totalPairs: number;
  source: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

class SwapService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  /**
   * Get REAL swap quote from blockchain
   */
  async getSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<SwapQuote> {
    try {
      console.log(`🔍 Getting REAL swap quote for ${amountIn} tokens...`);
      
      const response = await fetch(`${this.baseURL}/api/swap/quote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to get swap quote');
      }

      console.log(`✅ Real swap quote: ${amountIn} ${result.quote.tokenIn.symbol} → ${result.quote.tokenOut.expectedAmountOut} ${result.quote.tokenOut.symbol}`);
      console.log(`✅ Real price impact: ${result.quote.priceImpact}`);
      
      return result.quote;
    } catch (error) {
      console.error('❌ Error getting real swap quote:', error);
      throw error;
    }
  }

  /**
   * Prepare swap transaction with REAL balance validation
   */
  async prepareSwap(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    userAddress: string,
    slippagePercent: number = 0.5
  ): Promise<PrepareSwapResponse> {
    try {
      console.log('🔍 Preparing swap with REAL balance validation...');
      
      const response = await fetch(`${this.baseURL}/api/swap/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenIn,
          tokenOut,
          amountIn,
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
        throw new Error(result.error || 'Failed to prepare swap');
      }

      console.log(`✅ Swap prepared with REAL balance check: ${result.transaction.balanceCheck}`);
      console.log(`✅ Real Token In balance: ${result.transaction.tokenIn.userBalance} ${result.transaction.tokenIn.symbol}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error preparing swap:', error);
      throw error;
    }
  }

  /**
   * Get all available pairs with REAL data from Goldsky
   */
  async getAvailablePairs(): Promise<PairsResponse> {
    try {
      console.log('🔍 Fetching REAL available pairs from Goldsky...');
      
      const response = await fetch(`${this.baseURL}/api/swap/pairs`, {
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
        throw new Error(result.error || 'Failed to get available pairs');
      }

      console.log(`✅ Retrieved ${result.pairs.length} REAL pairs from ${result.source}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error getting real available pairs:', error);
      throw error;
    }
  }

  /**
   * Get REAL token balance for swap
   */
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<{
    balance: string;
    formattedBalance: string;
    token: {
      address: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    userAddress: string;
  }> {
    try {
      console.log(`🔍 Fetching REAL token balance for swap...`);
      
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

      console.log(`✅ Real balance for swap: ${result.formattedBalance}`);
      
      return result;
    } catch (error) {
      console.error('❌ Error getting real token balance for swap:', error);
      throw error;
    }
  }

  /**
   * Calculate minimum output with slippage
   */
  calculateMinimumOutput(amountOut: string, slippagePercent: number): string {
    const amount = parseFloat(amountOut);
    const minAmount = amount * (1 - slippagePercent / 100);
    return minAmount.toString();
  }

  /**
   * Format swap amount for display
   */
  formatSwapAmount(amount: string, symbol: string): string {
    const numAmount = parseFloat(amount);
    
    if (numAmount === 0) return `0 ${symbol}`;
    
    if (numAmount < 0.000001) {
      return `${numAmount.toExponential(2)} ${symbol}`;
    } else if (numAmount < 0.001) {
      return `${numAmount.toFixed(6)} ${symbol}`;
    } else if (numAmount < 1) {
      return `${numAmount.toFixed(4)} ${symbol}`;
    } else if (numAmount < 1000) {
      return `${numAmount.toFixed(2)} ${symbol}`;
    } else {
      return `${numAmount.toLocaleString()} ${symbol}`;
    }
  }

  /**
   * Format price impact for display
   */
  formatPriceImpact(priceImpact: string): string {
    const impact = parseFloat(priceImpact.replace('%', ''));
    
    if (impact < 0.01) {
      return '< 0.01%';
    } else if (impact < 1) {
      return `${impact.toFixed(2)}%`;
    } else {
      return `${impact.toFixed(1)}%`;
    }
  }

  /**
   * Check if price impact is too high
   */
  isPriceImpactTooHigh(priceImpact: string, threshold: number = 5): boolean {
    const impact = parseFloat(priceImpact.replace('%', ''));
    return impact > threshold;
  }

  /**
   * Get reverse swap quote (for output amount input)
   */
  async getReverseSwapQuote(
    tokenIn: string,
    tokenOut: string,
    amountOut: string
  ): Promise<SwapQuote> {
    try {
      console.log('🔍 Getting REAL reverse swap quote...');
      
      // For reverse quote, we need to estimate the input amount
      // This would typically involve binary search or contract calls
      // For now, we'll use a simple approximation
      
      const forwardQuote = await this.getSwapQuote(tokenIn, tokenOut, '1');
      const rate = parseFloat(forwardQuote.tokenOut.expectedAmountOut);
      const estimatedInput = (parseFloat(amountOut) / rate).toString();
      
      return await this.getSwapQuote(tokenIn, tokenOut, estimatedInput);
    } catch (error) {
      console.error('❌ Error getting real reverse swap quote:', error);
      throw error;
    }
  }
}

export const swapService = new SwapService();
export type { 
  SwapQuote, 
  PrepareSwapResponse, 
  AvailablePair, 
  PairsResponse 
};
