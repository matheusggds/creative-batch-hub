import { useAssets, useUploadAsset } from "@/hooks/useAssets";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Upload, Check } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import type { Asset } from "@/types/studio";
import { cn } from "@/lib/utils";

interface AssetGalleryProps {
  type: Asset["type"];
  selected: string[];
  onSelect: (ids: string[]) => void;
  multiple?: boolean;
  label: string;
}

export function AssetGallery({ type, selected, onSelect, multiple = false, label }: AssetGalleryProps) {
  const { data: assets, isLoading } = useAssets(type);
  const uploadMutation = useUploadAsset();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        const asset = await uploadMutation.mutateAsync({ file, type });
        if (!multiple) {
          onSelect([asset.id]);
        } else {
          onSelect([...selected, asset.id]);
        }
      } catch {
        toast.error(`Falha ao enviar ${file.name}`);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const toggleSelect = (id: string) => {
    if (multiple) {
      onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    } else {
      onSelect(selected.includes(id) ? [] : [id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploadMutation.isPending ? "Enviando..." : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      ) : assets && assets.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => toggleSelect(asset.id)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border-2 transition-all",
                selected.includes(asset.id) ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-muted-foreground/40"
              )}
            >
              <img src={asset.file_url} alt={asset.name || ""} className="h-full w-full object-cover" />
              {selected.includes(asset.id) && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                  <Check className="h-5 w-5 text-primary" />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
          Nenhum item ainda. Faça upload!
        </p>
      )}
      {multiple && selected.length > 0 && (
        <p className="text-xs text-muted-foreground">{selected.length} selecionado(s)</p>
      )}
    </div>
  );
}
