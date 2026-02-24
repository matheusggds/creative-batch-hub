import { useBatches, useAllGenerations } from "@/hooks/useBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Film, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Generation } from "@/types/studio";

const statusConfig = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary" as const },
  processing: { label: "Processando", icon: Loader2, variant: "default" as const },
  completed: { label: "Concluído", icon: CheckCircle2, variant: "outline" as const },
};

export function BatchResults() {
  const { data: batches, isLoading: batchesLoading } = useBatches();
  const { data: allGenerations, isLoading: gensLoading } = useAllGenerations();

  const isLoading = batchesLoading || gensLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="aspect-[9/16] rounded-md" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!batches || batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhum lote gerado</p>
        <p className="text-xs text-muted-foreground mt-1">Selecione um avatar e roupas para começar</p>
      </div>
    );
  }

  const gensByBatch = (allGenerations || []).reduce<Record<string, Generation[]>>((acc, g) => {
    (acc[g.batch_id] = acc[g.batch_id] || []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {batches.map((batch) => {
        const cfg = statusConfig[batch.status as keyof typeof statusConfig] || statusConfig.pending;
        const Icon = cfg.icon;
        const gens = gensByBatch[batch.id] || [];

        return (
          <Card key={batch.id} className="border-border/50">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Lote • {formatDistanceToNow(new Date(batch.created_at), { addSuffix: true, locale: ptBR })}
                </CardTitle>
                <Badge variant={cfg.variant} className="gap-1 text-xs">
                  <Icon className={`h-3 w-3 ${batch.status === "processing" ? "animate-spin" : ""}`} />
                  {cfg.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {batch.status === "processing" ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {gens.map((g) => {
                    const params = g.ai_parameters as unknown as Record<string, unknown> | null;
                    const hasPrompt = !!params?.extracted_positive_prompt;
                    return (
                      <div key={g.id} className="relative">
                        <Skeleton className="aspect-[9/16] rounded-md animate-pulse" />
                        <div className="absolute inset-0 flex items-end p-2">
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            {g.status === "failed" ? (
                              "❌ Falhou"
                            ) : hasPrompt ? (
                              <>
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Gerando imagem…
                              </>
                            ) : (
                              <>
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                Extraindo prompt…
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {gens.map((g) => (
                    <div key={g.id} className="relative group">
                      <div className="aspect-[9/16] rounded-md overflow-hidden bg-muted border border-border">
                        {g.result_url ? (
                          <img src={g.result_url} alt="Gerado" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                            Falhou
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled
                        className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs gap-1"
                      >
                        <Film className="h-3 w-3" />
                        Enviar para Vídeo
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
