import { useMemo, useState } from "react";
import { GenerateBaseAnglesModal } from "@/components/avatar/GenerateBaseAnglesModal";
import { ImageDetailModal, GridItem } from "@/components/avatar/ImageDetailModal";
import { useParams, useNavigate } from "react-router-dom";
import { useAvatarProfile } from "@/hooks/useAvatarProfile";
import { useAvatarGenerations, AvatarGeneration } from "@/hooks/useAvatarGenerations";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ImageIcon,
  Images,
  Wand2,
  AlertTriangle,
  Check,
  X,
  MousePointerClick,
  Loader2,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  archived: { label: "Arquivado", variant: "outline" },
};

export default function AvatarDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: avatar, isLoading, error } = useAvatarProfile(id);
  const { data: generations } = useAvatarGenerations(id);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [anglesOpen, setAnglesOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<GridItem | null>(null);

  const openGenerateModal = () => setAnglesOpen(true);

  const toggleSelect = (assetId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const enterSelectionMode = () => setSelectionMode(true);

  const selectAll = () => {
    if (!avatar) return;
    if (selectedIds.size === avatar.references.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(avatar.references.map((r) => r.asset_id)));
    }
  };

  // Build unified grid items
  const gridItems: GridItem[] = useMemo(() => {
    if (!avatar) return [];
    const gens = generations ?? [];

    const activeGens = gens.filter((g) =>
      ["pending", "queued", "processing"].includes(g.status)
    );
    const failedGens = gens.filter(
      (g) => g.status === "failed" && !g.result_asset_id
    );
    const completedGens = gens.filter(
      (g) => g.status === "completed"
    );

    // Map result_asset_id → generation for completed gens
    const resultAssetToGen = new Map(
      completedGens
        .filter((g) => g.result_asset_id)
        .map((g) => [g.result_asset_id!, g])
    );

    // Track which asset_ids are covered by references
    const refAssetIds = new Set(avatar.references.map((r) => r.asset_id));

    // Active generations as placeholders (top of grid)
    const activeItems: GridItem[] = activeGens.map((g) => ({
      type: "generation" as const,
      generation: g,
    }));

    // Reference assets with matched generation metadata
    const refItems: GridItem[] = avatar.references.map((ref) => ({
      type: "reference" as const,
      ref,
      generation: resultAssetToGen.get(ref.asset_id),
    }));

    // Completed generations not matched to any reference (safety net)
    const unmatchedCompleted: GridItem[] = completedGens
      .filter((g) => g.result_asset_id && !refAssetIds.has(g.result_asset_id))
      .map((g) => ({ type: "generation" as const, generation: g }));

    // Failed generations at end
    const failedItems: GridItem[] = failedGens.map((g) => ({
      type: "generation" as const,
      generation: g,
    }));

    return [...activeItems, ...refItems, ...unmatchedCompleted, ...failedItems];
  }, [avatar, generations]);

  const handleCardClick = (item: GridItem) => {
    if (selectionMode && item.type === "reference") {
      toggleSelect(item.ref.asset_id);
    } else {
      setDetailItem(item);
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error
  if (error || !avatar) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container py-20 flex flex-col items-center text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="font-semibold text-lg">Erro ao carregar avatar</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {(error as Error)?.message ?? "Avatar não encontrado."}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/avatars")}>
            Voltar à biblioteca
          </Button>
        </main>
      </div>
    );
  }

  const status = statusConfig[avatar.status] ?? { label: avatar.status, variant: "outline" as const };
  const hasSelection = selectedIds.size > 0;
  const refCount = avatar.references.length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 space-y-6">
        {/* Hero: Cover + Info */}
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="w-full sm:w-48 md:w-56 shrink-0">
            <div className="aspect-square rounded-xl border border-border/50 overflow-hidden bg-muted">
              {avatar.cover_url ? (
                <img src={avatar.cover_url} alt={avatar.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{avatar.name}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <Images className="h-4 w-4" />
                <span>{refCount} imagem{refCount !== 1 ? "ns" : ""}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button className="gap-2" onClick={openGenerateModal}>
                <Wand2 className="h-4 w-4" />
                Gerar Ângulos Base
              </Button>
            </div>
          </div>
        </div>

        {/* Gallery Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Biblioteca do Avatar</h2>
          {refCount > 0 && (
            <Button
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={selectionMode ? clearSelection : enterSelectionMode}
            >
              {selectionMode ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Sair da seleção
                </>
              ) : (
                <>
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Selecionar imagens
                </>
              )}
            </Button>
          )}
        </div>

        {/* Selection Action Bar */}
        {selectionMode && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                <Check className="h-3 w-3 mr-1" />
                {selectedIds.size === refCount ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
              {hasSelection && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="text-xs h-7">
                  Limpar
                </Button>
              )}
            </div>
            <Button size="sm" onClick={openGenerateModal} disabled={!hasSelection} className="gap-1.5">
              <Wand2 className="h-3.5 w-3.5" />
              Gerar da seleção ({selectedIds.size})
            </Button>
          </div>
        )}

        {/* Unified Grid */}
        {gridItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Images className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Nenhuma imagem na biblioteca</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Adicione imagens para treinar e gerar variações deste avatar.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {gridItems.map((item) => {
              if (item.type === "reference") {
                return (
                  <ReferenceCard
                    key={`ref-${item.ref.id}`}
                    item={item}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(item.ref.asset_id)}
                    onToggle={() => toggleSelect(item.ref.asset_id)}
                    onClick={() => handleCardClick(item)}
                  />
                );
              }
              // Generation placeholder (active/failed/unmatched completed)
              return (
                <GenerationCard
                  key={`gen-${item.generation.id}`}
                  item={item}
                  onClick={() => handleCardClick(item)}
                />
              );
            })}
          </div>
        )}

        {/* Image Detail Modal */}
        <ImageDetailModal
          open={!!detailItem}
          onOpenChange={(v) => !v && setDetailItem(null)}
          item={detailItem}
        />

        {/* Generate Base Angles Modal */}
        <GenerateBaseAnglesModal
          open={anglesOpen}
          onOpenChange={setAnglesOpen}
          avatarProfileId={avatar.id}
          references={avatar.references}
          preselectedAssetIds={selectionMode && hasSelection ? Array.from(selectedIds) : undefined}
        />
      </main>
    </div>
  );
}

