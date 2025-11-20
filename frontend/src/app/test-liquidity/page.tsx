'use client'

import { useState } from 'react'
import { LiquidityManager } from '@/components/liquidity/LiquidityManager'
import { LiquidityAnalyticsService } from '@/services/liquidityAnalytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Droplets, TrendingUp, DollarSign, AlertCircle, Info } from 'lucide-react'

// Mock pool data for testing
const mockPool = {
  id: '0x1234567890abcdef1234567890abcdef12345678',
  token0: {
    id: '0x1514000000000000000000000000000000000000',
    symbol: 'WIP',
    name: 'Wrapped IP'
  },
  token1: {
    id: '0xb6b837972cfb487451a71279fa78c327bb27646e',
    symbol: 'RT',
    name: 'Royalty Token'
  },
  reserve0: '1000.50',
  reserve1: '2500.75',
  totalSupply: '5000.00',
  volumeUSD: '50000.00',
  txCount: '1250',
  createdAtTimestamp: '1640995200',
  // Pricing data
  token0Price: 1.25,
  token1Price: 0.50,
  token0PriceUSD: 1.25,
  token1PriceUSD: 0.50,
  tvlUSD: 2500.88,
  // Liquidity data
  apr: 12.5,
  feeApr: 7.5,
  userLpBalance: '150.25',
  userSharePercentage: 3.005
}

export default function TestLiquidityPage() {
  const [selectedPool] = useState(mockPool)
  
  // Get analytics for the pool
  const analytics = LiquidityAnalyticsService.getPoolAnalytics(selectedPool)
  const riskLevel = LiquidityAnalyticsService.assessImpermanentLossRisk(selectedPool)

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Liquidity Management Test</h1>
        <p className="text-gray-600">
          Test the professional liquidity management workflow with APR calculations and analytics
        </p>
      </div>

      {/* Pool Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Droplets className="h-5 w-5 text-blue-500" />
              <span>{selectedPool.token0.symbol} / {selectedPool.token1.symbol}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                APR: {LiquidityAnalyticsService.formatAPR(selectedPool.apr || 0)}
              </Badge>
              <Badge variant={LiquidityAnalyticsService.getRiskLevelBadgeVariant(riskLevel)}>
                Risk: {riskLevel}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">TVL</p>
              <p className="text-lg font-semibold text-blue-600">
                ${selectedPool.tvlUSD?.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Volume 24h</p>
              <p className="text-lg font-semibold text-green-600">
                ${parseFloat(selectedPool.volumeUSD).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fee APR</p>
              <p className="text-lg font-semibold text-green-600">
                {LiquidityAnalyticsService.formatAPR(selectedPool.feeApr || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Position</p>
              <p className="text-lg font-semibold text-blue-600">
                {selectedPool.userLpBalance} LP
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Details */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total APR:</span>
                <span className="font-semibold text-green-600">
                  {LiquidityAnalyticsService.formatAPR(analytics.apr)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Fee APR:</span>
                <span className="font-semibold text-blue-600">
                  {LiquidityAnalyticsService.formatAPR(analytics.feeApr)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Rewards APR:</span>
                <span className="font-semibold text-purple-600">
                  {LiquidityAnalyticsService.formatAPR(analytics.apr - analytics.feeApr)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="text-sm font-medium mb-2">Estimated Returns on $1,000:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Daily:</span>
                  <span className="font-medium">${analytics.estimatedReturns.daily.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Weekly:</span>
                  <span className="font-medium">${analytics.estimatedReturns.weekly.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly:</span>
                  <span className="font-medium">${analytics.estimatedReturns.monthly.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Yearly:</span>
                  <span className="font-semibold text-green-600">
                    ${analytics.estimatedReturns.yearly.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Risk Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Impermanent Loss Risk:</span>
                <Badge variant={LiquidityAnalyticsService.getRiskLevelBadgeVariant(riskLevel)}>
                  {riskLevel.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pair Type:</span>
                <span className="font-medium">
                  {riskLevel === 'low' ? 'Stable Pair' : riskLevel === 'medium' ? 'Major Pair' : 'Exotic Pair'}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Risk Information:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• {riskLevel === 'low' ? 'Low volatility expected' : riskLevel === 'medium' ? 'Moderate volatility expected' : 'High volatility expected'}</li>
                    <li>• Consider impermanent loss when providing liquidity</li>
                    <li>• Higher APR often comes with higher risk</li>
                    <li>• Diversify across multiple pools to reduce risk</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liquidity Manager */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Liquidity Manager Interface</h2>
        <LiquidityManager pool={selectedPool} />
      </div>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Pool Information</h4>
              <div className="space-y-1 text-gray-600">
                <p><strong>Pool Address:</strong> {selectedPool.id.slice(0, 10)}...{selectedPool.id.slice(-8)}</p>
                <p><strong>Token0:</strong> {selectedPool.token0.symbol} ({selectedPool.token0.name})</p>
                <p><strong>Token1:</strong> {selectedPool.token1.symbol} ({selectedPool.token1.name})</p>
                <p><strong>Reserve0:</strong> {selectedPool.reserve0}</p>
                <p><strong>Reserve1:</strong> {selectedPool.reserve1}</p>
                <p><strong>Total Supply:</strong> {selectedPool.totalSupply} LP</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Calculations</h4>
              <div className="space-y-1 text-gray-600">
                <p><strong>Current Price:</strong> {(parseFloat(selectedPool.reserve1) / parseFloat(selectedPool.reserve0)).toFixed(6)} {selectedPool.token1.symbol}/{selectedPool.token0.symbol}</p>
                <p><strong>TVL Calculation:</strong> ({selectedPool.reserve0} × ${selectedPool.token0PriceUSD}) + ({selectedPool.reserve1} × ${selectedPool.token1PriceUSD})</p>
                <p><strong>Fee APR:</strong> (Volume × 0.3% × 365) / TVL</p>
                <p><strong>Your Share:</strong> {selectedPool.userSharePercentage}% of pool</p>
                <p><strong>Your Value:</strong> ${(parseFloat(selectedPool.userLpBalance) / parseFloat(selectedPool.totalSupply) * selectedPool.tvlUSD!).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
