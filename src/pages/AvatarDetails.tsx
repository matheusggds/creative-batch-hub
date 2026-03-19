import { useMemo, useState, useCallback } from "react";
import { NewGenerationModal } from "@/components/avatar/NewGenerationModal";
import { ImageDetailModal, GridItem } from "@/components/avatar/ImageDetailModal";
import { useParams, useNavigate } from "react-router-dom";
import { useAvatarProfile } from "@/hooks/useAvatarProfile";
import { useAvatarGenerations, AvatarGeneration } from "@/hooks/useAvatarGenerations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getShortModelName, extractModelInfo, relativeTime } from "@/lib/generation-utils";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ImageIcon,
  Images,
  Wand2,
  AlertTriangle,
  Check,
  X,
  MousePointerClick,
  Loader2,
  Download,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  archived: { label: "Arquivado", variant: "outline" },
};

const STEP_LABELS: Record<string, string> = {
  generate_image: "Gerando imagem...",
  extract_prompt: "Analisando imagem...",
};

function humanizeStep(step: string | null): string {
  if (!step) return "Processando…";
  return STEP_LABELS[step] ?? "Processando...";
}

export default function AvatarDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: avatar, isLoading, error } = useAvatarProfile(id);
  const { data: generations } = useAvatarGenerations(id);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [anglesOpen, setAnglesOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<GridItem | null>(null);

  // Delete image state
  const [deleteImageTarget, setDeleteImageTarget] = useState<{ refId: string; assetId: string } | null>(null);
  // Delete avatar state
  const [deleteAvatarOpen, setDeleteAvatarOpen] = useState(false);

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

  // Delete single image mutation (via Edge Function)
  const deleteImageMutation = useMutation({
    mutationFn: async ({ assetId }: { refId: string; assetId: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-asset", {
        body: { assetId, deleteMode: "asset" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("Imagem excluída.");
      qc.invalidateQueries({ queryKey: ["avatar_profile", id] });
      qc.invalidateQueries({ queryKey: ["avatar_generations", id] });
    },
    onError: () => toast.error("Não foi possível excluir a imagem. Tente novamente."),
  });

  // Delete avatar mutation (via Edge Function)
  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-asset", {
        body: { avatarProfileId: id, deleteMode: "avatar" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast.success("Avatar excluído.");
      qc.invalidateQueries({ queryKey: ["avatar_profiles"] });
      navigate("/avatars");
    },
    onError: () => toast.error("Não foi possível excluir o avatar. Tente novamente."),
  });

  // Compute completed shot IDs
  const completedShotIds = useMemo(() => {
    const ids = new Set<string>();
    if (!generations) return ids;
    for (const gen of generations) {
      if (gen.status !== "completed") continue;
      const params = gen.ai_parameters as Record<string, unknown>;
      const debug = params?._debug as Record<string, unknown> | null;
      const shotId = params?.shotId ?? debug?.selectedShotId;
      if (shotId && typeof shotId === "string") ids.add(shotId);
    }
    return ids;
  }, [generations]);

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

    const resultAssetToGen = new Map(
      completedGens
        .filter((g) => g.result_asset_id)
        .map((g) => [g.result_asset_id!, g])
    );

    const refAssetIds = new Set(avatar.references.map((r) => r.asset_id));

    const activeItems: GridItem[] = activeGens.map((g) => ({
      type: "generation" as const,
      generation: g,
    }));

    const refItems: GridItem[] = avatar.references.map((ref) => ({
      type: "reference" as const,
      ref,
      generation: resultAssetToGen.get(ref.asset_id),
    }));

    const unmatchedCompleted: GridItem[] = completedGens
      .filter((g) => g.result_asset_id && !refAssetIds.has(g.result_asset_id))
      .map((g) => ({ type: "generation" as const, generation: g }));

    const failedItems: GridItem[] = failedGens.map((g) => ({
      type: "generation" as const,
      generation: g,
    }));

    return [...activeItems, ...refItems, ...unmatchedCompleted, ...failedItems];
  }, [avatar, generations]);

  // Navigable items for the inspector (only items with a visible image)
  const navigableItems = useMemo(() => {
    return gridItems.filter((item) => {
      if (item.type === "reference") return !!item.ref.file_url;
      return item.generation.status === "completed" && !!item.generation.result_url;
    });
  }, [gridItems]);

  const currentNavIndex = useMemo(() => {
    if (!detailItem) return -1;
    return navigableItems.findIndex((ni) => {
      if (detailItem.type === "reference" && ni.type === "reference") return ni.ref.id === detailItem.ref.id;
      if (detailItem.type === "generation" && ni.type === "generation") return ni.generation.id === detailItem.generation.id;
      if (detailItem.type === "reference" && ni.type === "reference") return ni.ref.asset_id === detailItem.ref.asset_id;
      return false;
    });
  }, [detailItem, navigableItems]);

  const handleNavigate = useCallback((index: number) => {
    if (index >= 0 && index < navigableItems.length) {
      setDetailItem(navigableItems[index]);
    }
  }, [navigableItems]);

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
                Nova Geração
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => setDeleteAvatarOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir avatar
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
              Nova Geração ({selectedIds.size})
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
                    onDelete={() => setDeleteImageTarget({ refId: item.ref.id, assetId: item.ref.asset_id })}
                  />
                );
              }
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
          navigableCount={navigableItems.length}
          currentIndex={currentNavIndex}
          onNavigate={handleNavigate}
        />

        {/* Unified New Generation Modal */}
        <NewGenerationModal
          open={anglesOpen}
          onOpenChange={setAnglesOpen}
          avatarProfileId={avatar.id}
          references={avatar.references}
          preselectedAssetIds={selectionMode && hasSelection ? Array.from(selectedIds) : undefined}
          completedShotIds={completedShotIds}
        />

        {/* Delete Image Confirmation */}
        <AlertDialog open={!!deleteImageTarget} onOpenChange={(v) => !v && setDeleteImageTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir imagem</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta imagem? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (deleteImageTarget) deleteImageMutation.mutate(deleteImageTarget);
                  setDeleteImageTarget(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Avatar Confirmation */}
        <AlertDialog open={deleteAvatarOpen} onOpenChange={setDeleteAvatarOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir avatar</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o avatar "{avatar.name}"? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteAvatarMutation.mutate()}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
}

