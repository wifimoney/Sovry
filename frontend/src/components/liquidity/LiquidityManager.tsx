'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { 
  Plus, 
  Minus, 
  TrendingUp, 
  AlertCircle, 
  DollarSign, 
  Percent,
  Wallet,
  Info,
  ChevronDown,
  Settings
} from 'lucide-react'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'

interface Pool {
  id: string
  token0: { symbol: string; name: string; id: string }
  token1: { symbol: string; name: string; id: string }
  reserve0: string
  reserve1: string
  totalSupply: string
  tvlUSD?: number
  apr?: number
  userLpBalance?: string
  userSharePercentage?: number
}

interface LiquidityPosition {
  pool: Pool
  lpTokens: string
  valueUSD: number
  pendingRewards: number
}

export function LiquidityManager({ pool }: { pool: Pool }) {
  const { primaryWallet } = useDynamicContext()
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Add Liquidity States
  const [token0Amount, setToken0Amount] = useState('')
  const [token1Amount, setToken1Amount] = useState('')
  const [token0Balance, setToken0Balance] = useState('0')
  const [token1Balance, setToken1Balance] = useState('0')
  const [needsApproval0, setNeedsApproval0] = useState(false)
  const [needsApproval1, setNeedsApproval1] = useState(false)
  
  // Remove Liquidity States
  const [removePercentage, setRemovePercentage] = useState([50])
  const [estimatedOutput0, setEstimatedOutput0] = useState('0')
  const [estimatedOutput1, setEstimatedOutput1] = useState('0')
  const [userLpBalance, setUserLpBalance] = useState('0')
  
  // Settings
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [deadline, setDeadline] = useState(20)

  // Calculate pool price and ratios
  const reserve0 = parseFloat(pool.reserve0 || '0')
  const reserve1 = parseFloat(pool.reserve1 || '1')
  const priceRatio = reserve1 / reserve0

  // Load user balances and LP position
  useEffect(() => {
    if (primaryWallet) {
      loadUserData()
    }
  }, [primaryWallet, pool])

  const loadUserData = async () => {
    try {
      // TODO: Implement actual balance fetching
      setToken0Balance('1000')
      setToken1Balance('500')
      setUserLpBalance('100')
    } catch (err) {
      console.error('Failed to load user data:', err)
    }
  }

  // Calculate proportional amounts when input changes
  const handleToken0Change = (value: string) => {
    setToken0Amount(value)
    if (value && reserve0 > 0) {
      const amount1 = (parseFloat(value) * priceRatio).toFixed(6)
      setToken1Amount(amount1)
    } else {
      setToken1Amount('')
    }
  }

  const handleToken1Change = (value: string) => {
    setToken1Amount(value)
    if (value && reserve1 > 0) {
      const amount0 = (parseFloat(value) / priceRatio).toFixed(6)
      setToken0Amount(amount0)
    } else {
      setToken0Amount('')
    }
  }

  // Calculate removal estimates
  useEffect(() => {
    if (userLpBalance && removePercentage[0]) {
      const percentage = removePercentage[0] / 100
      const lpAmount = parseFloat(userLpBalance) * percentage
      const totalSupply = parseFloat(pool.totalSupply || '1')
      
      if (totalSupply > 0) {
        const share = lpAmount / totalSupply
        setEstimatedOutput0((reserve0 * share).toFixed(6))
        setEstimatedOutput1((reserve1 * share).toFixed(6))
      }
    }
  }, [removePercentage, userLpBalance, pool])

  // Add Liquidity Flow
  const handleAddLiquidity = async () => {
    if (!primaryWallet) {
      setError('Please connect your wallet')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Step 1: Check approvals
      if (needsApproval0 || needsApproval1) {
        await handleApprovals()
      }

      // Step 2: Execute add liquidity
      const txHash = await executeAddLiquidity()
      
      // Step 3: Update UI
      console.log('Liquidity added successfully:', txHash)
      setToken0Amount('')
      setToken1Amount('')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add liquidity')
    } finally {
      setIsLoading(false)
    }
  }

  const handleApprovals = async () => {
    // TODO: Implement token approval logic
    console.log('Approving tokens...')
  }

  const executeAddLiquidity = async () => {
    // TODO: Implement actual add liquidity transaction
    return '0x123...abc'
  }

  // Remove Liquidity Flow
  const handleRemoveLiquidity = async () => {
    if (!primaryWallet) {
      setError('Please connect your wallet')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const txHash = await executeRemoveLiquidity()
      console.log('Liquidity removed successfully:', txHash)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove liquidity')
    } finally {
      setIsLoading(false)
    }
  }

  const executeRemoveLiquidity = async () => {
    // TODO: Implement actual remove liquidity transaction
    return '0x456...def'
  }

  const calculateLiquidityValue = () => {
    if (!token0Amount || !token1Amount) return 0
    const amount0 = parseFloat(token0Amount)
    const amount1 = parseFloat(token1Amount)
    // TODO: Use actual token prices
    return amount0 * 1 + amount1 * 1 // Placeholder prices
  }

  const calculateRemovalValue = () => {
    if (!estimatedOutput0 || !estimatedOutput1) return 0
    const amount0 = parseFloat(estimatedOutput0)
    const amount1 = parseFloat(estimatedOutput1)
    // TODO: Use actual token prices
    return amount0 * 1 + amount1 * 1 // Placeholder prices
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{pool.token0.symbol}</span>
              <span className="text-gray-500">/</span>
              <span className="font-semibold">{pool.token1.symbol}</span>
            </div>
            <Badge variant="secondary">
              TVL: ${pool.tvlUSD?.toLocaleString() || '0'}
            </Badge>
            {pool.apr && (
              <Badge variant="default" className="bg-green-500">
                APR: {pool.apr.toFixed(2)}%
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'add' | 'remove')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Liquidity
            </TabsTrigger>
            <TabsTrigger value="remove" className="flex items-center gap-2">
              <Minus className="h-4 w-4" />
              Remove Liquidity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="add" className="space-y-4">
            <div className="space-y-3">
              {/* Token 0 Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">{pool.token0.symbol}</label>
                  <span className="text-sm text-gray-500">
                    Balance: {token0Balance}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={token0Amount}
                    onChange={(e) => handleToken0Change(e.target.value)}
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToken0Change(token0Balance)}
                      className="h-6 px-2 text-xs"
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <div className="bg-gray-100 rounded-full p-2">
                  <Plus className="h-4 w-4 text-gray-600" />
                </div>
              </div>

              {/* Token 1 Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium">{pool.token1.symbol}</label>
                  <span className="text-sm text-gray-500">
                    Balance: {token1Balance}
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={token1Amount}
                    onChange={(e) => handleToken1Change(e.target.value)}
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToken1Change(token1Balance)}
                      className="h-6 px-2 text-xs"
                    >
                      MAX
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Liquidity Info */}
            {token0Amount && token1Amount && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Liquidity Value:</span>
                  <span className="font-medium">
                    ${calculateLiquidityValue().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pool Share:</span>
                  <span className="font-medium">
                    {((parseFloat(token0Amount) / reserve0) * 100).toFixed(4)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Slippage Tolerance:</span>
                  <span className="font-medium">{slippageTolerance}%</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              {needsApproval0 || needsApproval1 ? (
                <Button 
                  onClick={handleApprovals}
                  disabled={isLoading}
                  className="w-full"
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2" />
                      Approving...
                    </>
                  ) : (
                    'Approve Tokens'
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handleAddLiquidity}
                  disabled={isLoading || !token0Amount || !token1Amount}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Adding Liquidity...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Liquidity
                    </>
                  )}
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="remove" className="space-y-4">
            {/* LP Balance Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Your LP Tokens</p>
                  <p className="text-2xl font-bold text-blue-900">{userLpBalance}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-blue-600">Position Value</p>
                  <p className="text-lg font-bold text-blue-900">
                    ${calculateRemovalValue().toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Percentage Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Remove Percentage</label>
                <span className="text-sm font-bold text-blue-600">{removePercentage[0]}%</span>
              </div>
              <Slider
                value={removePercentage}
                onValueChange={setRemovePercentage}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Estimated Output */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">You will receive:</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{pool.token0.symbol}</span>
                  <span className="font-medium">{estimatedOutput0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{pool.token1.symbol}</span>
                  <span className="font-medium">{estimatedOutput1}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500 pt-2 border-t">
                <Info className="h-3 w-3 inline mr-1" />
                Output is estimated and may vary based on slippage
              </div>
            </div>

            {/* Remove Button */}
            <Button 
              onClick={handleRemoveLiquidity}
              disabled={isLoading || parseFloat(userLpBalance) === 0}
              className="w-full"
              variant="destructive"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Removing...
                </>
              ) : (
                <>
                  <Minus className="h-4 w-4 mr-2" />
                  Remove Liquidity
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
