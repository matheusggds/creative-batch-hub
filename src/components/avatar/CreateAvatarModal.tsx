import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { uploadAssetFile } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, X, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "uploading" | "creating";

export function CreateAvatarModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("form");

  const reset = useCallback(() => {
    setName("");
    setFile(null);
    setPreview(null);
    setStep("form");
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const createAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("Missing user or file");

      // Step 1: Upload to storage
      setStep("uploading");
      const fileUrl = await uploadAssetFile(user.id, file);

      // Step 2: Insert asset row
      const { data: asset, error: assetError } = await supabase
        .from("assets")
        .insert({
          user_id: user.id,
          type: "avatar",
          file_url: fileUrl,
          name: file.name,
        })
        .select("id")
        .single();

      if (assetError) throw assetError;

      // Step 3: Invoke edge function
      setStep("creating");
      const { error: fnError } = await supabase.functions.invoke(
        "create-avatar-profile",
        {
          body: {
            name: name.trim(),
            referenceAssetIds: [asset.id],
            coverAssetId: asset.id,
          },
        }
      );

      if (fnError) throw fnError;
    },
    onSuccess: () => {
      toast.success("Avatar criado com sucesso!");
      qc.invalidateQueries({ queryKey: ["avatar_profiles"] });
      onOpenChange(false);
      reset();
    },
    onError: (err: Error) => {
      setStep("form");
      toast.error("Erro ao criar avatar.");
      console.error("CreateAvatar error:", err);
    },
  });

  const canSubmit = name.trim().length > 0 && !!file && step === "form";
  const isProcessing = step !== "form" || createAvatarMutation.isPending;

  const stepLabel: Record<Step, string> = {
    form: "",
    uploading: "Enviando imagem…",
    creating: "Criando perfil de avatar…",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isProcessing) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Avatar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="avatar-name">Nome do Avatar</Label>
            <Input
              id="avatar-name"
              placeholder="Ex: Maria Casual"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isProcessing}
              maxLength={100}
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Imagem de Referência</Label>
            {!file ? (
              <label
                htmlFor="avatar-file"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/30 cursor-pointer p-8 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Clique para selecionar uma imagem
                </span>
                <span className="text-xs text-muted-foreground/60">
                  JPG, PNG ou WebP
                </span>
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </label>
            ) : (
              <div className="relative rounded-lg border border-border/50 overflow-hidden">
                <img
                  src={preview!}
                  alt="Preview"
                  className="w-full aspect-square object-cover"
                />
                {!isProcessing && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Progress */}
          {isProcessing && step !== "form" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{stepLabel[step]}</span>
              </div>
              <Progress
                value={step === "uploading" ? 40 : 80}
                className="h-1.5"
              />
            </div>
          )}

          {/* Error */}
          {createAvatarMutation.isError && step === "form" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(createAvatarMutation.error as Error).message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => createAvatarMutation.mutate()}
            disabled={!canSubmit}
            className="gap-2"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {isProcessing ? "Processando…" : "Criar Avatar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
