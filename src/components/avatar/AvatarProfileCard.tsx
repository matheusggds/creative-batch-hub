import { useState } from "react";
import type { AvatarProfileWithMeta } from "@/hooks/useAvatarProfiles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Images, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  archived: { label: "Arquivado", variant: "outline" },
};

interface Props {
  avatar: AvatarProfileWithMeta;
  onClick: () => void;
}

export function AvatarProfileCard({ avatar, onClick }: Props) {
  const status = statusConfig[avatar.status] ?? { label: avatar.status, variant: "outline" as const };
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("avatar_profiles").delete().eq("id", avatar.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avatar excluído.");
      qc.invalidateQueries({ queryKey: ["avatar_profiles"] });
    },
    onError: () => toast.error("Erro ao excluir avatar."),
  });

  return (
    <>
      <Card
        className="group cursor-pointer border-border/50 overflow-hidden transition-all hover:border-primary/40 hover:shadow-md"
        onClick={onClick}
      >
        {/* Cover */}
        <div className="aspect-square bg-muted relative overflow-hidden">
          {avatar.cover_url ? (
            <img
              src={avatar.cover_url}
              alt={avatar.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
          <Badge className="absolute top-2 right-2" variant={status.variant}>
            {status.label}
          </Badge>

          {/* Delete button on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 rounded-md bg-destructive/80 backdrop-blur-sm p-1.5 hover:bg-destructive text-destructive-foreground"
            title="Excluir avatar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <CardContent className="p-3">
          <h3 className="font-medium text-sm truncate">{avatar.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <Images className="h-3 w-3" />
            <span>{avatar.reference_count} referência{avatar.reference_count !== 1 ? "s" : ""}</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
              onClick={() => deleteMutation.mutate()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
