import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadAssetFile } from "@/lib/storage";
import type { Asset } from "@/types/studio";

export function useAssets(type?: Asset["type"]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["assets", type],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("assets").select("*").order("created_at", { ascending: false });
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as Asset[];
    },
  });
}

export function useUploadAsset() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, type }: { file: File; type: Asset["type"] }) => {
      if (!user) throw new Error("Not authenticated");
      const fileUrl = await uploadAssetFile(user.id, file);
      const { data, error } = await supabase
        .from("assets")
        .insert({ user_id: user.id, type, file_url: fileUrl, name: file.name })
        .select()
        .single();
      if (error) throw error;
      return data as Asset;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}
