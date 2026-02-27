import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAvatarProfiles } from "@/hooks/useAvatarProfiles";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { uploadAssetFile } from "@/lib/storage";
import { GenerationStatusPanel } from "@/components/avatar/GenerationStatusPanel";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  X,
  Loader2,
  Sparkles,
  UserPlus,
  UserCheck,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Step = "upload" | "uploading" | "ready" | "generating" | "tracking";

export default function QuickFlow() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<"create" | "add" | null>(null);

  const { data: statusData } = useGenerationStatus(generationId);
  const resultUrl = statusData?.generation.result_url ?? null;
  const isCompleted = statusData?.generation.status === "completed";

  const reset = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setAssetId(null);
    setAssetUrl(null);
    setStep("upload");
    setGenerationId(null);
    setActionModal(null);
  }, [preview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user || !file) throw new Error("Missing user or file");
      setStep("uploading");

      const fileUrl = await uploadAssetFile(user.id, file);

      const { data: asset, error } = await supabase
        .from("assets")
        .insert({
          user_id: user.id,
          type: "reference",
          file_url: fileUrl,
          name: file.name,
        })
        .select("id, file_url")
        .single();

      if (error) throw error;
      return asset;
    },
    onSuccess: (asset) => {
      setAssetId(asset.id);
      setAssetUrl(asset.file_url);
      setStep("ready");
      toast.success("Imagem enviada!");
    },
    onError: () => {
      setStep("upload");
      toast.error("Erro ao enviar imagem.");
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!assetId) throw new Error("No asset");
      setStep("generating");

      const { data, error } = await supabase.functions.invoke(
        "create-generation",
        {
          body: {
            toolType: "quick_generation",
            pipelineType: "image_to_image",
            sourceMode: "quick_flow",
            referenceAssetIds: [assetId],
            input: {
              geminiPreferredModel: "gemini-3-pro-image-preview",
            },
          },
        }
      );

      if (error) throw error;
      return data as { generationId?: string };
    },
    onSuccess: (data) => {
      if (data?.generationId) {
        setGenerationId(data.generationId);
        setStep("tracking");
      }
      toast.success("Geração iniciada!");
    },
    onError: () => {
      setStep("ready");
      toast.error("Erro ao iniciar geração.");
    },
  });

  // Create avatar from result
  const createAvatarMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!resultUrl) throw new Error("No result");
      const { error } = await supabase.functions.invoke(
        "create-avatar-profile",
        {
          body: {
            name,
            referenceAssetIds: [assetId],
            coverAssetId: assetId,
          },
        }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avatar criado!");
      qc.invalidateQueries({ queryKey: ["avatar_profiles"] });
      setActionModal(null);
    },
    onError: () => toast.error("Erro ao criar avatar."),
  });

  // Add to existing avatar
  const addToAvatarMutation = useMutation({
    mutationFn: async (avatarProfileId: string) => {
      if (!assetId) throw new Error("No asset");
      const { error } = await supabase
        .from("avatar_reference_assets")
        .insert({
          avatar_profile_id: avatarProfileId,
          asset_id: assetId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Imagem adicionada ao avatar!");
      qc.invalidateQueries({ queryKey: ["avatar_profile"] });
      setActionModal(null);
    },
    onError: () => toast.error("Erro ao adicionar ao avatar."),
  });

  const isProcessing =
    step === "uploading" || step === "generating" || uploadMutation.isPending || generateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Geração Rápida</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie uma imagem, gere uma variação e salve como avatar.
          </p>
        </div>

        {/* Upload Area */}
        <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
          <Label className="text-sm font-medium">Imagem de Referência</Label>

          {!file ? (
            <label
              htmlFor="quick-file"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer p-12 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar uma imagem
              </span>
              <span className="text-xs text-muted-foreground/60">JPG, PNG ou WebP</span>
              <input
                id="quick-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
            </label>
          ) : (
            <div className="relative rounded-lg border border-border/50 overflow-hidden max-w-sm mx-auto">
              <img
                src={preview!}
                alt="Preview"
                className="w-full aspect-square object-cover"
              />
              {step === "upload" && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              {step !== "upload" && (
                <Badge className="absolute top-2 right-2" variant="secondary">
                  Enviada
                </Badge>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-center">
            {step === "upload" && file && (
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
                className="gap-2"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploadMutation.isPending ? "Enviando…" : "Enviar Imagem"}
              </Button>
            )}

            {step === "ready" && (
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {generateMutation.isPending ? "Iniciando…" : "Gerar Variação"}
              </Button>
            )}

            {(step === "tracking" || step === "generating") && !isCompleted && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Geração em andamento…
              </p>
            )}
          </div>
        </div>

        {/* Generation Status */}
        {generationId && <GenerationStatusPanel generationId={generationId} />}

        {/* Result + Actions */}
        {isCompleted && resultUrl && (
          <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">Resultado</h2>
            <div className="rounded-lg border border-border/50 overflow-hidden max-w-sm mx-auto">
              <img
                src={resultUrl}
                alt="Resultado da geração"
                className="w-full aspect-square object-cover"
              />
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setActionModal("create")}
              >
                <UserPlus className="h-4 w-4" />
                Criar Avatar com este resultado
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setActionModal("add")}
              >
                <UserCheck className="h-4 w-4" />
                Adicionar a avatar existente
              </Button>
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={reset}>
                Nova geração
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Create Avatar Modal */}
      <CreateAvatarFromResultModal
        open={actionModal === "create"}
        onOpenChange={(v) => { if (!v) setActionModal(null); }}
        isPending={createAvatarMutation.isPending}
        onSubmit={(name) => createAvatarMutation.mutate(name)}
      />

      {/* Add to Avatar Modal */}
      <AddToAvatarModal
        open={actionModal === "add"}
        onOpenChange={(v) => { if (!v) setActionModal(null); }}
        isPending={addToAvatarMutation.isPending}
        onSubmit={(avatarId) => addToAvatarMutation.mutate(avatarId)}
      />
    </div>
  );
}

/* ---------- Sub-modals ---------- */

function CreateAvatarFromResultModal({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="new-avatar-name">Nome do Avatar</Label>
          <Input
            id="new-avatar-name"
            placeholder="Ex: Maria Look 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            maxLength={100}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!name.trim() || isPending}
            onClick={() => onSubmit(name.trim())}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddToAvatarModal({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (avatarId: string) => void;
}) {
  const { data: avatars, isLoading } = useAvatarProfiles();
  const [selected, setSelected] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar a Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Selecione um avatar</Label>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : avatars && avatars.length > 0 ? (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um avatar…" />
              </SelectTrigger>
              <SelectContent>
                {avatars.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      {a.cover_url ? (
                        <img
                          src={a.cover_url}
                          alt=""
                          className="h-5 w-5 rounded object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span>{a.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum avatar encontrado.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            disabled={!selected || isPending}
            onClick={() => onSubmit(selected)}
            className="gap-2"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
