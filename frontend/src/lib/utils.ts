import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format market cap to readable format with currency symbol
 * Examples: $1.2M, $450K, $1.5B, $500
 */
export function formatMarketCap(
  marketCap: string | number | undefined | null
): string {
  if (!marketCap) return "—"

  const num = typeof marketCap === "string" ? parseFloat(marketCap) : marketCap

  if (isNaN(num) || num === 0) return "—"

  // Use Intl.NumberFormat for currency formatting
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  if (num >= 1_000_000_000) {
    // Billions
    return formatter.format(num / 1_000_000_000) + "B"
  } else if (num >= 1_000_000) {
    // Millions
    return formatter.format(num / 1_000_000) + "M"
  } else if (num >= 1_000) {
    // Thousands
    return formatter.format(num / 1_000) + "K"
  } else {
    // Less than 1K
    return formatter.format(num)
  }
}

/**
 * Format market cap to full currency string for tooltips
 */
export function formatMarketCapFull(
  marketCap: string | number | undefined | null
): string {
  if (!marketCap) return "—"

  const num = typeof marketCap === "string" ? parseFloat(marketCap) : marketCap

  if (isNaN(num) || num === 0) return "—"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}
