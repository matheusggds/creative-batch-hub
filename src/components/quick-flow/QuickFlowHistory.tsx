import { useRef, useEffect } from "react";
import { Loader2, Clock } from "lucide-react";
import type { HistorySession } from "@/hooks/useQuickFlowHistory";

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "0px 0px 200px 0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-6">
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
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Sessões anteriores
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.referenceAssetId}
            session={session}
            onClick={() => onRestore(session)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
      className="group rounded-lg border border-border/50 bg-card overflow-hidden hover:border-primary/50 transition-all text-left"
    >
      <div className="relative w-full" style={{ paddingBottom: "177.78%" }}>
        <div className="absolute inset-0 flex">
          {/* Left half: reference */}
          <div className="w-1/2 h-full overflow-hidden">
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
          {/* Right half: latest variation */}
          <div className="w-1/2 h-full overflow-hidden border-l border-border/30">
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
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors" />
      </div>
      <div className="px-2 py-1.5">
        <p className="text-xs text-muted-foreground truncate">
          {session.variationCount} variação
          {session.variationCount !== 1 ? "ões" : ""} · {dateStr}
        </p>
      </div>
    </button>
  );
}
