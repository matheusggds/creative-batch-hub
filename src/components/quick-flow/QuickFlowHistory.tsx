import { Loader2, Clock } from "lucide-react";
import type { HistorySession } from "@/hooks/useQuickFlowHistory";
import { Button } from "@/components/ui/button";

interface Props {
  sessions: HistorySession[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  onRestore: (session: HistorySession) => void;
  fetchNextPage: () => void;
}

export function QuickFlowHistory({
  sessions,
  hasNextPage,
  isFetchingNextPage,
  isLoading,
  onRestore,
  fetchNextPage,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground/60">
          Suas gerações anteriores aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Sessões anteriores
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8">
        {sessions.map((session) => (
          <SessionCard
            key={session.referenceAssetId}
            session={session}
            onClick={() => onRestore(session)}
          />
        ))}
      </div>

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-w-32"
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : (
              "Carregar mais"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  onClick,
}: {
  session: HistorySession;
  onClick: () => void;
}) {
  const date = new Date(session.lastGeneratedAt);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-lg border border-border/50 bg-card text-left transition-all hover:border-primary/50"
    >
      <div className="relative w-full" style={{ paddingBottom: "177.78%" }}>
        <div className="absolute inset-0 flex">
          <div className="h-full w-1/2 overflow-hidden">
            {session.referenceUrl ? (
              <img
                src={session.referenceUrl}
                alt="Referência"
                className="h-full w-full object-cover"
                width={80}
                height={142}
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-muted/20" />
            )}
          </div>
          <div className="h-full w-1/2 overflow-hidden border-l border-border/30">
            {session.latestResultUrl ? (
              <img
                src={session.latestResultUrl}
                alt="Variação"
                className="h-full w-full object-cover"
                width={80}
                height={142}
                loading="lazy"
              />
            ) : (
              <div className="h-full w-full bg-muted/20" />
            )}
          </div>
        </div>
        <div className="absolute inset-0 bg-background/0 transition-colors group-hover:bg-background/20" />
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          {session.variationCount} variaç{session.variationCount === 1 ? "ão" : "ões"} · {dateStr}
        </p>
      </div>
    </button>
  );
}
