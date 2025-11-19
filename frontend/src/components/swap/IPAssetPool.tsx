"use client";

import React, { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Wallet, AlertCircle, CheckCircle } from "lucide-react";
import { createIPAssetPool, isWalletConfigured, getWalletInfo, PoolCreationParams } from "@/services/poolService";

interface IPAssetPoolProps {
  onPairCreated?: (poolAddress: string) => void;
}

export default function IPAssetPool({ onPairCreated }: IPAssetPoolProps) {
  const { user, isAuthenticated } = useDynamicContext();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
    token0Address: "0x0000000000000000000000000000000000000000", // Mock token address
    token1Address: "0x0000000000000000000000000000000000000000", // Mock token address
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!isAuthenticated) {
        throw new Error("Please connect your wallet first");
      }

      const params: PoolCreationParams = {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        imageUrl: formData.imageUrl,
        token0Address: formData.token0Address,
        token1Address: formData.token1Address,
      };

      const result = await createIPAssetPool(params);

      if (result.success && result.poolAddress) {
        setSuccess(true);
        onPairCreated?.(result.poolAddress);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          setFormData({
            name: "",
            symbol: "",
            description: "",
            imageUrl: "",
            token0Address: "0x0000000000000000000000000000000000000000",
            token1Address: "0x0000000000000000000000000000000000000000",
          });
          setSuccess(false);
        }, 3000);
      } else {
        throw new Error(result.error || "Failed to create pool");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Load wallet info when authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      setWalletInfo({
        address: user.walletAddress || 'Connected',
        balance: 'N/A', // Dynamic doesn't expose balance directly
      });
    } else {
      setWalletInfo(null);
    }
  }, [isAuthenticated, user]);

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create IP Asset Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Status */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="font-medium">Wallet Status:</span>
            </div>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              isAuthenticated 
                ? "bg-green-100 text-green-800" 
                : "bg-yellow-100 text-yellow-800"
            }`}>
              {isAuthenticated ? "Connected" : "Not Connected"}
            </span>
          </div>
          
          {walletInfo && (
            <div className="mt-2 text-sm text-gray-600">
              <p>Address: {walletInfo.address}</p>
            </div>
          )}
          
          {!isAuthenticated && (
            <Alert className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please connect your wallet using the Dynamic wallet connector to create pools.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Success Message */}
        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Pool created successfully! The form will reset in a few seconds.
            </AlertDescription>
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">IP Asset Name *</Label>
              <Input
                id="name"
                placeholder="My Music Collection"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
                disabled={!isAuthenticated}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="symbol">Token Symbol *</Label>
              <Input
                id="symbol"
                placeholder="MUSIC"
                value={formData.symbol}
                onChange={(e) => handleInputChange("symbol", e.target.value.toUpperCase())}
                required
                maxLength={10}
                disabled={!isAuthenticated}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              className="w-full min-h-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="A unique collection of music royalties and intellectual property rights"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              required
              disabled={!isAuthenticated}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={formData.imageUrl}
              onChange={(e) => handleInputChange("imageUrl", e.target.value)}
              disabled={!isAuthenticated}
            />
          </div>

          <Button 
            type="submit" 
            disabled={!isAuthenticated || loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Pool...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create IP Asset Pool
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
