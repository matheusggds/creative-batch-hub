import { differenceInMinutes, differenceInHours, differenceInDays, format } from "date-fns";

/**
 * Short friendly model name for badges on cards.
 */
export function getShortModelName(
  imageModel?: string | null,
  thinkingLevel?: string | null
): string | null {
  if (!imageModel) return null;
  if (imageModel === "gemini-3-pro-image-preview") return "Pro";
  if (imageModel === "gemini-3.1-flash-image-preview") {
    if (thinkingLevel === "high") return "High";
    if (thinkingLevel === "minimal") return "Fast";
    return "Flash";
  }
  return imageModel.split("/").pop()?.slice(0, 12) ?? imageModel;
}

/**
 * Tailwind classes for model badge background color.
 */
export function getModelBadgeClasses(shortName: string | null): string {
  switch (shortName) {
    case "Pro":
      return "bg-purple-800/80 border-purple-600/50 text-white";
    case "High":
      return "bg-blue-800/80 border-blue-600/50 text-white";
    case "Fast":
      return "bg-emerald-800/80 border-emerald-600/50 text-white";
    default:
      return "bg-zinc-700/80 border-zinc-500/50 text-white";
  }
}

/**
 * Extract image_model and thinking_level from a generation's ai_parameters.
 */
export function extractModelInfo(aiParameters: unknown): {
  imageModel: string | null;
  thinkingLevel: string | null;
} {
  if (!aiParameters || typeof aiParameters !== "object") {
    return { imageModel: null, thinkingLevel: null };
  }
  const params = aiParameters as Record<string, unknown>;
  const debug = params._debug as Record<string, unknown> | null;

  const geminiModel = params.gemini_model_used;
  const imageModel = geminiModel
    ? String(geminiModel)
    : debug?.lastModelUsed
    ? String(debug.lastModelUsed)
    : debug?.image_model
    ? String(debug.image_model)
    : null;

  const thinkingLevel = params.thinking_level
    ? String(params.thinking_level)
    : debug?.thinking_level
    ? String(debug.thinking_level)
    : null;

  return { imageModel, thinkingLevel };
}

/**
 * Relative time string in Portuguese.
 */
export function relativeTime(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const mins = differenceInMinutes(now, date);
    if (mins < 1) return "agora";
    const hrs = differenceInHours(now, date);
    if (mins < 60) return `${mins}min atrás`;
    const days = differenceInDays(now, date);
    if (hrs < 24) return `${hrs}h atrás`;
    if (days < 7) return `${days} dia${days > 1 ? "s" : ""} atrás`;
    return format(date, "dd/MM/yyyy");
  } catch {
    return null;
  }
}

/**
 * Humanize a generation step name for the UI.
 */
const STEP_LABELS_MAP: Record<string, string> = {
  generate_image: "Gerando imagem...",
  extract_prompt: "Analisando imagem...",
  gemini_multimodal_generation: "Gerando imagem...",
  upload_result: "Salvando resultado...",
};

export function humanizeStep(step: string | null): string {
  if (!step) return "Processando…";
  return STEP_LABELS_MAP[step] ?? "Processando...";
}

/**
 * Translate error codes to friendly Portuguese messages.
 */
const ERROR_MAP: Record<string, string> = {
  gemini_multimodal_generation_failed: "A geração falhou. Tente novamente.",
  gemini_generation_failed: "A geração falhou. Tente novamente.",
  provider_timeout_50s: "A geração demorou demais. Tente novamente.",
  provider_timeout_60s: "A geração demorou demais. Tente novamente.",
  provider_timeout: "A geração demorou demais. Tente novamente.",
  "non-2xx": "A geração falhou. Tente novamente.",
};

export function friendlyErrorCode(code?: string | null): string {
  if (!code) return "Ocorreu um erro. Tente novamente.";
  return ERROR_MAP[code] ?? "Ocorreu um erro. Tente novamente.";
}

/**
 * Humanize pipeline type for the inspector summary.
 */
export function humanizePipeline(pt: string | null): string {
  if (!pt) return "—";
  const map: Record<string, string> = {
    text_to_image: "Texto → Imagem",
    image_to_image: "Imagem → Imagem",
    avatar_base_angles: "Ângulos Base do Avatar",
    multimodal_image_generation: "Geração de imagem",
  };
  return map[pt] ?? pt.replace(/_/g, " ");
}

/**
 * Humanize source mode for the inspector.
 */
export function humanizeSourceMode(mode: string | null): string | null {
  if (!mode) return null;
  const map: Record<string, string> = {
    text_to_image: "Texto → Imagem",
    image_to_image: "Imagem → Imagem",
    reference_based: "Baseado em Referência",
    avatar_workspace: "Avatar Workspace",
    quick_flow: "Quick Flow",
  };
  return map[mode] ?? mode.replace(/_/g, " ");
}
