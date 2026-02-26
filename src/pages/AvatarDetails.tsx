import { useState } from "react";
import { GenerateBaseAnglesModal } from "@/components/avatar/GenerateBaseAnglesModal";
import { GenerationStatusPanel } from "@/components/avatar/GenerationStatusPanel";
import { GenerationHistorySection } from "@/components/avatar/GenerationHistorySection";
import { useParams, useNavigate } from "react-router-dom";
import { useAvatarProfile } from "@/hooks/useAvatarProfile";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Sparkles,
  LogOut,
  ImageIcon,
  Images,
  Plus,
  Wand2,
  Palette,
  AlertTriangle,
  Check,
} from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  archived: { label: "Arquivado", variant: "outline" },
};

export default function AvatarDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { data: avatar, isLoading, error } = useAvatarProfile(id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [anglesOpen, setAnglesOpen] = useState(false);
  const [activeGenerationId, setActiveGenerationId] = useState<string | null>(null);

  const toggleSelect = (refId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(refId)) next.delete(refId);
      else next.add(refId);
      return next;
    });
  };

  const selectAll = () => {
    if (!avatar) return;
    if (selectedIds.size === avatar.references.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(avatar.references.map((r) => r.id)));
    }
  };

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header email={user?.email} onBack={() => navigate("/avatars")} onSignOut={signOut} />
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
        <Header email={user?.email} onBack={() => navigate("/avatars")} onSignOut={signOut} />
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
      <Header email={user?.email} onBack={() => navigate("/avatars")} onSignOut={signOut} />

      <main className="container py-8 space-y-6">
        {/* Hero: Cover + Info */}
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Cover */}
          <div className="w-full sm:w-48 md:w-56 shrink-0">
            <div className="aspect-square rounded-xl border border-border/50 overflow-hidden bg-muted">
              {avatar.cover_url ? (
                <img
                  src={avatar.cover_url}
                  alt={avatar.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          {/* Info + Actions */}
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{avatar.name}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                <Images className="h-4 w-4" />
                <span>
                  {avatar.references.length} imagem{avatar.references.length !== 1 ? "ns" : ""}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" className="gap-2" onClick={() => setAnglesOpen(true)}>
                <Wand2 className="h-4 w-4" />
                Gerar Ângulos Base
              </Button>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Imagem
              </Button>
              <Button className="gap-2">
                <Palette className="h-4 w-4" />
                Criar Novo Look
              </Button>
            </div>
          </div>
        </div>

        {/* Gallery Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Galeria de Referência</h2>
          <div className="flex items-center gap-2">
            {hasSelection && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
              </span>
            )}
            {avatar.references.length > 0 && (
              <Button variant="ghost" size="sm" onClick={selectAll} className="gap-1.5 text-xs">
                <Check className="h-3 w-3" />
                {selectedIds.size === avatar.references.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            )}
          </div>
        </div>

        {/* Gallery Grid */}
        {avatar.references.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Images className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Nenhuma imagem de referência</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Adicione imagens de referência para treinar e gerar variações deste avatar.
            </p>
            <Button variant="outline" className="gap-2 mt-4">
              <Plus className="h-4 w-4" />
              Adicionar Imagem
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {avatar.references.map((ref) => {
              const isSelected = selectedIds.has(ref.id);
              return (
                <div
                  key={ref.id}
                  className={`group relative aspect-square rounded-lg border overflow-hidden bg-muted cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/50 hover:border-primary/40"
                  }`}
                  onClick={() => toggleSelect(ref.id)}
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

                  {/* Checkbox overlay */}
                  <div
                    className={`absolute top-2 left-2 transition-opacity ${
                      isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="h-5 w-5 rounded border-2 bg-background/80 backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleSelect(ref.id)}
                    />
                  </div>

                  {/* Role badge */}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-1.5 left-1.5 text-[10px] px-1.5 py-0 bg-background/70 backdrop-blur-sm"
                  >
                    {ref.role}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Generation Status */}
        {activeGenerationId && (
          <GenerationStatusPanel generationId={activeGenerationId} />
        )}

        {/* Generation History */}
        <GenerationHistorySection avatarProfileId={avatar.id} />

        {/* Generate Base Angles Modal */}
        <GenerateBaseAnglesModal
          open={anglesOpen}
          onOpenChange={setAnglesOpen}
          avatarProfileId={avatar.id}
          references={avatar.references}
          onGenerationCreated={(gId) => setActiveGenerationId(gId)}
        />
      </main>
    </div>
  );
}

/* Shared header component */
function Header({
  email,
  onBack,
  onSignOut,
}: {
  email?: string;
  onBack: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold tracking-tight">Avatar Details</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground truncate max-w-[160px]">{email}</span>
          <Button variant="ghost" size="icon" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
