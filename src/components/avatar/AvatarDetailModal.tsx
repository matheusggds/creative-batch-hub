import type { AvatarProfileWithMeta } from "@/hooks/useAvatarProfiles";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, Images, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  avatar: AvatarProfileWithMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvatarDetailModal({ avatar, open, onOpenChange }: Props) {
  // Fetch reference assets with their file URLs
  const { data: refAssets, isLoading } = useQuery({
    queryKey: ["avatar_reference_assets", avatar?.id],
    enabled: !!avatar?.id && open,
    queryFn: async () => {
      const { data: refs, error } = await supabase
        .from("avatar_reference_assets")
        .select("id, asset_id, role, sort_order")
        .eq("avatar_profile_id", avatar!.id)
        .order("sort_order");

      if (error) throw error;
      if (!refs || refs.length === 0) return [];

      const assetIds = refs.map((r) => r.asset_id);
      const { data: assets } = await supabase
        .from("assets")
        .select("id, file_url, name")
        .in("id", assetIds);

      const assetMap = Object.fromEntries(
        (assets ?? []).map((a) => [a.id, a])
      );

      return refs.map((r) => ({
        ...r,
        file_url: assetMap[r.asset_id]?.file_url ?? null,
        asset_name: assetMap[r.asset_id]?.name ?? null,
      }));
    },
  });

  if (!avatar) return null;

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    draft: { label: "Rascunho", variant: "secondary" },
    active: { label: "Ativo", variant: "default" },
    archived: { label: "Arquivado", variant: "outline" },
  };
  const status = statusConfig[avatar.status] ?? { label: avatar.status, variant: "outline" as const };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">{avatar.name}</DialogTitle>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Criado {formatDistanceToNow(new Date(avatar.created_at), { addSuffix: true, locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <Images className="h-3 w-3" />
              {avatar.reference_count} referência{avatar.reference_count !== 1 ? "s" : ""}
            </span>
          </div>
        </DialogHeader>

        {/* Cover */}
        {avatar.cover_url && (
          <div className="rounded-lg overflow-hidden border border-border/50 aspect-video bg-muted">
            <img
              src={avatar.cover_url}
              alt={avatar.name}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Reference Images */}
        <div>
          <h4 className="text-sm font-medium mb-2">Imagens de Referência</h4>
          <ScrollArea className="max-h-[300px]">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : refAssets && refAssets.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {refAssets.map((ref) => (
                  <div
                    key={ref.id}
                    className="aspect-square rounded-lg border border-border/50 overflow-hidden bg-muted relative group"
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
                    <Badge
                      variant="secondary"
                      className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0"
                    >
                      {ref.role}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma imagem de referência adicionada.
              </p>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
