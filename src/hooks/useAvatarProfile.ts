import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AvatarReferenceAsset {
  id: string;
  asset_id: string;
  role: string;
  sort_order: number;
  file_url: string | null;
  asset_name: string | null;
}

export interface AvatarProfileDetail {
  id: string;
  name: string;
  status: string;
  cover_asset_id: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  references: AvatarReferenceAsset[];
}

export function useAvatarProfile(avatarId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["avatar_profile", avatarId],
    enabled: !!user && !!avatarId,
    queryFn: async (): Promise<AvatarProfileDetail> => {
      // Fetch profile
      const { data: profile, error } = await supabase
        .from("avatar_profiles")
        .select("id, name, status, cover_asset_id, created_at, updated_at")
        .eq("id", avatarId!)
        .single();

      if (error) throw error;

      // Fetch cover URL
      let coverUrl: string | null = null;
      if (profile.cover_asset_id) {
        const { data: coverAsset } = await supabase
          .from("assets")
          .select("file_url")
          .eq("id", profile.cover_asset_id)
          .single();
        coverUrl = coverAsset?.file_url ?? null;
      }

      // Fetch references joined with assets
      const { data: refs, error: refsError } = await supabase
        .from("avatar_reference_assets")
        .select("id, asset_id, role, sort_order")
        .eq("avatar_profile_id", avatarId!)
        .order("sort_order");

      if (refsError) throw refsError;

      let references: AvatarReferenceAsset[] = [];
      if (refs && refs.length > 0) {
        const assetIds = refs.map((r) => r.asset_id);
        const { data: assets } = await supabase
          .from("assets")
          .select("id, file_url, name")
          .in("id", assetIds);

        const assetMap = Object.fromEntries(
          (assets ?? []).map((a) => [a.id, a])
        );

        references = refs.map((r) => ({
          id: r.id,
          asset_id: r.asset_id,
          role: r.role,
          sort_order: r.sort_order,
          file_url: assetMap[r.asset_id]?.file_url ?? null,
          asset_name: assetMap[r.asset_id]?.name ?? null,
        }));
      }

      return {
        id: profile.id,
        name: profile.name,
        status: profile.status,
        cover_asset_id: profile.cover_asset_id,
        cover_url: coverUrl,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        references,
      };
    },
  });
}
