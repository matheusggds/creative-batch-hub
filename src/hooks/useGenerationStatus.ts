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
  reference_asset_id: string;
  result_asset_id: string | null;
  retry_count: number;
  pipeline_type: string;
  source_mode: string | null;
  tool_type: string | null;
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
  input_payload: Record<string, unknown>;
  output_payload: Record<string, unknown>;
  error_payload: Record<string, unknown>;
}

interface GenerationEvent {
  id: string;
  type: string;
  message: string | null;
  created_at: string;
  job_id: string | null;
  payload: Record<string, unknown>;
}

export interface GenerationStatusData {
  generation: GenerationFull;
  jobs: GenerationJob[];
  events: GenerationEvent[];
}

export function useGenerationStatus(generationId: string | null, options?: { skipDetails?: boolean }) {
  const skipDetails = options?.skipDetails ?? false;
  const qc = useQueryClient();
  const prevStatus = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["generation_status", generationId, skipDetails],
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
          "id, status, current_step, progress_pct, result_url, result_asset_id, error_code, created_at, started_at, finished_at, extracted_prompt, ai_parameters, reference_asset_id, retry_count, pipeline_type, source_mode, tool_type"
        )
        .eq("id", generationId!)
        .maybeSingle();

      if (genErr) throw genErr;
      if (!gen) throw new Error("Generation not found");

      let jobs: GenerationJob[] = [];
      let events: GenerationEvent[] = [];

      if (!skipDetails) {
        const { data: jobsData } = await supabase
          .from("generation_jobs")
          .select(
            "id, step, status, provider, model, attempt, max_attempts, created_at, updated_at, input_payload, output_payload, error_payload"
          )
          .eq("generation_id", generationId!)
          .order("created_at", { ascending: true });

        const { data: eventsData } = await supabase
          .from("generation_events")
          .select("id, type, message, created_at, job_id, payload")
          .eq("generation_id", generationId!)
          .order("created_at", { ascending: true });

        jobs = (jobsData ?? []) as GenerationJob[];
        events = (eventsData ?? []) as GenerationEvent[];
      }

      return {
        generation: gen as GenerationFull,
        jobs,
        events,
      };
    },
  });

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
