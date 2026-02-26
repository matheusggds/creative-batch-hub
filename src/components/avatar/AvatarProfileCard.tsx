import type { AvatarProfileWithMeta } from "@/hooks/useAvatarProfiles";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Images } from "lucide-react";

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

  return (
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
      </div>

      <CardContent className="p-3">
        <h3 className="font-medium text-sm truncate">{avatar.name}</h3>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Images className="h-3 w-3" />
          <span>{avatar.reference_count} referência{avatar.reference_count !== 1 ? "s" : ""}</span>
        </div>
      </CardContent>
    </Card>
  );
}
