import { formatDistanceToNowStrict, differenceInMinutes, differenceInHours, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
