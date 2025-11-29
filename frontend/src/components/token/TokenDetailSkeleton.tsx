"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function TokenDetailSkeleton() {
  return (
    <div className="min-h-screen px-4 md:px-6 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Skeleton */}
        <Skeleton className="h-5 w-48" />

        {/* Token Header Skeleton */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <Skeleton className="w-20 h-20 rounded-xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two-Column Layout Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Chart Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[400px] w-full" />
              </CardContent>
            </Card>

            {/* Progress Bar Skeleton */}
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-full rounded-full" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Swap Interface Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>

            {/* Activity Feed Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