/* ── Helpers ── */
const SHOT_LABELS: Record<string, string> = {
  TH1_FRONT_NEUTRAL: "Frontal Neutro",
  TH2_FRONT_GENTLE_SMILE: "Frontal Sorriso Leve",
  TH3_FRONT_SPEAKING_FRAME: "Frontal Falando",
  TH4_45_NEUTRAL: "45° Neutro",
  TH5_45_GENTLE_SMILE: "45° Sorriso Leve",
  TH6_PROFILE_90_NEUTRAL: "Perfil 90° Neutro",
  FB1_FULL_FRONT: "Corpo Inteiro Frontal",
  FB2_FULL_45: "Corpo Inteiro 45°",
  FB3_FULL_PROFILE_90: "Corpo Inteiro Perfil 90°",
  FB4_FULL_BACK_180: "Corpo Inteiro Costas",
  FB5_HANDS_FOCUS: "Foco nas Mãos",
  FB6_UPPER_GARMENT_DETAIL: "Detalhe Roupa Superior",
  FB7_LOWER_GARMENT_DETAIL: "Detalhe Roupa Inferior",
  FB8_LIFESTYLE_UGC: "Lifestyle UGC",
  TH2_FRONT_LEFT: "Frontal Esquerda",
  TH3_FRONT_RIGHT: "Frontal Direita",
  TH4_LEFT_PROFILE: "Perfil Esquerdo",
  TH5_RIGHT_PROFILE: "Perfil Direito",
  TH6_THREE_QUARTER_LEFT: "¾ Esquerda",
  TH7_THREE_QUARTER_RIGHT: "¾ Direita",
  FB2_FULL_LEFT: "Corpo Inteiro Esquerda",
  FB3_FULL_RIGHT: "Corpo Inteiro Direita",
  FB4_FULL_BACK: "Corpo Inteiro Costas",
  FB5_THREE_QUARTER_FRONT_LEFT: "Corpo ¾ Frontal Esq.",
  FB6_THREE_QUARTER_FRONT_RIGHT: "Corpo ¾ Frontal Dir.",
  FB7_FULL_SITTING: "Corpo Sentado",
};

function getShotLabel(gen?: AvatarGeneration): string | null {
  if (!gen?.ai_parameters || typeof gen.ai_parameters !== "object") return null;
  const params = gen.ai_parameters as Record<string, unknown>;
  const debug = params._debug as Record<string, unknown> | null;
  if (debug?.shotLabel && typeof debug.shotLabel === "string") return debug.shotLabel;
  const rawId = params.shotId ?? debug?.selectedShotId ?? params.shot_label;
  if (rawId) {
    const raw = String(rawId);
    return SHOT_LABELS[raw] ?? raw.replace(/_/g, " ");
  }
  return null;
}

/* ── Reference Card ── */
function ReferenceCard({
  item,
  selectionMode,
  isSelected,
  onToggle,
  onClick,
  onDelete,
}: {
  item: GridItem & { type: "reference" };
  selectionMode: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDelete: () => void;
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

      {/* Delete button (hover, top-left) */}
      {!selectionMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-md bg-destructive/80 backdrop-blur-sm p-1 hover:bg-destructive text-destructive-foreground"
          title="Excluir imagem"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Download button */}
      {ref.file_url && !selectionMode && (
        <DownloadButton url={ref.file_url} name={shotLabel ?? ref.asset_name ?? "referencia"} />
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
            {humanizeStep(gen.current_step)}
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
          <DownloadButton url={gen.result_url} name={shotLabel ?? "gerada"} />
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

/* ── Download Button ── */
function DownloadButton({ url, name }: { url: string; name: string }) {
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name.replace(/\s+/g, "_")}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <button
      onClick={handleDownload}
      className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-md bg-background/80 backdrop-blur-sm p-1.5 border border-border/50 hover:bg-background text-foreground"
      title="Download"
    >
      <Download className="h-3.5 w-3.5" />
    </button>
  );
}
