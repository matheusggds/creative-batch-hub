import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabaseUser.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { deleteMode, assetId, avatarProfileId } = await req.json();

    // Service role client for cascading deletes
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (deleteMode === "asset") {
      if (!assetId) {
        return new Response(JSON.stringify({ error: "assetId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: asset, error: assetErr } = await supabaseAdmin
        .from("assets")
        .select("id, user_id, file_url")
        .eq("id", assetId)
        .single();

      if (assetErr || !asset || asset.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Asset not found or not owned" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete links first
      await supabaseAdmin.from("avatar_reference_assets").delete().eq("asset_id", assetId);
      await supabaseAdmin.from("generation_reference_assets").delete().eq("asset_id", assetId);

      // Nullify FK references in generations
      await supabaseAdmin.from("generations").update({ reference_asset_id: null } as any).eq("reference_asset_id", assetId);
      await supabaseAdmin.from("generations").update({ base_asset_id: null }).eq("base_asset_id", assetId);
      await supabaseAdmin.from("generations").update({ result_asset_id: null }).eq("result_asset_id", assetId);

      // Delete the asset record
      const { error: delErr } = await supabaseAdmin.from("assets").delete().eq("id", assetId);
      if (delErr) throw delErr;

      // Try to remove from storage (best effort)
      try {
        const url = new URL(asset.file_url);
        const pathParts = url.pathname.split("/storage/v1/object/public/");
        if (pathParts.length === 2) {
          const [bucket, ...rest] = pathParts[1].split("/");
          await supabaseAdmin.storage.from(bucket).remove([rest.join("/")]);
        }
      } catch { /* ignore storage errors */ }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (deleteMode === "avatar") {
      if (!avatarProfileId) {
        return new Response(JSON.stringify({ error: "avatarProfileId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      const { data: profile, error: profErr } = await supabaseAdmin
        .from("avatar_profiles")
        .select("id, user_id")
        .eq("id", avatarProfileId)
        .single();

      if (profErr || !profile || profile.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Avatar not found or not owned" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get all reference assets linked to this avatar
      const { data: refs } = await supabaseAdmin
        .from("avatar_reference_assets")
        .select("asset_id")
        .eq("avatar_profile_id", avatarProfileId);

      const assetIds = refs?.map((r: { asset_id: string }) => r.asset_id) ?? [];

      // Delete avatar_reference_assets
      await supabaseAdmin.from("avatar_reference_assets").delete().eq("avatar_profile_id", avatarProfileId);

      // Nullify avatar_profile_id in generations
      await supabaseAdmin
        .from("generations")
        .update({ avatar_profile_id: null })
        .eq("avatar_profile_id", avatarProfileId);

      // Delete the avatar profile
      const { error: delErr } = await supabaseAdmin
        .from("avatar_profiles")
        .delete()
        .eq("id", avatarProfileId);
      if (delErr) throw delErr;

      // Clean up orphaned assets (best effort)
      for (const aid of assetIds) {
        // Check if asset is still referenced elsewhere
        const { count } = await supabaseAdmin
          .from("avatar_reference_assets")
          .select("id", { count: "exact", head: true })
          .eq("asset_id", aid);
        if ((count ?? 0) === 0) {
          await supabaseAdmin.from("generation_reference_assets").delete().eq("asset_id", aid);
          await supabaseAdmin.from("generations").update({ reference_asset_id: null } as any).eq("reference_asset_id", aid);
          await supabaseAdmin.from("generations").update({ base_asset_id: null }).eq("base_asset_id", aid);
          await supabaseAdmin.from("generations").update({ result_asset_id: null }).eq("result_asset_id", aid);
          await supabaseAdmin.from("assets").delete().eq("id", aid);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid deleteMode" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-asset error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
