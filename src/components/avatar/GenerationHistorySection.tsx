import { useState } from "react";
import { useAvatarGenerations, type AvatarGeneration } from "@/hooks/useAvatarGenerations";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ImageIcon,
  Zap,
  Activity,
  History,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  avatarProfileId: string;
}

const statusStyles: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }
> = {
  pending: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  queued: { label: "Na fila", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
  processing: {
    label: "Processando",
    variant: "default",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  completed: {
    label: "Concluído",
    variant: "outline",
    icon: <CheckCircle2 className="h-3 w-3 text-primary" />,
  },
  failed: {
    label: "Falhou",
    variant: "destructive",
    icon: <AlertCircle className="h-3 w-3" />,
  },
};

function getStyle(status: string) {
  return statusStyles[status] ?? { label: status, variant: "outline" as const, icon: null };
}

export function GenerationHistorySection({ avatarProfileId }: Props) {
  const { data: generations, isLoading } = useAvatarGenerations(avatarProfileId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (!generations || generations.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Histórico de Gerações</h2>
        <span className="text-xs text-muted-foreground">({generations.length})</span>
      </div>

      <div className="space-y-1">
        {generations.map((gen) => (
          <GenerationRow key={gen.id} generation={gen} onClick={() => setSelectedId(gen.id)} />
        ))}
      </div>

      <GenerationDetailDialog
        generationId={selectedId}
        open={!!selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}

/* ---------- Compact Row ---------- */

function GenerationRow({ generation, onClick }: { generation: AvatarGeneration; onClick: () => void }) {
  const style = getStyle(generation.status);
  const isActive = ["pending", "processing", "queued"].includes(generation.status);

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-left hover:border-primary/40 transition-colors"
    >
      <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-muted border border-border/30">
        {generation.result_url ? (
          <img src={generation.result_url} alt="Resultado" className="h-full w-full object-cover" loading="lazy" />
        ) : isActive ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={style.variant} className="gap-1 text-[10px] px-1.5 py-0 shrink-0">
            {style.icon}
            {style.label}
          </Badge>
          {isActive && generation.current_step && (
            <span className="text-[10px] text-muted-foreground truncate">{generation.current_step}</span>
          )}
        </div>
        {isActive && <Progress value={generation.progress_pct} className="h-1 mt-1.5" />}
      </div>

      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(generation.created_at), { addSuffix: true, locale: ptBR })}
      </span>
    </button>
  );
}
/* ---------- Detail Dialog ---------- */

function GenerationDetailDialog({
  generationId,
  open,
  onOpenChange,
}: {
  generationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useGenerationStatus(generationId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Detalhes da Geração
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {data && <DetailContent data={data} />}
      </DialogContent>
    </Dialog>
  );
}

function DetailContent({ data }: { data: import("@/hooks/useGenerationStatus").GenerationStatusData }) {
  const { generation, jobs, events } = data;
  const style = getStyle(generation.status);
  const isTerminal = generation.status === "completed" || generation.status === "failed";

  return (
    <div className="space-y-4">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <Badge variant={style.variant} className="gap-1">
          {style.icon}
          {style.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(generation.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      </div>

      {/* Progress */}
      {!isTerminal && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{generation.current_step ?? "Aguardando…"}</span>
            <span>{generation.progress_pct}%</span>
          </div>
          <Progress value={generation.progress_pct} className="h-1.5" />
        </div>
      )}

      {/* Error */}
      {generation.status === "failed" && generation.error_code && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
          <span className="font-mono text-xs text-destructive">{generation.error_code}</span>
        </div>
      )}

      {/* Result */}
      {generation.result_url && (
        <img
          src={generation.result_url}
          alt="Resultado"
          className="w-full rounded-lg border border-border/50"
        />
      )}

      {/* Jobs */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Zap className="h-3 w-3" />
            Jobs ({jobs.length})
          </div>
          <div className="space-y-1">
            {jobs.map((job) => {
              const js = getStyle(job.status);
              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-md border border-border/30 bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {js.icon}
                    <span className="font-medium truncate">{job.step}</span>
                    {job.provider && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {job.provider}{job.model ? ` / ${job.model}` : ""}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={js.variant} className="text-[10px] px-1.5 py-0 shrink-0">
                    {js.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events */}
      {events.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Timeline ({events.length})
          </div>
          <ScrollArea className="max-h-[180px]">
            <div className="space-y-1">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-start gap-2 text-xs py-1.5 border-l-2 border-border pl-3 ml-1"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                        {evt.type}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {evt.message && (
                      <p className="text-muted-foreground mt-0.5 break-words">{evt.message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Polling indicator */}
      {!isTerminal && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <Loader2 className="h-3 w-3 animate-spin" />
          Atualizando automaticamente…
        </div>
      )}
    </div>
  );
}
