// Define Pool interface locally to avoid circular dependencies
interface Pool {
  id: string;
  token0: { symbol: string; name: string; id: string };
  token1: { symbol: string; name: string; id: string };
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  volumeUSD: string;
  txCount: string;
  createdAtTimestamp: string;
  tvlUSD?: number;
}

export interface LiquidityAnalytics {
  apr: number
  feeApr: number
  volume24h: number
  volume7d: number
  impermanentLossRisk: 'low' | 'medium' | 'high'
  priceImpact: number
  estimatedReturns: {
    daily: number
    weekly: number
    monthly: number
    yearly: number
  }
}

export class LiquidityAnalyticsService {
  // Calculate APR based on pool performance
  static calculateAPR(pool: Pool): number {
    try {
      const volumeUSD = parseFloat(pool.volumeUSD || '0')
      const tvlUSD = pool.tvlUSD || 0
      
      if (tvlUSD === 0) return 0
      
      // Typical fee rate for DEX (0.3% per trade)
      const feeRate = 0.003
      const dailyFees = volumeUSD * feeRate
      const yearlyFees = dailyFees * 365
      
      // APR = (Yearly Fees / TVL) * 100
      const apr = (yearlyFees / tvlUSD) * 100
      
      // Add potential rewards/incentives (placeholder)
      const rewardsAPR = 5 // 5% rewards APR placeholder
      
      return Math.max(0, apr + rewardsAPR)
    } catch (error) {
      console.error('Failed to calculate APR:', error)
      return 0
    }
  }

  // Calculate fee APR specifically
  static calculateFeeAPR(pool: Pool): number {
    try {
      const volumeUSD = parseFloat(pool.volumeUSD || '0')
      const tvlUSD = pool.tvlUSD || 0
      
      if (tvlUSD === 0) return 0
      
      const feeRate = 0.003
      const dailyFees = volumeUSD * feeRate
      const yearlyFees = dailyFees * 365
      
      return (yearlyFees / tvlUSD) * 100
    } catch (error) {
      console.error('Failed to calculate fee APR:', error)
      return 0
    }
  }

  // Assess impermanent loss risk
  static assessImpermanentLossRisk(pool: Pool): 'low' | 'medium' | 'high' {
    try {
      const reserve0 = parseFloat(pool.reserve0 || '0')
      const reserve1 = parseFloat(pool.reserve1 || '1')
      
      if (reserve0 === 0 || reserve1 === 0) return 'high'
      
      // Calculate price ratio
      const priceRatio = reserve1 / reserve0
      
      // Check if tokens are stable pairs (low volatility)
      const isStablePair = this.isStablePair(pool.token0.symbol, pool.token1.symbol)
      if (isStablePair) return 'low'
      
      // Check if it's a major pair (moderate volatility)
      const isMajorPair = this.isMajorPair(pool.token0.symbol, pool.token1.symbol)
      if (isMajorPair) return 'medium'
      
      // Default to high for exotic pairs
      return 'high'
    } catch (error) {
      console.error('Failed to assess IL risk:', error)
      return 'high'
    }
  }

  // Calculate price impact for a given trade size
  static calculatePriceImpact(pool: Pool, amount0: string, amount1: string): number {
    try {
      const reserve0 = parseFloat(pool.reserve0 || '0')
      const reserve1 = parseFloat(pool.reserve1 || '1')
      const inputAmount0 = parseFloat(amount0 || '0')
      const inputAmount1 = parseFloat(amount1 || '0')
      
      if (reserve0 === 0 || reserve1 === 0) return 100
      
      // Calculate price impact using constant product formula
      const newReserve0 = reserve0 + inputAmount0
      const newReserve1 = reserve1 + inputAmount1
      
      const oldPrice = reserve1 / reserve0
      const newPrice = newReserve1 / newReserve0
      
      const priceImpact = Math.abs((newPrice - oldPrice) / oldPrice) * 100
      
      return Math.min(priceImpact, 100) // Cap at 100%
    } catch (error) {
      console.error('Failed to calculate price impact:', error)
      return 0
    }
  }

  // Calculate estimated returns based on APR
  static calculateEstimatedReturns(apr: number, liquidityAmount: number): {
    daily: number
    weekly: number
    monthly: number
    yearly: number
  } {
    try {
      const dailyReturn = (liquidityAmount * apr) / 36500
      const weeklyReturn = dailyReturn * 7
      const monthlyReturn = dailyReturn * 30
      const yearlyReturn = liquidityAmount * (apr / 100)
      
      return {
        daily: Math.max(0, dailyReturn),
        weekly: Math.max(0, weeklyReturn),
        monthly: Math.max(0, monthlyReturn),
        yearly: Math.max(0, yearlyReturn)
      }
    } catch (error) {
      console.error('Failed to calculate estimated returns:', error)
      return {
        daily: 0,
        weekly: 0,
        monthly: 0,
        yearly: 0
      }
    }
  }

  // Get comprehensive analytics for a pool
  static getPoolAnalytics(pool: Pool): LiquidityAnalytics {
    const apr = this.calculateAPR(pool)
    const feeApr = this.calculateFeeAPR(pool)
    const tvlUSD = pool.tvlUSD || 0
    
    return {
      apr,
      feeApr,
      volume24h: parseFloat(pool.volumeUSD || '0'),
      volume7d: parseFloat(pool.volumeUSD || '0') * 7, // Estimate
      impermanentLossRisk: this.assessImpermanentLossRisk(pool),
      priceImpact: 0, // Will be calculated per trade
      estimatedReturns: this.calculateEstimatedReturns(apr, tvlUSD)
    }
  }

  // Helper methods for pair classification
  private static isStablePair(symbol0: string, symbol1: string): boolean {
    const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'USDP']
    return stablecoins.includes(symbol0) && stablecoins.includes(symbol1)
  }

  private static isMajorPair(symbol0: string, symbol1: string): boolean {
    const majorTokens = ['WETH', 'ETH', 'WBTC', 'BTC', 'WIP', 'IP', 'USDT', 'USDC']
    return majorTokens.includes(symbol0) && majorTokens.includes(symbol1)
  }

  // Format APR for display
  static formatAPR(apr: number): string {
    if (apr === 0) return '0.00%'
    if (apr < 0.01) return '<0.01%'
    if (apr < 1) return `${apr.toFixed(2)}%`
    if (apr < 100) return `${apr.toFixed(1)}%`
    return `${apr.toFixed(0)}%`
  }

  // Get risk level color
  static getRiskLevelColor(risk: 'low' | 'medium' | 'high'): string {
    switch (risk) {
      case 'low': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'high': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  // Get risk level badge variant
  static getRiskLevelBadgeVariant(risk: 'low' | 'medium' | 'high'): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (risk) {
      case 'low': return 'default'
      case 'medium': return 'secondary'
      case 'high': return 'destructive'
      default: return 'outline'
    }
  }
}
