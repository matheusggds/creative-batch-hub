import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AvatarGeneration {
  id: string;
  status: string;
  current_step: string | null;
  progress_pct: number;
  result_url: string | null;
  error_code: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  extracted_prompt: string | null;
  ai_parameters: Record<string, unknown>;
  pipeline_type: string;
  source_mode: string | null;
  tool_type: string | null;
  result_asset_id: string | null;
}

export function useAvatarGenerations(avatarProfileId: string | undefined) {
  return useQuery({
    queryKey: ["avatar_generations", avatarProfileId],
    enabled: !!avatarProfileId,
    refetchInterval: (query) => {
      const data = query.state.data as AvatarGeneration[] | undefined;
      if (!data) return 5000;
      const hasActive = data.some(
        (g) => g.status === "pending" || g.status === "processing" || g.status === "queued"
      );
      return hasActive ? 3000 : false;
    },
    queryFn: async (): Promise<AvatarGeneration[]> => {
      const { data, error } = await supabase
        .from("generations")
        .select(
          "id, status, current_step, progress_pct, result_url, error_code, created_at, started_at, finished_at, extracted_prompt, ai_parameters, pipeline_type, source_mode, tool_type, result_asset_id"
        )
        .eq("avatar_profile_id", avatarProfileId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AvatarGeneration[];
    },
  });
}
