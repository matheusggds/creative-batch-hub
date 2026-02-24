import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { UGC_SYSTEM_PROMPT } from "./system-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let generationId: string | undefined;

  try {
    const body = await req.json();
    generationId = body.generation_id;
    if (!generationId) throw new Error("generation_id is required");

    // ── 1. Setup: fetch generation record + asset URLs ──────────────
    const { data: gen, error: genErr } = await supabase
      .from("generations")
      .select("*")
      .eq("id", generationId)
      .single();
    if (genErr || !gen) throw new Error(`Generation not found: ${genErr?.message}`);

    // Update status to processing
    await supabase
      .from("generations")
      .update({ status: "processing" })
      .eq("id", generationId);

    // Get public URLs for the two assets
    const { data: baseAsset } = await supabase
      .from("assets")
      .select("file_url")
      .eq("id", gen.base_asset_id)
      .single();
    const { data: refAsset } = await supabase
      .from("assets")
      .select("file_url")
      .eq("id", gen.reference_asset_id)
      .single();

    if (!baseAsset?.file_url || !refAsset?.file_url) {
      throw new Error("Asset URLs not found");
    }

    const avatarUrl = baseAsset.file_url;
    const referenceUrl = refAsset.file_url;

    // ── 2. Salto 1: OpenAI Vision (Estrategista de Prompt) ──────────
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

    console.log(`[Salto 1] Calling OpenAI Vision for generation ${generationId}`);

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: UGC_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Me gere o prompt dessa imagem." },
              { type: "image_url", image_url: { url: referenceUrl } },
            ],
          },
        ],
        max_tokens: 2000,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI API error (${openaiRes.status}): ${errText}`);
    }

    const openaiData = await openaiRes.json();
    const rawPromptText =
      openaiData.choices?.[0]?.message?.content ?? "";

    console.log(`[Salto 1] OpenAI responded. Parsing prompts...`);

    // Parse POSITIVE PROMPT and STRICT NEGATIVES from markdown
    let positivePrompt = "";
    let negativePrompt = "";

    const positiveMatch = rawPromptText.match(
      /POSITIVE PROMPT[:\s]*\n?([\s\S]*?)(?=STRICT NEGATIVES|NEGATIVE|$)/i
    );
    if (positiveMatch) {
      positivePrompt = positiveMatch[1].trim();
    }

    const negativeMatch = rawPromptText.match(
      /STRICT NEGATIVES?[:\s]*\n?([\s\S]*?)$/i
    );
    if (negativeMatch) {
      negativePrompt = negativeMatch[1].trim();
    }

    // If parsing failed, use the whole text as positive prompt
    if (!positivePrompt) {
      positivePrompt = rawPromptText;
    }

    // Audit: save raw OpenAI response into ai_parameters
    const existingParams = (gen.ai_parameters as Record<string, unknown>) || {};
    const updatedParams = {
      ...existingParams,
      openai_raw_response: rawPromptText,
      extracted_positive_prompt: positivePrompt,
      extracted_negative_prompt: negativePrompt,
    };

    await supabase
      .from("generations")
      .update({ ai_parameters: updatedParams })
      .eq("id", generationId);

    console.log(`[Salto 1] Prompts saved to DB. Starting Salto 2...`);

    // ── 3. Salto 2: Google Gemini / Imagen (Renderizador Visual) ────
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    // Download avatar image as base64
    const avatarResponse = await fetch(avatarUrl);
    if (!avatarResponse.ok) throw new Error("Failed to download avatar image");
    const avatarBuffer = await avatarResponse.arrayBuffer();
    const avatarBase64 = btoa(
      String.fromCharCode(...new Uint8Array(avatarBuffer))
    );
    const avatarMime = avatarResponse.headers.get("content-type") || "image/png";

    // Build the Gemini request — structure ready for fine-tuning
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`;

    const geminiPayload = {
      contents: [
        {
          parts: [
            {
              text: `Generate an image based on this person wearing the described outfit.\n\nPOSITIVE PROMPT:\n${positivePrompt}\n\nSTRICT NEGATIVES:\n${negativePrompt}`,
            },
            {
              inline_data: {
                mime_type: avatarMime,
                data: avatarBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    console.log(`[Salto 2] Calling Gemini for image generation...`);

    const geminiRes = await fetch(geminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API error (${geminiRes.status}): ${errText}`);
    }

    const geminiData = await geminiRes.json();

    // Extract the generated image from Gemini response
    let imageBase64: string | null = null;
    let imageMime = "image/png";

    const candidates = geminiData.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data) {
          imageBase64 = part.inline_data.data;
          imageMime = part.inline_data.mime_type || "image/png";
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      throw new Error("Gemini did not return an image");
    }

    console.log(`[Salto 2] Image received. Uploading to storage...`);

    // ── 4. Finalização: Upload + Update DB ──────────────────────────
    // Convert base64 to Uint8Array
    const binaryStr = atob(imageBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = imageMime.includes("png") ? "png" : "jpg";
    const fileName = `${gen.user_id}/generated/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("ugc-assets")
      .upload(fileName, bytes, {
        contentType: imageMime,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage
      .from("ugc-assets")
      .getPublicUrl(fileName);

    const resultUrl = publicUrlData.publicUrl;

    // Update generation as completed
    await supabase
      .from("generations")
      .update({ status: "completed", result_url: resultUrl })
      .eq("id", generationId);

    // Check if all generations in this batch are done
    const { data: batchGens } = await supabase
      .from("generations")
      .select("status")
      .eq("batch_id", gen.batch_id);

    const allDone = batchGens?.every(
      (g) => g.status === "completed" || g.status === "failed"
    );

    if (allDone) {
      await supabase
        .from("generation_batches")
        .update({ status: "completed" })
        .eq("id", gen.batch_id);
    }

    console.log(`[Done] Generation ${generationId} completed successfully.`);

    return new Response(JSON.stringify({ success: true, result_url: resultUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Error] Generation ${generationId}: ${msg}`);

    // Update status to failed
    if (generationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      await sb
        .from("generations")
        .update({
          status: "failed",
          ai_parameters: { error: msg },
        })
        .eq("id", generationId);
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