/* ── Helpers ── */
function getShotLabel(gen?: AvatarGeneration): string | null {
  if (!gen?.ai_parameters || typeof gen.ai_parameters !== "object") return null;
  const params = gen.ai_parameters as Record<string, unknown>;
  if ("shot_label" in params) return String(params.shot_label);
  return null;
}

/* ── Reference Card ── */
function ReferenceCard({
  item,
  selectionMode,
  isSelected,
  onToggle,
  onClick,
}: {
  item: GridItem & { type: "reference" };
  selectionMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
}) {
  const ref = item.ref;
  const isOriginal = !item.generation;
  const shotLabel = getShotLabel(item.generation);

  return (
    <div
      className={`group relative aspect-square rounded-lg border overflow-hidden bg-muted transition-all cursor-pointer ${
        selectionMode
          ? isSelected
            ? "border-primary ring-2 ring-primary/30"
            : "border-border/50 hover:border-primary/40"
          : "border-border/50 hover:border-border"
      }`}
      onClick={onClick}
    >
      {ref.file_url ? (
        <img
          src={ref.file_url}
          alt={shotLabel ?? "Referência"}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        </div>
      )}

      {/* Bottom label overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pb-1.5 pt-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] font-medium text-white leading-tight line-clamp-1">
          {shotLabel ?? (isOriginal ? "Referência Original" : "Imagem Gerada")}
        </span>
      </div>

      {/* Always-visible shot badge for generated images */}
      {shotLabel && !selectionMode && (
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-background/80 backdrop-blur-sm border-border/50 text-foreground">
            {shotLabel}
          </Badge>
        </div>
      )}

      {/* Original indicator */}
      {isOriginal && !selectionMode && (
        <div className="absolute top-1.5 right-1.5">
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-background/80 backdrop-blur-sm border-border/50 text-muted-foreground">
            Original
          </Badge>
        </div>
      )}

      {selectionMode && (
        <div className={`absolute top-2 left-2 transition-opacity ${isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}>
          <Checkbox
            checked={isSelected}
            className="h-5 w-5 rounded border-2 bg-background/80 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={onToggle}
          />
        </div>
      )}

      {selectionMode && isSelected && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
    </div>
  );
}

/* ── Generation Placeholder Card ── */
function GenerationCard({
  item,
  onClick,
}: {
  item: GridItem & { type: "generation" };
  onClick: () => void;
}) {
  const gen = item.generation;
  const isActive = ["pending", "queued", "processing"].includes(gen.status);
  const isFailed = gen.status === "failed";
  const isCompleted = gen.status === "completed";
  const shotLabel = getShotLabel(gen);

  return (
    <div
      className={`group relative aspect-square rounded-lg border overflow-hidden cursor-pointer transition-all ${
        isActive
          ? "border-primary/40 bg-primary/5"
          : isFailed
          ? "border-destructive/40 bg-destructive/5"
          : "border-border/50 bg-muted hover:border-border"
      }`}
      onClick={onClick}
    >
      {isActive ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-[10px] text-muted-foreground text-center leading-tight">
            {gen.current_step ?? "Processando…"}
          </span>
          {gen.progress_pct > 0 && (
            <Progress value={gen.progress_pct} className="w-3/4 h-1.5" />
          )}
          {shotLabel && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
              {shotLabel}
            </Badge>
          )}
        </div>
      ) : isFailed ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <span className="text-[10px] text-destructive text-center leading-tight">Falhou</span>
          {shotLabel && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
              {shotLabel}
            </Badge>
          )}
        </div>
      ) : isCompleted && gen.result_url ? (
        <>
          <img
            src={gen.result_url}
            alt={shotLabel ?? "Resultado"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {shotLabel && (
            <div className="absolute top-1.5 right-1.5">
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-background/80 backdrop-blur-sm border-border/50 text-foreground">
                {shotLabel}
              </Badge>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2 pb-1.5 pt-6 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-medium text-white leading-tight line-clamp-1">
              {shotLabel ?? "Imagem Gerada"}
            </span>
          </div>
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
