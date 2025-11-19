"use client";

import { useState, useEffect } from "react";
import { useAccount, useBalance, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Minus, TrendingUp } from "lucide-react";

// Liquidity Pool ABI (simplified for demo)
const LIQUIDITY_POOL_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "amount0Desired", type: "uint256" },
      { internalType: "uint256", name: "amount1Desired", type: "uint256" },
      { internalType: "uint256", name: "amount0Min", type: "uint256" },
      { internalType: "uint256", name: "amount1Min", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { internalType: "uint256", name: "amount0", type: "uint256" },
      { internalType: "uint256", name: "amount1", type: "uint256" },
      { internalType: "uint256", name: "liquidity", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "liquidity", type: "uint256" },
      { internalType: "uint256", name: "amount0Min", type: "uint256" },
      { internalType: "uint256", name: "amount1Min", type: "uint256" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "removeLiquidity",
    outputs: [
      { internalType: "uint256", name: "amount0", type: "uint256" },
      { internalType: "uint256", name: "amount1", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Token addresses on Story Aeneid
const TOKENS = {
  WIP: {
    address: "0x1234567890123456789012345678901234567890" as const,
    symbol: "WIP",
    name: "Writer Token",
    decimals: 18,
  },
  rIP: {
    address: "0x0987654321098765432109876543210987654321" as const,
    symbol: "rIP",
    name: "Royalty IP Token",
    decimals: 18,
  },
} as const;

const LIQUIDITY_POOLS = [
  {
    address: "0xCfc99DFD727beE966beB1f11E838f5fCb4413707" as const,
    name: "WIP/IP Asset Pool",
    token0: TOKENS.WIP,
    token1: TOKENS.rIP,
    tvlUSD: 1000000,
    apr: "5.2",
    feeTier: "0.3%",
  },
  {
    address: "0xAbc1234567890123456789012345678901234567" as const,
    name: "USDC/IP Stable Pool",
    token0: { address: "0x789" as const, symbol: "USDC", name: "USD Coin", decimals: 6 },
    token1: TOKENS.rIP,
    tvlUSD: 2500000,
    apr: "3.8",
    feeTier: "0.05%",
  },
  {
    address: "0xDef1234567890123456789012345678901234567" as const,
    name: "ETH/IP Asset Pool",
    token0: { address: "0xabc" as const, symbol: "ETH", name: "Ethereum", decimals: 18 },
    token1: TOKENS.rIP,
    tvlUSD: 800000,
    apr: "6.5",
    feeTier: "0.3%",
  },
];

interface LiquidityPosition {
  poolAddress: string;
  liquidity: string;
  amount0: string;
  amount1: string;
  valueUSD: number;
}

export function LiquidityInterface() {
  const { address, isConnected } = useAccount();
  const [selectedPool, setSelectedPool] = useState(LIQUIDITY_POOLS[0]);
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [amount0, setAmount0] = useState("");
  const [amount1, setAmount1] = useState("");
  const [liquidityAmount, setLiquidityAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [positions, setPositions] = useState<LiquidityPosition[]>([]);

  const { writeContract } = useWriteContract();
  
  // Get token balances
  const { data: balance0 } = useBalance({
    address,
    token: selectedPool.token0.address,
  });
  
  const { data: balance1 } = useBalance({
    address,
    token: selectedPool.token1.address,
  });

  // Mock liquidity positions
  useEffect(() => {
    if (isConnected) {
      // In real app, fetch user's liquidity positions
      setPositions([
        {
          poolAddress: "0xCfc99DFD727beE966beB1f11E838f5fCb4413707",
          liquidity: "1000",
          amount0: "500",
          amount1: "500",
          valueUSD: 1000,
        },
      ]);
    }
  }, [isConnected, selectedPool]);

  // Calculate amount1 based on amount0 and pool ratio
  const calculateAmount1 = (amount0Value: string) => {
    if (!amount0Value || parseFloat(amount0Value) <= 0) return "";
    
    // Mock calculation based on current pool ratio
    const ratio = 1; // In real app, get from pool reserves
    return (parseFloat(amount0Value) * ratio).toString();
  };

  useEffect(() => {
    if (mode === "add" && amount0) {
      setAmount1(calculateAmount1(amount0));
    }
  }, [amount0, selectedPool, mode]);

  const handleAddLiquidity = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!amount0 || !amount1 || parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
      setError("Please enter valid amounts");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      alert("Liquidity addition will be implemented with Dynamic.xyz wallet integration");
      
      // In real implementation:
      // await writeContract({
      //   address: selectedPool.address,
      //   abi: LIQUIDITY_POOL_ABI,
      //   functionName: "addLiquidity",
      //   args: [
      //     amt0,
      //     amt1,
      //     parseEther((parseFloat(amount0) * 0.995).toString()), // 0.5% slippage
      //     parseEther((parseFloat(amount1) * 0.995).toString()),
      //     address,
      //     BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 minutes deadline
      //   ],
      // });

      // Simulate successful add
      setTimeout(() => {
        setIsProcessing(false);
        setAmount0("");
        setAmount1("");
        alert("Liquidity added successfully! (This is a demo)");
      }, 2000);

    } catch (err) {
      console.error("Add liquidity failed:", err);
      setError("Failed to add liquidity. Please try again.");
      setIsProcessing(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!liquidityAmount || parseFloat(liquidityAmount) <= 0) {
      setError("Please enter a valid liquidity amount");
      return;
    }

    const totalLiquidity = parseEther(positions[0]?.liquidity || "0");
    const removeAmount = parseEther(liquidityAmount);
    
    if (removeAmount > totalLiquidity) {
      setError("Insufficient liquidity position");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      alert("Liquidity removal will be implemented with Dynamic.xyz wallet integration");
      
      // In real implementation:
      // await writeContract({
      //   address: selectedPool.address,
      //   abi: LIQUIDITY_POOL_ABI,
      //   functionName: "removeLiquidity",
      //   args: [
      //     removeAmount,
      //     parseEther("0"), // min amount0
      //     parseEther("0"), // min amount1
      //     address,
      //     BigInt(Math.floor(Date.now() / 1000) + 1200),
      //   ],
      // });

      // Simulate successful remove
      setTimeout(() => {
        setIsProcessing(false);
        setLiquidityAmount("");
        alert("Liquidity removed successfully! (This is a demo)");
      }, 2000);

    } catch (err) {
      console.error("Remove liquidity failed:", err);
      setError("Failed to remove liquidity. Please try again.");
      setIsProcessing(false);
    }
  };

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-gray-500">Please connect your wallet to manage liquidity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Pool Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Liquidity Provision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LIQUIDITY_POOLS.map((pool) => (
              <div
                key={pool.address}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedPool.address === pool.address
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedPool(pool)}
              >
                <h3 className="font-semibold">{pool.name}</h3>
                <div className="text-sm text-gray-600 mt-1">
                  <div>TVL: ${pool.tvlUSD.toLocaleString()}</div>
                  <div>APR: <span className="text-green-600 font-medium">{pool.apr}%</span></div>
                  <div>Fee: {pool.feeTier}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Your Positions */}
      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Liquidity Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {positions.map((position, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">WIP/IP Asset Pool</h4>
                      <p className="text-sm text-gray-600">
                        {position.amount0} WIP + {position.amount1} rIP
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${position.valueUSD.toLocaleString()}</p>
                      <p className="text-sm text-gray-600">{position.liquidity} LP tokens</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Remove Liquidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mode === "add" ? <Plus className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
              {mode === "add" ? "Add" : "Remove"} Liquidity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <Button
                variant={mode === "add" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("add")}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                variant={mode === "remove" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("remove")}
                className="flex-1"
              >
                Remove
              </Button>
            </div>

            {mode === "add" ? (
              <>
                {/* Token 0 Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{selectedPool.token0.symbol}</label>
                    <span className="text-xs text-gray-500">
                      Balance: {balance0 ? formatEther(balance0.value) : "0"} {selectedPool.token0.symbol}
                    </span>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                  />
                </div>

                {/* Token 1 Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">{selectedPool.token1.symbol}</label>
                    <span className="text-xs text-gray-500">
                      Balance: {balance1 ? formatEther(balance1.value) : "0"} {selectedPool.token1.symbol}
                    </span>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                  />
                </div>

                {/* Pool Info */}
                <div className="text-xs text-gray-500 space-y-1 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>Pool APR:</span>
                    <span className="text-green-600 font-medium">{selectedPool.apr}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fee Tier:</span>
                    <span>{selectedPool.feeTier}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected LP tokens:</span>
                    <span>{amount0 && amount1 ? (parseFloat(amount0) + parseFloat(amount1)).toFixed(2) : "0"}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* LP Token Input */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium">LP Tokens</label>
                    <span className="text-xs text-gray-500">
                      Available: {positions[0]?.liquidity || "0"} LP tokens
                    </span>
                  </div>
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                  />
                </div>

                {/* Expected Output */}
                <div className="text-xs text-gray-500 space-y-1 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span>Expected {selectedPool.token0.symbol}:</span>
                    <span>{liquidityAmount ? (parseFloat(liquidityAmount) * 0.5).toFixed(2) : "0"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Expected {selectedPool.token1.symbol}:</span>
                    <span>{liquidityAmount ? (parseFloat(liquidityAmount) * 0.5).toFixed(2) : "0"}</span>
                  </div>
                </div>
              </>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Action Button */}
            <Button 
              onClick={mode === "add" ? handleAddLiquidity : handleRemoveLiquidity}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                mode === "add" ? "Add Liquidity" : "Remove Liquidity"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Pool Information */}
        <Card>
          <CardHeader>
            <CardTitle>Pool Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Pool Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Value Locked:</span>
                  <span>${selectedPool.tvlUSD.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">24h Volume:</span>
                  <span>${(selectedPool.tvlUSD * 0.05).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">APR:</span>
                  <span className="text-green-600 font-medium">{selectedPool.apr}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee Tier:</span>
                  <span>{selectedPool.feeTier}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Token Composition</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{selectedPool.token0.symbol}:</span>
                  <span>50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{selectedPool.token1.symbol}:</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Rewards</h4>
              <div className="p-3 bg-green-50 rounded-lg text-sm">
                <p className="text-green-800">
                  Earn {selectedPool.feeTier} trading fees on all swaps in this pool. 
                  Fees are automatically distributed to liquidity providers based on their share.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
