"use client";

import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ImmersiveHero } from "@/components/hero/ImmersiveHero";
import { CategoryBar } from "@/components/navigation/CategoryBar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { PlusCircle, Search } from "lucide-react";
import Link from "next/link";
import LaunchCard, { type LaunchCardData } from "@/components/launch/LaunchCard";
import { enrichLaunchesData } from "@/services/launchDataService";

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.goldsky.com/api/public/project_cmhxop6ixrx0301qpd4oi5bb4/subgraphs/sovry-aeneid/1.1.1/gn";

interface BasicLaunch {
  id: string;
  token: string;
  creator: string;
  createdAt: number;
}

const CATEGORIES = [
  "All",
  "Meme",
  "AI Agent",
  "Gaming",
  "Music",
  "Art",
] as const;

type Category = (typeof CATEGORIES)[number];

async function fetchLaunches(first: number, skip: number): Promise<BasicLaunch[]> {
  try {
    const query = `
      query GetLaunches($first: Int!, $skip: Int!) {
        launches(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
          id
          token
          creator
          createdAt
        }
      }
    `;

    const res = await fetch(SUBGRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { first, skip } }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const raw = json?.data?.launches || [];

    return raw.map((l: any) => ({
      id: l.id as string,
      token: (l.token as string) || (l.id as string),
      creator: l.creator as string,
      createdAt: Number(l.createdAt || 0),
    }));
  } catch {
    return [];
  }
}

export default function Home() {
  const [basicLaunches, setBasicLaunches] = useState<BasicLaunch[]>([]);
  const [enrichedLaunches, setEnrichedLaunches] = useState<LaunchCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");

  // Fetch basic launch data from subgraph
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchLaunches(24, 0);
        setBasicLaunches(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // Enrich launch data with additional information
  useEffect(() => {
    const enrich = async () => {
      if (basicLaunches.length === 0) {
        setEnrichedLaunches([]);
        return;
      }

      try {
        setEnriching(true);
        const wrapperTokens = basicLaunches.map((l) => l.token || l.id);
        const enrichedData = await enrichLaunchesData(wrapperTokens);

        // Merge basic launch data with enriched data
        const merged: LaunchCardData[] = basicLaunches.map((basic) => {
          const token = basic.token || basic.id;
          const enriched = enrichedData.get(token) || {};
          return {
            ...basic,
            ...enriched,
          };
        });

        setEnrichedLaunches(merged);
      } catch (error) {
        console.error("Error enriching launch data:", error);
        // Fallback to basic launches if enrichment fails
        setEnrichedLaunches(
          basicLaunches.map((l) => ({
            ...l,
          }))
        );
      } finally {
        setEnriching(false);
      }
    };

    enrich();
  }, [basicLaunches]);

  // Filter launches by search and category
  const filtered = useMemo(() => {
    let result = enrichedLaunches;

    // Apply category filter
    if (selectedCategory !== "All") {
      result = result.filter((l) => {
        const category = l.category || "IP Asset";
        // Map categories to match our filter categories
        const categoryMap: Record<string, string> = {
          Art: "Art",
          Music: "Music",
          Gaming: "Gaming",
          "AI Agent": "AI Agent",
          Meme: "Meme",
        };
        const mappedCategory = categoryMap[category] || category;
        return mappedCategory === selectedCategory;
      });
    }

    // Apply search filter
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((l) => {
        const addr = (l.token || "").toLowerCase();
        const creator = (l.creator || "").toLowerCase();
        const symbol = (l.symbol || "").toLowerCase();
        const name = (l.name || "").toLowerCase();
        return (
          addr.includes(q) ||
          creator.includes(q) ||
          symbol.includes(q) ||
          name.includes(q)
        );
      });
    }

    return result;
  }, [enrichedLaunches, search, selectedCategory]);

  const isLoading = loading || enriching;

  return (
    <AppShell>
      {/* Floating Top-Right Buttons */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <Link href="/create">
          <Button variant="buy" className="text-sm px-4 py-2">
            <PlusCircle className="h-4 w-4 mr-2" />
            Create
          </Button>
        </Link>
        <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-lg">
          <DynamicWidget variant="dropdown" />
        </div>
      </div>

      {/* Hero Section */}
      <ImmersiveHero />

      {/* Discovery Section */}
      <div id="discover" className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-zinc-50">Discover Tokens</h2>
            <div className="w-full sm:w-auto sm:max-w-xs">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tokens..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-zinc-900/50 border-zinc-800/70"
                />
              </div>
            </div>
          </div>

          {/* Category Bar */}
          <CategoryBar
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
          />
        </div>

        {/* Content Grid */}
        {isLoading ? (
          <div className="border border-zinc-800/60 rounded-2xl bg-zinc-900/50 p-6">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">
                {loading ? "Loading launches..." : "Enriching launch data..."}
              </span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-zinc-800/60 rounded-2xl bg-zinc-900/50 p-6 text-sm text-zinc-400">
            {search || selectedCategory !== "All" ? (
              <div>
                <p className="font-medium mb-1">No launches match your filters.</p>
                <p>Try adjusting your search or category filter.</p>
              </div>
            ) : (
              <div>
                <p className="font-medium mb-1">No launches found yet.</p>
                <p>Be the first to create one on the Create page.</p>
              </div>
            )}
          </div>
        ) : (
          <section>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((launch) => (
                <LaunchCard key={launch.token || launch.id} launch={launch} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
