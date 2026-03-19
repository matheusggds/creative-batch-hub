import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { humanizeStep, friendlyErrorCode } from "@/lib/generation-utils";
import {
  ImageIcon,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
  Camera,
  Upload,
  Sparkles,
  Tag,
  FileText,
  Images,
  Cpu,
  Layers,
  ClipboardCopy,
} from "lucide-react";
import { AvatarGeneration } from "@/hooks/useAvatarGenerations";
import { AvatarReferenceAsset } from "@/hooks/useAvatarProfile";
import { useGenerationReferenceAssets } from "@/hooks/useGenerationReferenceAssets";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

export type GridItem =
  | { type: "reference"; ref: AvatarReferenceAsset; generation?: AvatarGeneration }
  | { type: "generation"; generation: AvatarGeneration };

interface ImageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GridItem | null;
  navigableCount?: number;
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

const SHOT_LABELS: Record<string, string> = {
  // Torso/Head shots (new pipeline)
  TH1_FRONT_NEUTRAL: "Frontal Neutro",
  TH2_FRONT_GENTLE_SMILE: "Frontal Sorriso Leve",
  TH3_FRONT_SPEAKING_FRAME: "Frontal Falando",
  TH4_45_NEUTRAL: "45° Neutro",
  TH5_45_GENTLE_SMILE: "45° Sorriso Leve",
  TH6_PROFILE_90_NEUTRAL: "Perfil 90° Neutro",
  // Full body shots (new pipeline)
  FB1_FULL_FRONT: "Corpo Inteiro Frontal",
  FB2_FULL_45: "Corpo Inteiro 45°",
  FB3_FULL_PROFILE_90: "Corpo Inteiro Perfil 90°",
  FB4_FULL_BACK_180: "Corpo Inteiro Costas",
  FB5_HANDS_FOCUS: "Foco nas Mãos",
  FB6_UPPER_GARMENT_DETAIL: "Detalhe Roupa Superior",
  FB7_LOWER_GARMENT_DETAIL: "Detalhe Roupa Inferior",
  FB8_LIFESTYLE_UGC: "Lifestyle UGC",
  // Legacy shot IDs
  TH2_FRONT_LEFT: "Frontal Esquerda",
  TH3_FRONT_RIGHT: "Frontal Direita",
  TH4_LEFT_PROFILE: "Perfil Esquerdo",
  TH5_RIGHT_PROFILE: "Perfil Direito",
  TH6_THREE_QUARTER_LEFT: "¾ Esquerda",
  TH7_THREE_QUARTER_RIGHT: "¾ Direita",
  FB2_FULL_LEFT: "Corpo Inteiro Esquerda",
  FB3_FULL_RIGHT: "Corpo Inteiro Direita",
  FB4_FULL_BACK: "Corpo Inteiro Costas",
  FB5_THREE_QUARTER_FRONT_LEFT: "Corpo ¾ Frontal Esq.",
  FB6_THREE_QUARTER_FRONT_RIGHT: "Corpo ¾ Frontal Dir.",
  FB7_FULL_SITTING: "Corpo Sentado",
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  queued: { label: "Na fila", variant: "secondary" },
  processing: { label: "Processando", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
};

function formatTs(ts: string | null) {
  if (!ts) return "—";
  try {
    return format(new Date(ts), "dd/MM/yyyy HH:mm");
  } catch {
    return ts;
  }
}

function getAiParam(gen: AvatarGeneration | undefined, key: string): unknown {
  if (!gen?.ai_parameters || typeof gen.ai_parameters !== "object") return null;
  return (gen.ai_parameters as Record<string, unknown>)[key] ?? null;
}

function getRawShotLabel(gen?: AvatarGeneration): string | null {
  // New pipeline stores shotId at top level + _debug.selectedShotId
  const shotId = getAiParam(gen, "shotId");
  if (shotId) return String(shotId);
  const debug = getAiParam(gen, "_debug") as Record<string, unknown> | null;
  if (debug?.selectedShotId) return String(debug.selectedShotId);
  // Legacy pipeline
  const v = getAiParam(gen, "shot_label");
  return v ? String(v) : null;
}

function getHumanShotLabel(gen?: AvatarGeneration): string | null {
  // New pipeline may already have a human-readable label in _debug.shotLabel
  const debug = getAiParam(gen, "_debug") as Record<string, unknown> | null;
  if (debug?.shotLabel && typeof debug.shotLabel === "string") return debug.shotLabel;
  const raw = getRawShotLabel(gen);
  if (!raw) return null;
  return SHOT_LABELS[raw] ?? raw.replace(/_/g, " ");
}

function getSourceModeLabel(mode: string | null): string | null {
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

function getPipelineLabel(pt: string | null): string {
  if (!pt) return "—";
  const map: Record<string, string> = {
    text_to_image: "Texto → Imagem",
    image_to_image: "Imagem → Imagem",
    avatar_base_angles: "Ângulos Base do Avatar",
    multimodal_image_generation: "Geração de imagem",
  };
  return map[pt] ?? pt.replace(/_/g, " ");
}

function getFriendlyModelName(model?: string | null, thinkingLevel?: string | null): string {
  if (!model) return "Desconhecido";
  if (model === "gemini-3-pro-image-preview") return "Nano Banana Pro";
  if (model === "gemini-3.1-flash-image-preview") {
    if (thinkingLevel === "high") return "Nano Banana 2 High";
    if (thinkingLevel === "minimal") return "Nano Banana 2 Fast";
    return "Nano Banana 2";
  }
  return model;
}

function getModelUsed(gen?: AvatarGeneration): { prompt_model: string | null; image_model: string | null; image_model_raw: string | null; thinking_level: string | null } {
  const debug = getAiParam(gen, "_debug") as Record<string, unknown> | null;
  const geminiModel = getAiParam(gen, "gemini_model_used");
  const imageModel = geminiModel
    ? String(geminiModel)
    : debug?.lastModelUsed
    ? String(debug.lastModelUsed)
    : debug?.image_model
    ? String(debug.image_model)
    : null;
  
  const thinkingLevel = getAiParam(gen, "thinking_level")
    ? String(getAiParam(gen, "thinking_level"))
    : debug?.thinking_level
    ? String(debug.thinking_level)
    : null;

  const hasOpenaiResponse = !!getAiParam(gen, "openai_raw_response");
  const lastProvider = debug?.lastProvider ? String(debug.lastProvider) : null;
  const promptModel = hasOpenaiResponse ? "GPT-4o" 
    : (lastProvider === "google" ? null : (debug?.prompt_model ? String(debug.prompt_model) : null));

  return { prompt_model: promptModel, image_model: imageModel, image_model_raw: imageModel, thinking_level: thinkingLevel };
}

function getPromptText(gen?: AvatarGeneration): string | null {
  const debug = getAiParam(gen, "_debug") as Record<string, unknown> | null;
  // New pipeline: finalPromptPreview in _debug
  if (debug?.finalPromptPreview && typeof debug.finalPromptPreview === "string") {
    return debug.finalPromptPreview;
  }
  // Legacy pipeline: extracted_positive_prompt in ai_parameters
  const aiParams = gen?.ai_parameters as Record<string, unknown> | null;
  if (aiParams?.extracted_positive_prompt && typeof aiParams.extracted_positive_prompt === "string") {
    return aiParams.extracted_positive_prompt;
  }
  // Fallback: extracted_prompt on generation row
  return gen?.extracted_prompt || null;
}

function getRefCount(gen?: AvatarGeneration): number | null {
  const debug = getAiParam(gen, "_debug") as Record<string, unknown> | null;
  if (debug?.referenceCount) return Number(debug.referenceCount);
  const refs = getAiParam(gen, "reference_asset_ids");
  if (Array.isArray(refs)) return refs.length;
  return null;
}

/* ── Metadata Row ── */
function MetaRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}</span>
        <div className="text-foreground mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export function ImageDetailModal({ open, onOpenChange, item, navigableCount = 0, currentIndex = -1, onNavigate }: ImageDetailModalProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex >= 0 && currentIndex < navigableCount - 1;

  const goPrev = useCallback(() => {
    if (canGoPrev && onNavigate) onNavigate(currentIndex - 1);
  }, [canGoPrev, onNavigate, currentIndex]);

  const goNext = useCallback(() => {
    if (canGoNext && onNavigate) onNavigate(currentIndex + 1);
  }, [canGoNext, onNavigate, currentIndex]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, goPrev, goNext]);

  const generation = item
    ? item.type === "generation"
      ? item.generation
      : item.generation
    : undefined;

  const { data: refAssets, isLoading: refAssetsLoading } = useGenerationReferenceAssets(
    generation?.id
  );

  if (!item) return null;

  const imageUrl =
    item.type === "reference" ? item.ref.file_url : item.generation.result_url;
  const isOriginalRef = item.type === "reference" && !generation;
  const isActive =
    generation && ["pending", "queued", "processing"].includes(generation.status);
  const isFailed = generation?.status === "failed";

  const shotLabel = getHumanShotLabel(generation);
  const rawShotLabel = getRawShotLabel(generation);
  const models = getModelUsed(generation);
  const refCount = getRefCount(generation) ?? refAssets?.length ?? null;

  const badge = generation
    ? statusConfig[generation.status] ?? { label: generation.status, variant: "outline" as const }
    : null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const title = shotLabel
    ? `Imagem Gerada • ${shotLabel}`
    : isOriginalRef
    ? "Referência Original"
    : generation
    ? "Imagem Gerada"
    : "Referência";

  const promptText = getPromptText(generation);
  const promptIsLong = promptText && promptText.length > 200;

  // Build generation summary sentence
  const summaryParts: string[] = [];
  if (generation) {
    if (shotLabel) summaryParts.push(`Enquadramento: ${shotLabel}`);
    if (generation.source_mode) {
      summaryParts.push(`Modo: ${getSourceModeLabel(generation.source_mode)}`);
    }
    if (refCount && refCount > 0) {
      summaryParts.push(`${refCount} referência${refCount > 1 ? "s" : ""} usada${refCount > 1 ? "s" : ""}`);
    }
    if (models.image_model) summaryParts.push(`Modelo: ${getFriendlyModelName(models.image_model, models.thinking_level)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] overflow-hidden gap-0 p-0">
        <div className="flex flex-col md:flex-row h-full min-h-0">
          {/* Left: Image preview */}
          <div className="md:w-[55%] w-full shrink-0 bg-muted flex items-center justify-center h-[280px] md:h-full relative overflow-hidden">
            {isActive ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {humanizeStep(generation!.current_step)}
                </span>
                {generation!.progress_pct > 0 && (
                  <Progress value={generation!.progress_pct} className="w-40 h-2" />
                )}
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2 text-destructive p-6">
                <AlertTriangle className="h-10 w-10" />
                <span className="text-sm font-medium">{friendlyErrorCode(generation?.error_code)}</span>
              </div>
            ) : imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="h-full w-full object-contain"
              />
            ) : (
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            )}

            {/* Navigation arrows */}
            {onNavigate && navigableCount > 1 && (
              <>
                <button
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur-sm p-1.5 border border-border/50 hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-opacity text-foreground"
                  aria-label="Imagem anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur-sm p-1.5 border border-border/50 hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-opacity text-foreground"
                  aria-label="Próxima imagem"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 rounded-full bg-background/70 backdrop-blur-sm px-2.5 py-0.5 border border-border/50">
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {currentIndex + 1} de {navigableCount}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right: Info panel */}
          <div className="md:w-[45%] w-full flex-1 md:flex-none flex flex-col p-5 gap-0 overflow-y-auto h-full min-h-0">
            {/* Header */}
            <DialogHeader className="space-y-1 pb-3">
              <DialogTitle className="text-base font-semibold leading-snug">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
                {isOriginalRef ? (
                  <Upload className="h-3 w-3 shrink-0" />
                ) : generation ? (
                  <Sparkles className="h-3 w-3 shrink-0" />
                ) : (
                  <Camera className="h-3 w-3 shrink-0" />
                )}
                {isOriginalRef
                  ? "Carregada manualmente como referência do avatar"
                  : generation
                  ? "Gerada automaticamente por IA"
                  : "Referência do avatar"}
              </DialogDescription>
            </DialogHeader>

            {/* Generation Summary */}
            {generation && summaryParts.length > 0 && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 mb-3">
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3 w-3" />
                  Resumo da geração
                </p>
                <p className="text-xs text-foreground leading-relaxed">
                  {summaryParts.join(" · ")}
                </p>
              </div>
            )}

            {/* Primary metadata */}
            {generation && (
              <div className="space-y-3 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {badge && (
                    <Badge variant={badge.variant} className="text-[10px]">
                      {badge.label}
                    </Badge>
                  )}
                  {isOriginalRef ? (
                    <Badge variant="outline" className="text-[10px]">Original</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">Gerada</Badge>
                  )}
                </div>

                <div className="space-y-2.5">
                  {shotLabel && (
                    <MetaRow icon={Camera} label="Enquadramento">
                      {shotLabel}
                    </MetaRow>
                  )}

                  <MetaRow icon={Clock} label="Criada em">
                    {formatTs(generation.created_at)}
                  </MetaRow>

                  {models.image_model && (
                    <MetaRow icon={Cpu} label="Modelo de imagem">
                      <span className="text-[11px]">{getFriendlyModelName(models.image_model, models.thinking_level)}</span>
                    </MetaRow>
                  )}

                  {models.prompt_model && (
                    <MetaRow icon={Cpu} label="Modelo de prompt">
                      <span className="font-mono text-[11px]">{models.prompt_model}</span>
                    </MetaRow>
                  )}

                  {generation.source_mode && (
                    <MetaRow icon={Layers} label="Tipo de geração">
                      {getSourceModeLabel(generation.source_mode)}
                    </MetaRow>
                  )}
                </div>
              </div>
            )}

            {!generation && isOriginalRef && (
              <div className="space-y-2.5 pb-3">
                <MetaRow icon={Tag} label="Tipo">
                  Referência Original
                </MetaRow>
              </div>
            )}

            {/* Prompt section */}
            {promptText && (
              <>
                <Separator className="my-1" />
                <div className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />
                      Prompt utilizado
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(promptText, "prompt")}
                    >
                      {copiedField === "prompt" ? (
                        <CheckCircle2 className="h-3 w-3 text-primary" />
                      ) : (
                        <ClipboardCopy className="h-3 w-3" />
                      )}
                      {copiedField === "prompt" ? "Copiado" : "Copiar"}
                    </Button>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                    <p
                      className={`text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap ${
                        !promptExpanded && promptIsLong ? "line-clamp-5" : ""
                      }`}
                    >
                      {promptText}
                    </p>
                  </div>
                  {promptIsLong && (
                    <button
                      onClick={() => setPromptExpanded(!promptExpanded)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      {promptExpanded ? "Ver menos" : "Ver prompt completo"}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Reference images used */}
            {generation && (
              <>
                <Separator className="my-1" />
                <div className="py-3 space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Images className="h-3 w-3" />
                    Referências usadas
                    {refAssets && refAssets.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/70 ml-1">
                        ({refAssets.length})
                      </span>
                    )}
                  </p>
                  {refAssetsLoading ? (
                    <div className="flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-16 rounded-md" />
                      ))}
                    </div>
                  ) : refAssets && refAssets.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {refAssets.map((ra, idx) => (
                        <div
                          key={ra.id}
                          className="relative group/ref h-16 w-16 rounded-md border border-border/50 overflow-hidden bg-muted shrink-0"
                          title={ra.asset_name ?? `Referência ${idx + 1}`}
                        >
                          {ra.file_url ? (
                            <img
                              src={ra.file_url}
                              alt={ra.asset_name ?? `Referência ${idx + 1}`}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                          {idx === 0 && refAssets.length > 1 && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-center">
                              <span className="text-[8px] text-white font-medium">Principal</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Nenhuma referência registrada
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Technical details — collapsible */}
            {generation && (
              <>
                <Separator className="my-1" />
                <Collapsible open={debugOpen} onOpenChange={setDebugOpen} className="py-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full">
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${debugOpen ? "" : "-rotate-90"}`}
                      />
                      Detalhes técnicos
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/30 p-3">
                      <span className="font-medium">Pipeline</span>
                      <span>{getPipelineLabel(generation.pipeline_type)}</span>

                      <span className="font-medium">Source Mode</span>
                      <span>{generation.source_mode ?? "—"}</span>

                      <span className="font-medium">Início</span>
                      <span>{formatTs(generation.started_at)}</span>

                      <span className="font-medium">Fim</span>
                      <span>{formatTs(generation.finished_at)}</span>

                      {generation.tool_type && (
                        <>
                          <span className="font-medium">Ferramenta</span>
                          <span>{generation.tool_type}</span>
                        </>
                      )}

                      {generation.error_code && (
                        <>
                          <span className="font-medium">Erro</span>
                          <span className="text-destructive">{generation.error_code}</span>
                        </>
                      )}

                      {models.image_model_raw && (
                        <>
                          <span className="font-medium">Image Model</span>
                          <span className="font-mono text-[10px]">{models.image_model_raw}</span>
                        </>
                      )}

                      {models.thinking_level && (
                        <>
                          <span className="font-medium">Thinking Level</span>
                          <span className="font-mono text-[10px]">{models.thinking_level}</span>
                        </>
                      )}

                      {rawShotLabel && (
                        <>
                          <span className="font-medium">Shot ID</span>
                          <span className="font-mono text-[10px]">{rawShotLabel}</span>
                        </>
                      )}

                      {generation.result_asset_id && (
                        <>
                          <span className="font-medium">Result Asset</span>
                          <span className="font-mono text-[10px]">{generation.result_asset_id.slice(0, 12)}…</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px]">
                        ID: {generation.id.slice(0, 12)}…
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5"
                        onClick={() => copyToClipboard(generation.id, "id")}
                      >
                        {copiedField === "id" ? (
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}

            {/* Actions */}
            <div className="flex justify-end pt-2 mt-auto">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
