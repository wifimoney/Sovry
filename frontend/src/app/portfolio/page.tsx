"use client";

import { useState, useEffect } from "react";
import { Navigation } from "@/components/navigation/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, TrendingUp, Gift, CheckCircle, Coins } from "lucide-react";

// Portfolio Asset Interface
interface PortfolioAsset {
  id: string;
  symbol: string;
  name: string;
  image: string;
  balance: number;
  valueUSD: number;
  claimableRevenue: number;
  apy: string;
  category: string;
}

// Mock data for portfolio assets
const MOCK_ASSETS: PortfolioAsset[] = [
  {
    id: "1",
    symbol: "rMUSIC",
    name: "Music Royalties",
    image: "https://ttmbengqanqzfrkjajgk.supabase.co/storage/v1/object/public/images/pack-art/20874abc-latinpack.jpg",
    balance: 1250.50,
    valueUSD: 1563.12,
    claimableRevenue: 45.80,
    apy: "15.8%",
    category: "Music"
  },
  {
    id: "2",
    symbol: "rART",
    name: "Art Royalties",
    image: "https://cdn.pixabay.com/photo/2024/02/28/07/42/easter-8601492_640.jpg",
    balance: 890.25,
    valueUSD: 1112.81,
    claimableRevenue: 28.45,
    apy: "12.3%",
    category: "Art"
  },
  {
    id: "3",
    symbol: "rGAME",
    name: "Game Royalties",
    image: "https://cdn.pixabay.com/photo/2024/01/25/10/38/minecraft-8532000_640.png",
    balance: 2100.00,
    valueUSD: 1365.00,
    claimableRevenue: 67.20,
    apy: "18.2%",
    category: "Gaming"
  },
  {
    id: "4",
    symbol: "$WIP",
    name: "Wrapped IP Token",
    image: "https://cdn.pixabay.com/photo/2024/01/25/10/38/minecraft-8532000_640.png",
    balance: 5000.00,
    valueUSD: 5000.00,
    claimableRevenue: 0,
    apy: "0%",
    category: "Base Token"
  },
  {
    id: "5",
    symbol: "rPHOTO",
    name: "Photography Royalties",
    image: "https://cdn.pixabay.com/photo/2024/02/28/07/42/easter-8601492_640.jpg",
    balance: 450.75,
    valueUSD: 563.44,
    claimableRevenue: 12.30,
    apy: "8.7%",
    category: "Photography"
  }
];

export default function PortfolioPage() {
  const [assets, setAssets] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [lastClaimTime, setLastClaimTime] = useState<Date | null>(null);

  useEffect(() => {
    // Simulate loading portfolio data
    const timer = setTimeout(() => {
      setAssets(MOCK_ASSETS);
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const calculateNetWorth = () => {
    return assets.reduce((total, asset) => total + asset.valueUSD, 0);
  };

  const calculateTotalClaimable = () => {
    return assets.reduce((total, asset) => total + asset.claimableRevenue, 0);
  };

  const handleClaimAll = async () => {
    setClaiming(true);
    
    try {
      // Simulate claiming process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Reset claimable amounts
      setAssets(assets.map(asset => ({
        ...asset,
        claimableRevenue: 0
      })));
      
      setLastClaimTime(new Date());
      
    } catch (error) {
      alert("Claim failed. Please try again.");
    } finally {
      setClaiming(false);
    }
  };

  const formatUSD = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(balance);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-16">
            <Coins className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading your yield dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-background/95">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              💰 Yield Dashboard
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Track your IP asset earnings and claim rewards
          </p>
        </div>

        {/* Net Worth Card */}
        <Card className="mb-8 glass-card border-primary/30">
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-lg mb-2">Net Worth</p>
                <p className="text-4xl md:text-5xl font-bold text-primary">
                  {formatUSD(calculateNetWorth())}
                </p>
                <p className="text-muted-foreground mt-2">
                  Total value of all your IP assets
                </p>
              </div>
              <div className="text-right">
                <DollarSign className="h-16 w-16 text-primary/50" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claim All Rewards Section */}
        <Card className="mb-8 glass-card border-emerald-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="h-6 w-6 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-foreground">
                    Available to Claim
                  </h3>
                </div>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatUSD(calculateTotalClaimable())}
                </p>
                <p className="text-sm text-muted-foreground">
                  From {assets.filter(a => a.claimableRevenue > 0).length} assets
                </p>
              </div>
              
              <Button
                onClick={handleClaimAll}
                disabled={claiming || calculateTotalClaimable() === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-black px-8 py-4 text-lg font-bold"
                size="lg"
              >
                {claiming ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Gift className="h-5 w-5 mr-2" />
                    Claim All Rewards
                  </>
                )}
              </Button>
            </div>
            
            {lastClaimTime && (
              <Alert className="mt-4 border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <AlertDescription className="text-emerald-300">
                  Successfully claimed rewards at {lastClaimTime.toLocaleTimeString()}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* My Assets Table */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              My Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Asset</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Value</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Claimable Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">APY</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-border/20 hover:bg-muted/10">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted/20 rounded-lg overflow-hidden border border-border/30">
                            <img
                              src={asset.image}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{asset.symbol}</p>
                            <p className="text-sm text-muted-foreground">{asset.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="font-medium text-foreground">
                          {formatBalance(asset.balance)}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="font-medium text-foreground">
                          {formatUSD(asset.valueUSD)}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4">
                        {asset.claimableRevenue > 0 ? (
                          <span className="apy-badge">
                            {formatUSD(asset.claimableRevenue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                          {asset.apy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Summary Row */}
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Total</span>
                <div className="flex gap-6">
                  <span className="font-semibold text-foreground">{formatUSD(calculateNetWorth())}</span>
                  <span className="font-semibold text-emerald-400">
                    {formatUSD(calculateTotalClaimable())}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Coins className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold text-foreground">{assets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-emerald-400" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Earning Assets</p>
                  <p className="text-2xl font-bold text-foreground">
                    {assets.filter(a => parseFloat(a.apy) > 0).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Gift className="h-8 w-8 text-primary" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Avg APY</p>
                  <p className="text-2xl font-bold text-foreground">
                    {assets.length > 0 
                      ? (assets.reduce((sum, a) => sum + parseFloat(a.apy), 0) / assets.length).toFixed(1)
                      : "0"
                    }%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
