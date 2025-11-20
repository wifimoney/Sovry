'use client'

import { useState, useEffect } from 'react'
import { pricingService, PricingData } from '@/services/pricingService'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, RefreshCw, TrendingUp, Database } from 'lucide-react'

export default function TestPricingPage() {
  const [pricingData, setPricingData] = useState<PricingData | null>(null)
  const [ipPrice, setIpPrice] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const fetchPricingData = async (forceRefresh = false) => {
    setLoading(true)
    setError('')
    
    try {
      console.log('🔍 Fetching pricing data...')
      
      // Get all pricing data
      const pricing = await pricingService.getAllTokenPrices(!forceRefresh)
      if (pricing) {
        setPricingData(pricing)
        console.log('✅ Pricing data loaded:', pricing)
      } else {
        setError('Failed to fetch pricing data')
      }

      // Get IP price specifically
      const ip = await pricingService.getIPPrice()
      setIpPrice(ip)
      
    } catch (err) {
      console.error('❌ Error fetching pricing data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const refreshPrices = async () => {
    setLoading(true)
    try {
      const refreshed = await pricingService.refreshPrices()
      if (refreshed) {
        setPricingData(refreshed)
        console.log('✅ Prices refreshed successfully')
      }
    } catch (err) {
      console.error('❌ Error refreshing prices:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh prices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPricingData()
  }, [])

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Pricing System Test</h1>
        <p className="text-gray-600">
          Test the integration between Storyscan API (IP price) and Goldsky data (token ratios)
        </p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 justify-center">
        <Button
          onClick={() => fetchPricingData(false)}
          disabled={loading}
          variant="outline"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
          Load Pricing Data
        </Button>
        
        <Button
          onClick={() => fetchPricingData(true)}
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Force Refresh
        </Button>
        
        <Button
          onClick={refreshPrices}
          disabled={loading}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Refresh Backend Cache
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-red-600">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* IP Price Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            IP Token Price (Storyscan)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {ipPrice > 0 ? pricingService.formatPrice(ipPrice) : 'Not loaded'}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Base price from Storyscan API /api/v2/stats
          </p>
        </CardContent>
      </Card>

      {/* Pricing Data Overview */}
      {pricingData && (
        <Card>
          <CardHeader>
            <CardTitle>Pricing Data Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">IP Price</p>
                <p className="text-lg font-semibold text-green-600">
                  {pricingService.formatPrice(pricingData.ipPrice)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pools Count</p>
                <p className="text-lg font-semibold">{pricingData.pools.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Token Types</p>
                <p className="text-lg font-semibold">{Object.keys(pricingData.tokenPrices).length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-sm">{new Date(pricingData.lastUpdated).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token Prices */}
      {pricingData && Object.keys(pricingData.tokenPrices).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Token Prices (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(pricingData.tokenPrices).map(([symbol, price]) => (
                <div key={symbol} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{symbol}</Badge>
                    <span className="font-semibold text-green-600">
                      {pricingService.formatPrice(price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pool Details */}
      {pricingData && pricingData.pools.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pool Details with TVL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pricingData.pools.slice(0, 5).map((pool) => (
                <div key={pool.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold">
                        {pool.token0.symbol} / {pool.token1.symbol}
                      </h3>
                      <p className="text-sm text-gray-600">Pool ID: {pool.id.slice(0, 10)}...</p>
                    </div>
                    <Badge variant="outline">
                      TVL: {pricingService.formatTVL(pool.tvlUSD)}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Token 0 Price:</p>
                      <p className="font-semibold text-green-600">
                        {pricingService.formatPrice(pool.token0PriceUSD)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Token 1 Price:</p>
                      <p className="font-semibold text-green-600">
                        {pricingService.formatPrice(pool.token1PriceUSD)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Reserve 0:</p>
                      <p className="font-semibold">{parseFloat(pool.reserve0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Reserve 1:</p>
                      <p className="font-semibold">{parseFloat(pool.reserve1).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Endpoints Test */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Backend API:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}</p>
            <p><strong>Available endpoints:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>GET /api/prices - All token prices</li>
              <li>GET /api/prices/:symbol - Specific token price</li>
              <li>GET /api/ip-price - IP price from Storyscan</li>
              <li>POST /api/prices/refresh - Refresh price cache</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
