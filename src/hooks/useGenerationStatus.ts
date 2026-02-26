import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

interface GenerationFull {
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
}

interface GenerationJob {
  id: string;
  step: string;
  status: string;
  provider: string | null;
  model: string | null;
  attempt: number;
  max_attempts: number;
  created_at: string;
  updated_at: string;
  error_payload: Record<string, unknown>;
}

interface GenerationEvent {
  id: string;
  type: string;
  message: string | null;
  created_at: string;
  job_id: string | null;
}

export interface GenerationStatusData {
  generation: GenerationFull;
  jobs: GenerationJob[];
  events: GenerationEvent[];
}

export function useGenerationStatus(generationId: string | null) {
  const qc = useQueryClient();
  const prevStatus = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["generation_status", generationId],
    enabled: !!generationId,
    refetchInterval: (query) => {
      const data = query.state.data as GenerationStatusData | undefined;
      if (!data) return 3000;
      const s = data.generation.status;
      if (s === "completed" || s === "failed") return false;
      return 3000;
    },
    queryFn: async (): Promise<GenerationStatusData> => {
      const { data: gen, error: genErr } = await supabase
        .from("generations")
        .select(
          "id, status, current_step, progress_pct, result_url, error_code, created_at, started_at, finished_at, extracted_prompt, ai_parameters"
        )
        .eq("id", generationId!)
        .maybeSingle();

      if (genErr) throw genErr;
      if (!gen) throw new Error("Generation not found");

      const { data: jobs } = await supabase
        .from("generation_jobs")
        .select(
          "id, step, status, provider, model, attempt, max_attempts, created_at, updated_at, error_payload"
        )
        .eq("generation_id", generationId!)
        .order("created_at", { ascending: true });

      const { data: events } = await supabase
        .from("generation_events")
        .select("id, type, message, created_at, job_id")
        .eq("generation_id", generationId!)
        .order("created_at", { ascending: true });

      return {
        generation: gen as GenerationFull,
        jobs: (jobs ?? []) as GenerationJob[],
        events: (events ?? []) as GenerationEvent[],
      };
    },
  });

  // Refresh avatar gallery when generation completes
  useEffect(() => {
    const currentStatus = query.data?.generation.status ?? null;
    if (
      prevStatus.current &&
      prevStatus.current !== "completed" &&
      currentStatus === "completed"
    ) {
      qc.invalidateQueries({ queryKey: ["avatar_profile"] });
    }
    prevStatus.current = currentStatus;
  }, [query.data?.generation.status, qc]);

  return query;
}
