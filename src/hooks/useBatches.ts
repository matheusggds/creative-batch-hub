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
        status: "processing" as const,
      }));

      const { error: genError } = await supabase.from("generations").insert(generations);
      if (genError) throw genError;

      // Mock: simulate processing with 4s timeout
      setTimeout(async () => {
        await supabase
          .from("generations")
          .update({ status: "completed", result_url: "/placeholder.svg" })
          .eq("batch_id", batch.id);

        await supabase
          .from("generation_batches")
          .update({ status: "completed" })
          .eq("id", batch.id);

        qc.invalidateQueries({ queryKey: ["batches"] });
        qc.invalidateQueries({ queryKey: ["generations-all"] });
      }, 4000);

      return batch as GenerationBatch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["generations-all"] });
    },
  });
}
