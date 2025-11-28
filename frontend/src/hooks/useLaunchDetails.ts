"use client"

import { useState, useEffect, useCallback } from "react"
import { enrichLaunchData } from "@/services/launchDataService"
import { getLaunchInfo, type LaunchInfo } from "@/services/launchpadService"
import { getGraduationInfo, type GraduationInfo } from "@/services/graduationService"

export interface LaunchDetails {
  tokenAddress: string
  symbol?: string
  name?: string
  imageUrl?: string
  marketCap?: string
  bondingProgress?: number
  category?: string
  currentPrice?: string
  rtAddress?: string
  launchInfo?: LaunchInfo | null
  graduationInfo?: GraduationInfo | null
}

export function useLaunchDetails(tokenAddress: string | null) {
  const [details, setDetails] = useState<LaunchDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDetails = useCallback(async () => {
    if (!tokenAddress) {
      setDetails(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch launch info, enriched data, and graduation info in parallel
      const [launchInfo, enrichedData, graduationInfo] = await Promise.all([
        getLaunchInfo(tokenAddress),
        enrichLaunchData(tokenAddress),
        getGraduationInfo(tokenAddress),
      ])

      setDetails({
        tokenAddress,
        ...enrichedData,
        launchInfo: launchInfo || null,
        graduationInfo: graduationInfo || null,
      })
    } catch (err) {
      console.error("Error loading launch details:", err)
      setError(err instanceof Error ? err.message : "Failed to load launch details")
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }, [tokenAddress])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  return { details, loading, error, retry: loadDetails }
}

