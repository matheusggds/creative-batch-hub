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
import {
  ImageIcon,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  Copy,
  CheckCircle2,
  Camera,
  Upload,
  Sparkles,
  Tag,
  FileText,
  Images,
} from "lucide-react";
import { AvatarGeneration } from "@/hooks/useAvatarGenerations";
import { AvatarReferenceAsset } from "@/hooks/useAvatarProfile";
import { useGenerationReferenceAssets } from "@/hooks/useGenerationReferenceAssets";
import { useState } from "react";
import { format } from "date-fns";

export type GridItem =
  | { type: "reference"; ref: AvatarReferenceAsset; generation?: AvatarGeneration }
  | { type: "generation"; generation: AvatarGeneration };

interface ImageDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: GridItem | null;
}

const SHOT_LABELS: Record<string, string> = {
  TH1_FRONT_NEUTRAL: "Frontal Neutro",
  TH2_FRONT_LEFT: "Frontal Esquerda",
  TH3_FRONT_RIGHT: "Frontal Direita",
  TH4_LEFT_PROFILE: "Perfil Esquerdo",
  TH5_RIGHT_PROFILE: "Perfil Direito",
  TH6_THREE_QUARTER_LEFT: "¾ Esquerda",
  TH7_THREE_QUARTER_RIGHT: "¾ Direita",
  FB1_FULL_FRONT: "Corpo Inteiro Frontal",
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

function getRawShotLabel(gen?: AvatarGeneration): string | null {
  if (!gen?.ai_parameters || typeof gen.ai_parameters !== "object") return null;
  const params = gen.ai_parameters as Record<string, unknown>;
  if ("shot_label" in params) return String(params.shot_label);
  return null;
}

function getHumanShotLabel(gen?: AvatarGeneration): string | null {
  const raw = getRawShotLabel(gen);
  if (!raw) return null;
  return SHOT_LABELS[raw] ?? raw.replace(/_/g, " ");
}

function getSourceModeLabel(mode: string | null): string | null {
  if (!mode) return null;
  const map: Record<string, string> = {
    text_to_image: "Texto para Imagem",
    image_to_image: "Imagem para Imagem",
    reference_based: "Baseado em Referência",
  };
  return map[mode] ?? mode.replace(/_/g, " ");
}

export function ImageDetailModal({ open, onOpenChange, item }: ImageDetailModalProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const badge = generation
    ? statusConfig[generation.status] ?? { label: generation.status, variant: "outline" as const }
    : null;

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const title = shotLabel
    ? `Imagem Gerada • ${shotLabel}`
    : isOriginalRef
    ? "Referência Original"
    : generation
    ? "Imagem Gerada"
    : "Referência";

  const promptText = generation?.extracted_prompt;
  const promptIsLong = promptText && promptText.length > 200;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        <div className="flex flex-col md:flex-row">
          {/* Left: Image preview */}
          <div className="md:w-1/2 w-full shrink-0 bg-muted flex items-center justify-center min-h-[280px] md:min-h-[420px] relative">
            {isActive ? (
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-sm font-medium">
                  {generation!.current_step ?? "Processando…"}
                </span>
                {generation!.progress_pct > 0 && (
                  <Progress value={generation!.progress_pct} className="w-40 h-2" />
                )}
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center gap-2 text-destructive p-6">
                <AlertTriangle className="h-10 w-10" />
                <span className="text-sm font-medium">Geração falhou</span>
                {generation?.error_code && (
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {generation.error_code}
                  </code>
                )}
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
          </div>

          {/* Right: Info panel */}
          <div className="md:w-1/2 w-full flex flex-col p-5 gap-4 overflow-y-auto max-h-[70vh] md:max-h-[90vh]">
            {/* Header */}
            <DialogHeader className="space-y-1.5">
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
                  ? "Carregada manualmente"
                  : generation
                  ? "Gerada por IA"
                  : "Referência do avatar"}
              </DialogDescription>
            </DialogHeader>

            {/* Primary metadata */}
            {generation && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span>
                    {badge && (
                      <Badge variant={badge.variant} className="text-[10px]">
                        {badge.label}
                      </Badge>
                    )}
                  </span>

                  <span className="text-muted-foreground">Criada em</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {formatTs(generation.created_at)}
                  </span>

                  {shotLabel && (
                    <>
                      <span className="text-muted-foreground">Enquadramento</span>
                      <span className="flex items-center gap-1">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                        {shotLabel}
                      </span>
                    </>
                  )}

                  <span className="text-muted-foreground">Tipo</span>
                  <span>{isOriginalRef ? "Original" : "Gerada"}</span>

                  {generation.source_mode && (
                    <>
                      <span className="text-muted-foreground">Modo</span>
                      <span>{getSourceModeLabel(generation.source_mode)}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {!generation && isOriginalRef && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                <span className="text-muted-foreground">Tipo</span>
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  Referência Original
                </span>
              </div>
            )}

            {/* Reference images used */}
            {generation && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <Images className="h-3 w-3" />
                    Referências usadas
                  </p>
                  {refAssetsLoading ? (
                    <div className="flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-14 w-14 rounded-md" />
                      ))}
                    </div>
                  ) : refAssets && refAssets.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {refAssets.map((ra) => (
                        <div
                          key={ra.id}
                          className="h-14 w-14 rounded-md border border-border/50 overflow-hidden bg-muted shrink-0"
                        >
                          {ra.file_url ? (
                            <img
                              src={ra.file_url}
                              alt={ra.asset_name ?? "Referência"}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
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

            {/* Prompt section */}
            {promptText && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3 w-3" />
                    Prompt da geração
                  </p>
                  <p
                    className={`text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap ${
                      !promptExpanded && promptIsLong ? "line-clamp-4" : ""
                    }`}
                  >
                    {promptText}
                  </p>
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

            {/* Technical details — collapsible */}
            {generation && (
              <>
                <Separator />
                <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${debugOpen ? "" : "-rotate-90"}`}
                      />
                      Detalhes técnicos
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 p-3">
                      <span className="font-medium">Pipeline</span>
                      <span className="capitalize">
                        {generation.pipeline_type?.replace(/_/g, " ") ?? "—"}
                      </span>
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
                      {rawShotLabel && (
                        <>
                          <span className="font-medium">Shot ID</span>
                          <span className="font-mono text-[10px]">{rawShotLabel}</span>
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
                        onClick={() => copyId(generation.id)}
                      >
                        {copied ? (
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
            <div className="flex justify-end pt-1 mt-auto">
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
