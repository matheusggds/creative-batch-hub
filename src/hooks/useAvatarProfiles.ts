import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AvatarProfileWithMeta {
  id: string;
  name: string;
  status: string;
  cover_asset_id: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  reference_count: number;
}

export function useAvatarProfiles() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["avatar_profiles"],
    enabled: !!user,
    queryFn: async (): Promise<AvatarProfileWithMeta[]> => {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from("avatar_profiles")
        .select("id, name, status, cover_asset_id, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      // Fetch cover asset URLs
      const coverIds = profiles
        .map((p) => p.cover_asset_id)
        .filter(Boolean) as string[];

      let coverMap: Record<string, string> = {};
      if (coverIds.length > 0) {
        const { data: coverAssets } = await supabase
          .from("assets")
          .select("id, file_url")
          .in("id", coverIds);
        if (coverAssets) {
          coverMap = Object.fromEntries(coverAssets.map((a) => [a.id, a.file_url]));
        }
      }

      // Fetch reference counts
      const profileIds = profiles.map((p) => p.id);
      const { data: refs } = await supabase
        .from("avatar_reference_assets")
        .select("avatar_profile_id")
        .in("avatar_profile_id", profileIds);

      const countMap: Record<string, number> = {};
      if (refs) {
        for (const r of refs) {
          countMap[r.avatar_profile_id] = (countMap[r.avatar_profile_id] || 0) + 1;
        }
      }

      return profiles.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        cover_asset_id: p.cover_asset_id,
        cover_url: p.cover_asset_id ? coverMap[p.cover_asset_id] ?? null : null,
        created_at: p.created_at,
        updated_at: p.updated_at,
        reference_count: countMap[p.id] || 0,
      }));
    },
  });
}
