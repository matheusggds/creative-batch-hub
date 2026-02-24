import { supabase } from "@/integrations/supabase/client";

export async function uploadAssetFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop();
  const filePath = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("ugc-assets").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from("ugc-assets").getPublicUrl(filePath);
  return data.publicUrl;
}
