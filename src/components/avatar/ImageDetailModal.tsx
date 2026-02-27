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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ImageIcon,
  Loader2,
  AlertTriangle,
  Clock,
  ChevronDown,
  Copy,
  CheckCircle2,
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

  const shotLabel =
    generation?.ai_parameters &&
    typeof generation.ai_parameters === "object" &&
    "shot_label" in generation.ai_parameters
      ? String((generation.ai_parameters as Record<string, unknown>).shot_label)
      : null;

  const badge = generation
    ? statusBadge[generation.status] ?? { label: generation.status, variant: "outline" as const }
    : null;

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {shotLabel ?? (item.type === "reference" ? (item.ref.asset_name ?? "Referência") : "Geração")}
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
            {isOriginalRef && (
              <Badge variant="outline" className="text-xs">
                Original
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes da imagem</DialogDescription>
        </DialogHeader>

        {/* Image area */}
        <div className="relative aspect-square max-h-[50vh] w-full rounded-lg border border-border/50 overflow-hidden bg-muted flex items-center justify-center">
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
              alt="Preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-2 text-sm">
          {generation && (
            <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatTs(generation.created_at)}
              </span>
              {generation.pipeline_type && (
                <span className="capitalize">{generation.pipeline_type.replace(/_/g, " ")}</span>
              )}
              {generation.source_mode && (
                <Badge variant="outline" className="text-xs">{generation.source_mode}</Badge>
              )}
            </div>
          )}

          {item.type === "reference" && !generation && (
            <p className="text-muted-foreground">
              Imagem de referência original — carregada manualmente.
            </p>
          )}
        </div>

        {/* Prompt / debug info */}
        {generation && (generation.extracted_prompt || generation.id) && (
          <Collapsible open={debugOpen} onOpenChange={setDebugOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${debugOpen ? "" : "-rotate-90"}`}
                />
                Detalhes técnicos
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {generation.extracted_prompt && (
                <div className="rounded-md border border-border bg-muted/50 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prompt extraído</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {generation.extracted_prompt}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">ID: {generation.id.slice(0, 8)}…</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5"
                  onClick={() => copyId(generation.id)}
                >
                  {copied ? (
                    <CheckCircle2 className="h-3 w-3 text-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
