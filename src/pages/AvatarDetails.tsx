import { useState } from "react";
import { GenerateBaseAnglesModal } from "@/components/avatar/GenerateBaseAnglesModal";
import { GenerationHistorySection } from "@/components/avatar/GenerationHistorySection";
import { useParams, useNavigate } from "react-router-dom";
import { useAvatarProfile } from "@/hooks/useAvatarProfile";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ImageIcon,
  Images,
  Wand2,
  AlertTriangle,
  Check,
  ChevronDown,
  X,
  MousePointerClick,
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [anglesOpen, setAnglesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Image preview state (normal mode)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);

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

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const selectAll = () => {
    if (!avatar) return;
    if (selectedIds.size === avatar.references.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(avatar.references.map((r) => r.asset_id)));
    }
  };

  const handleCardClick = (ref: { asset_id: string; file_url: string | null; asset_name: string | null }) => {
    if (selectionMode) {
      toggleSelect(ref.asset_id);
    } else {
      // Normal mode: open image preview
      if (ref.file_url) {
        setPreviewUrl(ref.file_url);
        setPreviewName(ref.asset_name ?? "Referência");
      }
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
                <span>{avatar.references.length} imagem{avatar.references.length !== 1 ? "ns" : ""}</span>
              </div>
            </div>

            {/* Primary CTA — standalone, no selection coupling */}
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
          {avatar.references.length > 0 && (
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
                {selectedIds.size === avatar.references.length ? "Desmarcar todas" : "Selecionar todas"}
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

        {/* Gallery Grid */}
        {avatar.references.length === 0 ? (
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
            {avatar.references.map((ref) => {
              const isSelected = selectedIds.has(ref.asset_id);
              return (
                <div
                  key={ref.id}
                  className={`group relative aspect-square rounded-lg border overflow-hidden bg-muted transition-all ${
                    selectionMode
                      ? isSelected
                        ? "border-primary ring-2 ring-primary/30 cursor-pointer"
                        : "border-border/50 hover:border-primary/40 cursor-pointer"
                      : "border-border/50 hover:border-border cursor-pointer"
                  }`}
                  onClick={() => handleCardClick(ref)}
                >
                  {ref.file_url ? (
                    <img
                      src={ref.file_url}
                      alt={ref.asset_name ?? "Referência"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Checkbox — only in selection mode */}
                  {selectionMode && (
                    <div className={`absolute top-2 left-2 transition-opacity ${isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}`}>
                      <Checkbox
                        checked={isSelected}
                        className="h-5 w-5 rounded border-2 bg-background/80 backdrop-blur-sm"
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleSelect(ref.asset_id)}
                      />
                    </div>
                  )}

                  {/* Selection overlay */}
                  {selectionMode && isSelected && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Generation History (collapsible, compact) */}
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? "" : "-rotate-90"}`} />
              Histórico de Gerações
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <GenerationHistorySection avatarProfileId={avatar.id} />
          </CollapsibleContent>
        </Collapsible>

        {/* Image Preview Dialog (normal mode) */}
        <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
          <DialogContent className="max-w-2xl p-2 bg-background/95 backdrop-blur-sm">
            {previewUrl && (
              <img
                src={previewUrl}
                alt={previewName ?? "Imagem"}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            )}
          </DialogContent>
        </Dialog>

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
