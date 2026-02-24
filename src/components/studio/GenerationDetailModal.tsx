import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Cpu } from "lucide-react";
import { useAssets } from "@/hooks/useAssets";
import type { Generation } from "@/types/studio";

interface GenerationDetailModalProps {
  generation: Generation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusMap = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary" as const },
  processing: { label: "Processando", icon: Loader2, variant: "default" as const },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "outline" as const },
  failed: { label: "Falhou", icon: AlertTriangle, variant: "destructive" as const },
};

export function GenerationDetailModal({ generation, open, onOpenChange }: GenerationDetailModalProps) {
  const { data: allAssets } = useAssets("clothing");

  if (!generation) return null;

  const params = generation.ai_parameters as unknown as Record<string, unknown> | null;
  const extractedPrompt = params?.extracted_prompt as string | undefined;
  const openaiModel = params?.openai_model as string | undefined;
  const geminiModel = params?.gemini_model_used as string | undefined;
  const errorMessage = params?.error_message as string | undefined;

  const status = statusMap[generation.status as keyof typeof statusMap] || statusMap.pending;
  const StatusIcon = status.icon;

  const referenceAsset = allAssets?.find((a) => a.id === generation.reference_asset_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes da Geração
            <Badge variant={status.variant} className="gap-1 text-xs">
              <StatusIcon className={`h-3 w-3 ${generation.status === "processing" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Visual: Reference + Result */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Imagem de Referência</p>
              <div className="aspect-square rounded-md overflow-hidden border border-border bg-muted">
                {referenceAsset ? (
                  <img src={referenceAsset.file_url} alt="Referência" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">—</div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Imagem Gerada</p>
              <div className="aspect-square rounded-md overflow-hidden border border-border bg-muted">
                {generation.result_url ? (
                  <img src={generation.result_url} alt="Resultado" className="h-full w-full object-cover" />
                ) : generation.status === "processing" || generation.status === "pending" ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Metadata badges */}
          {(openaiModel || geminiModel) && (
            <div className="flex flex-wrap gap-2">
              {openaiModel && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Cpu className="h-3 w-3" /> OpenAI: {openaiModel}
                </Badge>
              )}
              {geminiModel && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Cpu className="h-3 w-3" /> Gemini: {geminiModel}
                </Badge>
              )}
            </div>
          )}

          {/* Error */}
          {generation.status === "failed" && errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Extracted prompt */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Prompt Extraído</p>
            {extractedPrompt ? (
              <ScrollArea className="h-40 rounded-md border border-border bg-muted/50 p-3">
                <pre className="text-xs whitespace-pre-wrap text-foreground font-mono">{extractedPrompt}</pre>
              </ScrollArea>
            ) : generation.status === "processing" || generation.status === "pending" ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3 w-3 animate-spin" />
                Aguardando extração do prompt…
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-3">Nenhum prompt disponível.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
