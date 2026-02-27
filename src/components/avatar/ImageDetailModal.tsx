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
} from "lucide-react";
import { AvatarGeneration } from "@/hooks/useAvatarGenerations";
import { AvatarReferenceAsset } from "@/hooks/useAvatarProfile";
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

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
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

function getShotLabel(gen?: AvatarGeneration): string | null {
  if (!gen?.ai_parameters || typeof gen.ai_parameters !== "object") return null;
  const params = gen.ai_parameters as Record<string, unknown>;
  if ("shot_label" in params) return String(params.shot_label);
  return null;
}

export function ImageDetailModal({ open, onOpenChange, item }: ImageDetailModalProps) {
  const [debugOpen, setDebugOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const generation = item.type === "generation" ? item.generation : item.generation;
  const imageUrl =
    item.type === "reference"
      ? item.ref.file_url
      : item.generation.result_url;
  const isOriginalRef = item.type === "reference" && !generation;
  const isActive =
    generation &&
    ["pending", "queued", "processing"].includes(generation.status);
  const isFailed = generation?.status === "failed";

  const shotLabel = getShotLabel(generation);

  const badge = generation
    ? statusBadge[generation.status] ?? { label: generation.status, variant: "outline" as const }
    : null;

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Human-readable title
  const title = shotLabel
    ? shotLabel
    : isOriginalRef
    ? "Referência Original"
    : generation
    ? "Imagem Gerada"
    : "Referência";

  // Origin description
  const originLabel = isOriginalRef
    ? "Carregada manualmente"
    : generation
    ? `Gerada via ${generation.pipeline_type?.replace(/_/g, " ") ?? "IA"}`
    : "Referência do avatar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-0 p-0">
        {/* Image area — full-bleed */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted flex items-center justify-center">
          {isActive ? (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <span className="text-sm font-medium">
                {generation!.current_step ?? "Processando…"}
              </span>
              {generation!.progress_pct > 0 && (
                <Progress value={generation!.progress_pct} className="w-40 h-2" />
              )}
            </div>
          ) : isFailed ? (
            <div className="flex flex-col items-center gap-2 text-destructive">
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

        {/* Content area */}
        <div className="p-5 space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
              {title}
              {badge && <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>}
              {isOriginalRef && (
                <Badge variant="outline" className="text-[10px]">
                  Original
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isOriginalRef ? (
                <Upload className="h-3 w-3" />
              ) : generation ? (
                <Sparkles className="h-3 w-3" />
              ) : (
                <Camera className="h-3 w-3" />
              )}
              {originLabel}
            </DialogDescription>
          </DialogHeader>

          {/* Key metadata row */}
          {generation && (
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTs(generation.created_at)}
              </span>
              {shotLabel && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  <Camera className="h-2.5 w-2.5 mr-1" />
                  {shotLabel}
                </Badge>
              )}
              {generation.source_mode && (
                <Badge variant="outline" className="text-[10px] h-5">{generation.source_mode}</Badge>
              )}
            </div>
          )}

          {/* Prompt preview — visible by default if available */}
          {generation?.extracted_prompt && (
            <>
              <Separator />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Prompt da geração</p>
                <p className="text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap line-clamp-4">
                  {generation.extracted_prompt}
                </p>
              </div>
            </>
          )}

          {/* Technical debug — collapsible */}
          {generation && (
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
                  <span className="capitalize">{generation.pipeline_type?.replace(/_/g, " ") ?? "—"}</span>
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
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px]">ID: {generation.id.slice(0, 12)}…</span>
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
          )}

          {/* Actions */}
          <div className="flex justify-end pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
