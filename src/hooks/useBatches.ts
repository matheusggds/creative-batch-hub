import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AiParameters, GenerationBatch, Generation } from "@/types/studio";

export function useBatches() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["batches"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generation_batches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GenerationBatch[];
    },
  });
}

export function useGenerations(batchId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["generations", batchId],
    enabled: !!user && !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .eq("batch_id", batchId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Generation[];
    },
  });
}

export function useAllGenerations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["generations-all"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Generation[];
    },
  });
}

export function useCreateBatch() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      baseAssetId,
      referenceAssetIds,
      aiParameters,
    }: {
      baseAssetId: string;
      referenceAssetIds: string[];
      aiParameters: AiParameters;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Create batch
      const { data: batch, error: batchError } = await supabase
        .from("generation_batches")
        .insert({ user_id: user.id, status: "processing" })
        .select()
        .single();
      if (batchError) throw batchError;

      // Create generations
      const generations = referenceAssetIds.map((refId) => ({
        batch_id: batch.id,
        user_id: user.id,
        base_asset_id: baseAssetId,
        reference_asset_id: refId,
        ai_parameters: aiParameters as any,
        status: "pending" as const,
      }));

      const { data: insertedGens, error: genError } = await supabase
        .from("generations")
        .insert(generations)
        .select();
      if (genError) throw genError;

      // Fire-and-forget: invoke Edge Function for each generation
      for (const gen of insertedGens || []) {
        supabase.functions
          .invoke("process-generation", {
            body: { generation_id: gen.id },
          })
          .then(({ error }) => {
            if (error) console.error(`Edge function error for ${gen.id}:`, error);
          });
      }

      return batch as GenerationBatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["generations-all"] });
    },
  });
}
