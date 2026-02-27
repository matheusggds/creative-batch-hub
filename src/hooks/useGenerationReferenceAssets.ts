import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GenerationReferenceAsset {
  id: string;
  asset_id: string;
  role: string;
  sort_order: number;
  file_url: string;
  asset_name: string | null;
}

export function useGenerationReferenceAssets(generationId: string | undefined) {
  return useQuery({
    queryKey: ["generation_reference_assets", generationId],
    enabled: !!generationId,
    queryFn: async (): Promise<GenerationReferenceAsset[]> => {
      const { data, error } = await supabase
        .from("generation_reference_assets")
        .select("id, asset_id, role, sort_order, assets(file_url, name)")
        .eq("generation_id", generationId!)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        asset_id: row.asset_id,
        role: row.role,
        sort_order: row.sort_order,
        file_url: row.assets?.file_url ?? "",
        asset_name: row.assets?.name ?? null,
      }));
    },
  });
}
