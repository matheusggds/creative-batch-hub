import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo } from "react";

const PAGE_SIZE = 30;

export interface HistoryVariation {
  generationId: string;
  resultUrl: string;
  resultAssetId: string;
}

export interface HistorySession {
  referenceAssetId: string;
  referenceUrl: string;
  latestResultUrl: string;
  latestResultAssetId: string;
  latestGenerationId: string;
  variationCount: number;
  lastGeneratedAt: string;
  variations: HistoryVariation[];
}

/**
 * Fetches Quick Flow generations grouped by reference asset.
 * Uses infinite pagination (30 gens per page) and groups client-side.
 * Optionally excludes a reference asset (the active session).
 */
export function useQuickFlowHistory(excludeAssetId?: string | null) {
  const { user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ["quick_flow_history", user?.id],
    enabled: !!user,
    initialPageParam: 0,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("generations")
        .select(
          "id, status, result_url, result_asset_id, created_at, reference_asset_id"
        )
        .eq("tool_type", "quick_similar_image")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        status: string;
        result_url: string | null;
        result_asset_id: string | null;
        created_at: string;
        reference_asset_id: string;
      }>;
    },
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPageParam + 1;
    },
  });

  const allGenerations = useMemo(
    () => query.data?.pages.flat() ?? [],
    [query.data?.pages]
  );

  // Collect unique reference asset IDs for URL lookup
  const uniqueRefIds = useMemo(() => {
    const ids = new Set(allGenerations.map((g) => g.reference_asset_id));
    return Array.from(ids);
  }, [allGenerations]);

  // Batch-fetch reference asset URLs
  const { data: refAssets } = useQuery({
    queryKey: ["quick_flow_ref_assets", uniqueRefIds],
    enabled: uniqueRefIds.length > 0,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, file_url")
        .in("id", uniqueRefIds);
      return data ?? [];
    },
  });

  const refUrlMap = useMemo(() => {
    const map = new Map<string, string>();
    refAssets?.forEach((a) => map.set(a.id, a.file_url));
    return map;
  }, [refAssets]);

  // Group generations into sessions by reference_asset_id
  const sessions = useMemo(() => {
    const grouped = new Map<string, typeof allGenerations>();

    for (const gen of allGenerations) {
      const key = gen.reference_asset_id;
      if (excludeAssetId && key === excludeAssetId) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(gen);
    }

    const result: HistorySession[] = [];
    for (const [refId, gens] of grouped) {
      const sorted = [...gens].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const latest = sorted[0];

      result.push({
        referenceAssetId: refId,
        referenceUrl: refUrlMap.get(refId) ?? "",
        latestResultUrl: latest.result_url ?? "",
        latestResultAssetId: latest.result_asset_id ?? "",
        latestGenerationId: latest.id,
        variationCount: sorted.length,
        lastGeneratedAt: latest.created_at,
        variations: sorted
          .filter((g) => g.result_url)
          .map((g) => ({
            generationId: g.id,
            resultUrl: g.result_url ?? "",
            resultAssetId: g.result_asset_id ?? "",
          })),
      });
    }

    result.sort(
      (a, b) =>
        new Date(b.lastGeneratedAt).getTime() -
        new Date(a.lastGeneratedAt).getTime()
    );
    return result;
  }, [allGenerations, refUrlMap, excludeAssetId]);

  return {
    sessions,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}
