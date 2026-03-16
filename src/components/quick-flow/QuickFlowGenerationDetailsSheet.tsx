import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, ChevronDown, Copy, Info, Sparkles, Wrench } from "lucide-react";
import type { GenerationStatusData } from "@/hooks/useGenerationStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: GenerationStatusData;
  isLoading?: boolean;
}

type JsonValue = string | number | boolean | null | JsonRecord | JsonValue[];
type JsonRecord = Record<string, JsonValue | unknown>;

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  queued: { label: "Na fila", variant: "secondary" },
  processing: { label: "Em andamento", variant: "default" },
  completed: { label: "Concluída", variant: "outline" },
  failed: { label: "Erro", variant: "destructive" },
};

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepFind(value: unknown, keys: string[], depth = 0): unknown {
  if (depth > 5 || value == null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = deepFind(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  for (const [key, nested] of Object.entries(value)) {
    if (keys.includes(key)) return nested;
  }
  for (const nested of Object.values(value)) {
    const found = deepFind(nested, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd/MM/yyyy HH:mm");
  } catch {
    return value;
  }
}

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  const known: Record<string, string> = {
    text_to_image: "Texto → imagem",
    image_to_image: "Imagem → imagem",
    single_asset: "Ativo único",
    quick_similar_image: "Quick Flow",
  };
  return known[value] ?? value.replace(/_/g, " ");
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-foreground break-words">{value}</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function QuickFlowGenerationDetailsSheet({ open, onOpenChange, data, isLoading = false }: Props) {
  const [isTechnicalOpen, setIsTechnicalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const relevantJob = useMemo(() => {
    if (!data?.jobs?.length) return null;
    return [...data.jobs].reverse().find((job) => {
      return !!job.model || !!job.provider || Object.keys(job.input_payload ?? {}).length > 0 || Object.keys(job.output_payload ?? {}).length > 0;
    }) ?? data.jobs[data.jobs.length - 1];
  }, [data]);

  const promptText = useMemo(() => {
    const fromJob = asString(deepFind(relevantJob?.input_payload, ["prompt", "finalPrompt", "final_prompt", "positive_prompt", "promptText", "textPrompt"]));
    if (fromJob) return fromJob;

    const fromAiParams = asString(
      deepFind(data?.generation.ai_parameters, ["prompt", "finalPromptPreview", "final_prompt", "positive_prompt", "extracted_positive_prompt"])
    );
    return fromAiParams ?? data?.generation.extracted_prompt ?? null;
  }, [data, relevantJob]);

  const model = asString(relevantJob?.model) ?? asString(deepFind(data?.generation.ai_parameters, ["gemini_model_used", "image_model", "model"])) ?? "—";
  const provider = asString(relevantJob?.provider) ?? asString(deepFind(data?.generation.ai_parameters, ["provider", "lastProvider", "image_provider"])) ?? "—";
  const width = asString(deepFind(relevantJob?.output_payload, ["width"])) ?? asString(deepFind(relevantJob?.input_payload, ["width"])) ?? asString(deepFind(data?.generation.ai_parameters, ["width"]));
  const height = asString(deepFind(relevantJob?.output_payload, ["height"])) ?? asString(deepFind(relevantJob?.input_payload, ["height"])) ?? asString(deepFind(data?.generation.ai_parameters, ["height"]));
  const sizeLabel = width && height ? `${width} × ${height}` : asString(deepFind(relevantJob?.output_payload, ["size", "dimensions", "resolution"])) ?? "—";
  const reusePromptId = asString(deepFind(relevantJob?.input_payload, ["reusePromptFromGenerationId"]));
  const status = data?.generation.status ? STATUS_MAP[data.generation.status] ?? { label: humanize(data.generation.status), variant: "outline" as const } : null;

  const technicalJson = useMemo(
    () =>
      JSON.stringify(
        {
          ai_parameters: data?.generation.ai_parameters ?? {},
          input_payload: relevantJob?.input_payload ?? {},
          output_payload: relevantJob?.output_payload ?? {},
          error_payload: relevantJob?.error_payload ?? {},
        },
        null,
        2
      ),
    [data, relevantJob]
  );

  const handleCopy = async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast.success("Prompt copiado.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o prompt.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto border-border/60 bg-card sm:max-w-[380px]">
        <SheetHeader className="space-y-1 pr-8">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" />
            Detalhes da geração
          </SheetTitle>
          <SheetDescription>Inspecione o prompt e os metadados da variação ativa.</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <LoadingState />
        ) : !data ? (
          <div className="py-8 text-sm text-muted-foreground">Selecione uma variação concluída para ver os detalhes.</div>
        ) : (
          <div className="space-y-5 py-4">
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-foreground">Prompt utilizado</h3>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={handleCopy} disabled={!promptText}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copiar
                </Button>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-border/50 bg-muted/40 p-3 text-sm leading-6 text-foreground whitespace-pre-wrap break-words">
                {promptText ?? "Prompt não disponível."}
              </div>
            </section>

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Detalhes da geração</h3>
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                <InfoRow label="Modelo" value={model} />
                <InfoRow label="Provider" value={provider} />
                <InfoRow label="Tipo" value={humanize(data.generation.source_mode ?? data.generation.tool_type)} />
                <InfoRow label="Dimensões" value={sizeLabel} />
                <InfoRow label="Data" value={formatDate(data.generation.created_at)} />
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {status ? <Badge variant={status.variant}>{status.label}</Badge> : <span>—</span>}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Informações de contexto</h3>
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                <InfoRow label="Imagens de referência enviadas" value="0" />
                <div className="flex items-start gap-2 rounded-md border border-border/40 bg-background/60 p-2 text-xs text-muted-foreground">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{reusePromptId ? "Prompt reutilizado de geração anterior" : "Prompt gerado especificamente para esta variação"}</span>
                </div>
              </div>
            </section>

            <Collapsible open={isTechnicalOpen} onOpenChange={setIsTechnicalOpen}>
              <div className="rounded-lg border border-border/50 bg-muted/20">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    Detalhes técnicos
                  </span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isTechnicalOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3">
                  <Separator />
                  <div className="space-y-2">
                    <InfoRow label="Pipeline type" value={humanize(data.generation.pipeline_type)} />
                    <InfoRow label="Source mode" value={humanize(data.generation.source_mode)} />
                    <InfoRow label="Tool type" value={humanize(data.generation.tool_type)} />
                    <InfoRow label="Generation ID" value={data.generation.id} />
                    <InfoRow label="Job ID" value={relevantJob?.id ?? "—"} />
                  </div>
                  <div className="rounded-md border border-border/50 bg-background/70 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                      <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                      Payloads e metadados
                    </div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-muted-foreground">
                      {technicalJson}
                    </pre>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
