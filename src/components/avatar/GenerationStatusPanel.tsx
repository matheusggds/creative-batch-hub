import { useGenerationStatus, type GenerationStatusData } from "@/hooks/useGenerationStatus";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ImageIcon,
  Zap,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  generationId: string | null;
}

const statusStyles: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: React.ReactNode }
> = {
  pending: { label: "Pendente", variant: "secondary", icon: <Clock className="h-3.5 w-3.5" /> },
  queued: { label: "Na fila", variant: "secondary", icon: <Clock className="h-3.5 w-3.5" /> },
  processing: {
    label: "Processando",
    variant: "default",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: {
    label: "Concluído",
    variant: "outline",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  },
  failed: {
    label: "Falhou",
    variant: "destructive",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
};

function getStatusStyle(status: string) {
  return statusStyles[status] ?? { label: status, variant: "outline" as const, icon: null };
}

export function GenerationStatusPanel({ generationId }: Props) {
  const { data, isLoading, error } = useGenerationStatus(generationId);

  if (!generationId) return null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { generation, jobs, events } = data;
  const genStyle = getStatusStyle(generation.status);
  const isTerminal = generation.status === "completed" || generation.status === "failed";

  return (
    <div className="rounded-lg border border-border/50 bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Status da Geração</span>
        </div>
        <Badge variant={genStyle.variant} className="gap-1">
          {genStyle.icon}
          {genStyle.label}
        </Badge>
      </div>

      {/* Progress */}
      {!isTerminal && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{generation.current_step ?? "Aguardando…"}</span>
            <span>{generation.progress_pct}%</span>
          </div>
          <Progress value={generation.progress_pct} className="h-1.5" />
        </div>
      )}

      {/* Error */}
      {generation.status === "failed" && generation.error_code && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-mono text-xs">{generation.error_code}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Result Image */}
      {generation.result_url && (
        <div className="rounded-lg border border-border/50 overflow-hidden bg-muted">
          <img
            src={generation.result_url}
            alt="Resultado da geração"
            className="w-full aspect-square object-cover"
          />
        </div>
      )}

      {/* Jobs */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Zap className="h-3 w-3" />
            Jobs ({jobs.length})
          </div>
          <div className="space-y-1.5">
            {jobs.map((job) => {
              const jobStyle = getStatusStyle(job.status);
              return (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-md border border-border/30 bg-muted/30 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {jobStyle.icon}
                    <span className="font-medium truncate">{job.step}</span>
                    {job.provider && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {job.provider}{job.model ? ` / ${job.model}` : ""}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                    <span>
                      {job.attempt}/{job.max_attempts}
                    </span>
                    <Badge variant={jobStyle.variant} className="text-[10px] px-1.5 py-0">
                      {jobStyle.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Events Timeline */}
      {events.length > 0 && (
        <div className="space-y-2">
          <Separator />
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Timeline ({events.length})
          </div>
          <ScrollArea className="max-h-[200px]">
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
                        {formatDistanceToNow(new Date(evt.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
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
