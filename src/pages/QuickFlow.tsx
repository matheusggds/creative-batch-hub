import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAvatarProfiles } from "@/hooks/useAvatarProfiles";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { uploadAssetFile } from "@/lib/storage";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Loader2,
  Sparkles,
  UserPlus,
  UserCheck,
  ImageIcon,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type Step = "idle" | "uploading" | "ready" | "generating" | "tracking";

export default function QuickFlow() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<"create" | "add" | null>(null);

  const { data: statusData } = useGenerationStatus(generationId);
  const genStatus = statusData?.generation.status ?? null;
  const progressPct = statusData?.generation.progress_pct ?? 0;
  const resultUrl = statusData?.generation.result_url ?? null;
  const isCompleted = genStatus === "completed";
  const isFailed = genStatus === "failed";

  // When generation completes or fails, update step
  if (step === "tracking" && isCompleted) {
    setStep("ready");
  }
  if (step === "tracking" && isFailed) {
    setGenError(statusData?.generation.error_code ?? "Erro desconhecido na geração.");
    setStep("ready");
  }

  const resetAll = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setAssetId(null);
    setAssetUrl(null);
    setStep("idle");
    setGenerationId(null);
    setGenError(null);
    setActionModal(null);
  }, [preview]);

  const handleRegenerate = () => {
    setGenerationId(null);
    setGenError(null);
    // keep assetId/assetUrl/preview, step stays "ready"
  };

  // Auto-upload on file select
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
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
      toast.success("Imagem pronta!");
    },
    onError: () => {
      setStep("idle");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      toast.error("Erro ao enviar imagem.");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    // Show preview immediately
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setGenerationId(null);
    setGenError(null);
    setStep("uploading");
    // Auto-upload in background
    uploadMutation.mutate(f);
  };

  const handleSwapImage = () => {
    fileInputRef.current?.click();
  };

  // Generate mutation with corrected payload
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!assetId) throw new Error("No asset");
      setGenError(null);
      setStep("generating");

      const { data, error } = await supabase.functions.invoke(
        "create-generation",
        {
          body: {
            toolType: "quick_similar_image",
            pipelineType: "multimodal_image_generation",
            sourceMode: "single_asset",
            avatarProfileId: null,
            referenceAssetIds: [assetId],
            supportingAssetIds: [],
            input: {
              promptPackId: "ugc-avatar-reference-pack-v1",
              shotId: "medium_front",
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
    },
    onError: (err: Error) => {
      setStep("ready");
      setGenError(err.message || "Erro ao iniciar geração.");
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

  const canGenerate = step === "ready" && !!assetId && !generateMutation.isPending;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Geração Rápida</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie uma imagem, gere uma variação e salve como avatar.
          </p>
        </div>

        {/* Hidden file input for swap */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />

        {/* 2-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT: Reference */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Referência
            </h2>

            {!preview ? (
              <label
                htmlFor="quick-file-input"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer aspect-square transition-colors"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-sm text-muted-foreground text-center px-4">
                  Clique para selecionar uma imagem
                </span>
                <span className="text-xs text-muted-foreground/60">JPG, PNG ou WebP</span>
                <input
                  id="quick-file-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <div className="relative rounded-lg border border-border/50 overflow-hidden">
                <img
                  src={preview}
                  alt="Referência"
                  className="w-full aspect-square object-cover"
                />
                {step === "uploading" && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}

            {preview && step !== "uploading" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full gap-2"
                onClick={handleSwapImage}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Trocar imagem
              </Button>
            )}
          </div>

          {/* RIGHT: Result */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Variação
            </h2>

            {/* Empty state */}
            {!generationId && !genError && step !== "generating" && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/10 aspect-square">
                <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60 text-center px-4">
                  {preview
                    ? "Clique em \"Gerar Variação\" para começar"
                    : "Selecione uma imagem de referência primeiro"}
                </p>
              </div>
            )}

            {/* Generating / Tracking skeleton */}
            {(step === "generating" || step === "tracking") && !isCompleted && !isFailed && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/10 aspect-square">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando variação…</p>
                {step === "tracking" && (
                  <div className="w-3/4">
                    <Progress value={progressPct} className="h-2" />
                    <p className="text-xs text-muted-foreground/60 text-center mt-1">
                      {progressPct}%
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Result image */}
            {isCompleted && resultUrl && (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <img
                  src={resultUrl}
                  alt="Variação gerada"
                  className="w-full aspect-square object-cover"
                />
              </div>
            )}

            {/* Error state */}
            {genError && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 aspect-square p-4">
                <AlertCircle className="h-10 w-10 text-destructive/60" />
                <Alert variant="destructive" className="border-0 bg-transparent">
                  <AlertDescription className="text-center text-sm">
                    {genError}
                  </AlertDescription>
                </Alert>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setGenError(null);
                    generateMutation.mutate();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {/* Post-result actions */}
            {isCompleted && resultUrl && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleRegenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Gerar outra variação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setActionModal("create")}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Criar avatar com esta imagem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setActionModal("add")}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  Adicionar a avatar existente
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Generate button */}
        <div className="flex justify-center gap-3">
          <Button
            size="lg"
            className="gap-2"
            disabled={!canGenerate}
            onClick={() => generateMutation.mutate()}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar Variação
          </Button>
          {(step !== "idle") && (
            <Button variant="ghost" size="lg" onClick={resetAll}>
              Recomeçar
            </Button>
          )}
        </div>
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
