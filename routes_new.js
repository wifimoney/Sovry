const express = require('express');
const router = express.Router();

// GET /api/pools - Return list of all pools
router.get("/pools", async (req, res) => {
  try {
    // Mock data for development - multiple pools
    const pools = [
      {
        address: "0xCfc99DFD727beE966beB1f11E838f5fCb4413707",
        name: "WIP/IP Asset Pool",
        token0Symbol: "WIP",
        token1Symbol: "IP",
        token0Address: "0x123...",
        token1Address: "0x456...",
        tvlUSD: 1000000,
        volume24hUSD: 50000,
        apr: "5.2",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xAbc1234567890123456789012345678901234567",
        name: "USDC/IP Stable Pool",
        token0Symbol: "USDC",
        token1Symbol: "IP",
        token0Address: "0x789...",
        token1Address: "0x456...",
        tvlUSD: 2500000,
        volume24hUSD: 120000,
        apr: "3.8",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xDef1234567890123456789012345678901234567",
        name: "ETH/IP Asset Pool",
        token0Symbol: "ETH",
        token1Symbol: "IP",
        token0Address: "0xabc...",
        token1Address: "0x456...",
        tvlUSD: 800000,
        volume24hUSD: 35000,
        apr: "6.5",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xGhi1234567890123456789012345678901234567",
        name: "WBTC/IP Premium Pool",
        token0Symbol: "WBTC",
        token1Symbol: "IP",
        token0Address: "0xdef...",
        token1Address: "0x456...",
        tvlUSD: 1500000,
        volume24hUSD: 75000,
        apr: "4.2",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xJkl1234567890123456789012345678901234567",
        name: "DAI/IP Liquidity Pool",
        token0Symbol: "DAI",
        token1Symbol: "IP",
        token0Address: "0xghi...",
        token1Address: "0x456...",
        tvlUSD: 600000,
        volume24hUSD: 28000,
        apr: "4.8",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xMno1234567890123456789012345678901234567",
        name: "USDT/IP Trading Pool",
        token0Symbol: "USDT",
        token1Symbol: "IP",
        token0Address: "0xjkl...",
        token1Address: "0x456...",
        tvlUSD: 1800000,
        volume24hUSD: 95000,
        apr: "3.5",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xPqr1234567890123456789012345678901234567",
        name: "FRAX/IP Stable Pool",
        token0Symbol: "FRAX",
        token1Symbol: "IP",
        token0Address: "0xmno...",
        token1Address: "0x456...",
        tvlUSD: 450000,
        volume24hUSD: 22000,
        apr: "4.1",
        createdTimestamp: new Date().toISOString()
      },
      {
        address: "0xStu1234567890123456789012345678901234567",
        name: "LINK/IP Oracle Pool",
        token0Symbol: "LINK",
        token1Symbol: "IP",
        token0Address: "0xpqr...",
        token1Address: "0x456...",
        tvlUSD: 320000,
        volume24hUSD: 18000,
        apr: "7.2",
        createdTimestamp: new Date().toISOString()
      }
    ];
    
    res.json({
      pools,
      count: pools.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching pools:", error);
    res.status(500).json({ error: "Failed to fetch pools" });
  }
});

// GET /api/pools/:address/chart - Return pool chart data
router.get("/pools/:address/chart", async (req, res) => {
  try {
    const { address } = req.params;
    
    // Mock chart data
    const chartData = [
      { timestamp: "2025-01-01", tvlUSD: "900000", volumeUSD: "40000" },
      { timestamp: "2025-01-02", tvlUSD: "950000", volumeUSD: "45000" },
      { timestamp: "2025-01-03", tvlUSD: "1000000", volumeUSD: "50000" }
    ];
    
    res.json({
      poolAddress: address,
      data: chartData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching pool chart:", error);
    res.status(500).json({ error: "Failed to fetch pool chart" });
  }
});

// GET /api/assets/:ipId/revenue - Return IP asset revenue data
router.get("/assets/:ipId/revenue", async (req, res) => {
  try {
    const { ipId } = req.params;
    
    // Mock revenue data
    const revenueData = {
      ipId,
      totalRevenue: "10000",
      revenueHistory: [
        { timestamp: "2025-01-01", amount: "1000" },
        { timestamp: "2025-01-02", amount: "1200" },
        { timestamp: "2025-01-03", amount: "1300" }
      ]
    };
    
    res.json({
      ...revenueData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching asset revenue:", error);
    res.status(500).json({ error: "Failed to fetch asset revenue" });
  }
});

// GET /api/assets/:ipId/metadata - Return IP asset metadata
router.get("/assets/:ipId/metadata", async (req, res) => {
  try {
    const { ipId } = req.params;
    
    // Mock metadata
    const metadata = {
      ipId,
      name: "Sample IP Asset",
      description: "This is a sample IP asset",
      image: "https://example.com/image.png",
      attributes: [
        { trait_type: "Category", value: "Art" },
        { trait_type: "Creator", value: "Artist Name" }
      ],
      owner: "0x8c317fb91a73e2c8d4883dded3981982f046f733",
      createdTimestamp: new Date().toISOString()
    };
    
    res.json({
      ...metadata,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching asset metadata:", error);
    res.status(500).json({ error: "Failed to fetch asset metadata" });
  }
});

module.exports = router;
