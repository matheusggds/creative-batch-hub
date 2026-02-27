import { useState } from "react";
import { useAvatarProfiles } from "@/hooks/useAvatarProfiles";
import { AvatarProfileCard } from "@/components/avatar/AvatarProfileCard";
import { CreateAvatarModal } from "@/components/avatar/CreateAvatarModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AppHeader } from "@/components/AppHeader";
import { Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AvatarLibrary() {
  const { data: avatars, isLoading, error } = useAvatarProfiles();
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8">
        {/* Title + CTA */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Seus Avatares</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie seus perfis de avatar e imagens de referência.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Criar Avatar
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border/50 overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <Users className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="font-semibold text-lg">Erro ao carregar avatares</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {(error as Error).message}
            </p>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && avatars?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Nenhum avatar ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Crie seu primeiro perfil de avatar para começar a gerar conteúdo.
            </p>
            <Button className="gap-2 mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Criar Avatar
            </Button>
          </div>
        )}

        {/* Grid */}
        {!isLoading && !error && avatars && avatars.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {avatars.map((avatar) => (
              <AvatarProfileCard
                key={avatar.id}
                avatar={avatar}
                onClick={() => navigate(`/avatars/${avatar.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <CreateAvatarModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
