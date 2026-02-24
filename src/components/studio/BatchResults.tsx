import { useState } from "react";
import { useAllGenerations } from "@/hooks/useBatches";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Loader2, CheckCircle2, Film } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { GenerationDetailModal } from "./GenerationDetailModal";
import type { Generation } from "@/types/studio";

export function BatchResults() {
  const { data: generations, isLoading } = useAllGenerations();
  const [selected, setSelected] = useState<Generation | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (!generations || generations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Film className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Nenhuma geração ainda</p>
        <p className="text-xs text-muted-foreground mt-1">Selecione imagens de referência para começar</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {generations.map((gen) => (
          <GenerationCard key={gen.id} generation={gen} onClick={() => setSelected(gen)} />
        ))}
      </div>
      <GenerationDetailModal
        generation={selected}
        open={!!selected}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
      />
    </>
  );
}

function GenerationCard({ generation, onClick }: { generation: Generation; onClick: () => void }) {
  const params = generation.ai_parameters as unknown as Record<string, unknown> | null;
  const hasPrompt = !!params?.extracted_prompt;

  if (generation.status === "failed") {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg border border-destructive/50 bg-destructive/10 flex flex-col items-center justify-center gap-2 transition-colors hover:bg-destructive/20 cursor-pointer"
      >
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <span className="text-[10px] text-destructive font-medium">Falhou</span>
        <span className="text-[9px] text-muted-foreground">
          {formatDistanceToNow(new Date(generation.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </button>
    );
  }

  if (generation.status === "completed" && generation.result_url) {
    return (
      <button
        onClick={onClick}
        className="aspect-square rounded-lg overflow-hidden border border-border bg-muted relative group cursor-pointer transition-all hover:ring-2 hover:ring-primary/40"
      >
        <img src={generation.result_url} alt="Gerado" className="h-full w-full object-cover" />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-background/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-foreground">
              {formatDistanceToNow(new Date(generation.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
        </div>
      </button>
    );
  }

  // pending / processing
  return (
    <button
      onClick={onClick}
      className="aspect-square rounded-lg border border-border bg-muted relative cursor-pointer transition-all hover:ring-2 hover:ring-primary/40"
    >
      <Skeleton className="h-full w-full rounded-lg" />
      <div className="absolute inset-0 flex items-end p-2">
        <Badge variant="secondary" className="text-[10px] gap-1">
          {hasPrompt ? (
            <>
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              Gerando imagem…
            </>
          ) : (
            <>
              <Clock className="h-2.5 w-2.5" />
              Extraindo prompt…
            </>
          )}
        </Badge>
      </div>
    </button>
  );
}
