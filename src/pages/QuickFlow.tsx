import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGenerationStatus } from "@/hooks/useGenerationStatus";
import { uploadAssetFile } from "@/lib/storage";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Upload,
  Loader2,
  Sparkles,
  UserPlus,
  ImageIcon,
  RefreshCw,
  AlertCircle,
  Download,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

type Step = "idle" | "uploading" | "ready" | "generating" | "tracking" | "completed" | "error";

const STALL_TIMEOUT_MS = 120_000; // 2 minutes without progress → stall

const FRIENDLY_ERRORS: Record<string, string> = {
  openai_missing_positive_prompt:
    "Não conseguimos montar um prompt válido a partir desta imagem. Tente outra imagem ou gere novamente.",
  openai_content_policy:
    "A imagem foi bloqueada pela política de conteúdo. Tente outra imagem.",
  openai_rate_limit:
    "Estamos com muitas requisições no momento. Aguarde um instante e tente novamente.",
  shot_not_found:
    "Não foi possível encontrar o ângulo solicitado. Tente gerar novamente.",
};

function friendlyError(code: string | null | undefined): string {
  if (!code) return "Erro desconhecido na geração.";
  return FRIENDLY_ERRORS[code] ?? code;
}

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
  const [actionModal, setActionModal] = useState<"create" | null>(null);

  // Snapshot data for terminal states (so we can nullify generationId for the hook)
  const [snapshotResultUrl, setSnapshotResultUrl] = useState<string | null>(null);
  const [snapshotResultAssetId, setSnapshotResultAssetId] = useState<string | null>(null);
  const [snapshotRetryCount, setSnapshotRetryCount] = useState(0);
  const [snapshotGenerationId, setSnapshotGenerationId] = useState<string | null>(null);

  // Only pass generationId to hook while actively tracking
  const trackingId = step === "tracking" ? generationId : null;
  const { data: statusData } = useGenerationStatus(trackingId, { skipDetails: true });
  const genStatus = statusData?.generation.status ?? null;
  const progressPct = statusData?.generation.progress_pct ?? 0;
  const currentStepLabel = statusData?.generation.current_step ?? null;

  // Use snapshot for display in completed/error states, live data during tracking
  const resultUrl = step === "completed" ? snapshotResultUrl : (statusData?.generation.result_url ?? null);

  // Track last progress change for stall detection
  const lastProgressRef = useRef<{ pct: number; at: number }>({ pct: 0, at: Date.now() });
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition from tracking → completed or error (in useEffect, not render)
  useEffect(() => {
    if (step !== "tracking") return;

    if (genStatus === "completed") {
      setSnapshotResultUrl(statusData?.generation.result_url ?? null);
      setSnapshotResultAssetId(statusData?.generation.result_asset_id ?? null);
      setSnapshotRetryCount(statusData?.generation.retry_count ?? 0);
      setSnapshotGenerationId(generationId);
      setStep("completed");
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }

    if (genStatus === "failed") {
      setGenError(friendlyError(statusData?.generation.error_code));
      setStep("error");
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }
  }, [step, genStatus, statusData?.generation.error_code, statusData?.generation.result_url, statusData?.generation.retry_count]);

  // Stall detection: if progress doesn't change for STALL_TIMEOUT_MS, show error
  useEffect(() => {
    if (step !== "tracking") {
      lastProgressRef.current = { pct: 0, at: Date.now() };
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
      return;
    }

    // Progress changed → reset timer
    if (progressPct !== lastProgressRef.current.pct) {
      lastProgressRef.current = { pct: progressPct, at: Date.now() };
    }

    // Set/reset stall timer
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (step === "tracking") {
        setGenError("A geração parece travada. Tente novamente.");
        setStep("error");
      }
    }, STALL_TIMEOUT_MS);

    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [step, progressPct]);

  const resetAll = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setAssetId(null);
    setAssetUrl(null);
    setStep("idle");
    setGenerationId(null);
    setGenError(null);
    setActionModal(null);
    setSnapshotResultUrl(null);
    setSnapshotResultAssetId(null);
    setSnapshotRetryCount(0);
    setSnapshotGenerationId(null);
  }, [preview]);

  

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
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
    setGenerationId(null);
    setGenError(null);
    setSnapshotResultUrl(null);
    setSnapshotResultAssetId(null);
    setSnapshotRetryCount(0);
    setSnapshotGenerationId(null);
    setStep("uploading");
    uploadMutation.mutate(f);
  };

  const handleSwapImage = () => {
    fileInputRef.current?.click();
  };

  // Generate mutation (supports optional prompt reuse)
  const generateMutation = useMutation({
    mutationFn: async (reuseFromId?: string) => {
      if (!assetId) throw new Error("No asset");
      setGenError(null);
      setStep("generating");

      const body: Record<string, unknown> = {
        toolType: "quick_similar_image",
        pipelineType: "text_to_image",
        sourceMode: "single_asset",
        referenceAssetIds: [assetId],
      };

      if (reuseFromId) {
        body.reusePromptFromGenerationId = reuseFromId;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-generation",
        { body }
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
      setGenError(err.message || "Erro ao iniciar geração.");
      setStep("error");
      toast.error("Erro ao iniciar geração.");
    },
  });

  // "Gerar outra variação": reuse prompt from completed generation
  const handleRegenerate = useCallback(() => {
    const reuseId = snapshotGenerationId;
    setGenerationId(null);
    setGenError(null);
    setSnapshotResultUrl(null);
    setSnapshotResultAssetId(null);
    setSnapshotRetryCount(0);
    setSnapshotGenerationId(null);
    setStep("ready");
    setTimeout(() => generateMutation.mutate(reuseId ?? undefined), 0);
  }, [generateMutation, snapshotGenerationId]);

  // Create avatar from result (uses generated image as cover + both as references)
  const createAvatarMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!snapshotResultAssetId) {
        throw new Error("A imagem gerada não foi encontrada. Gere uma nova variação antes de criar o avatar.");
      }
      if (!assetId) throw new Error("No reference asset");
      const { error } = await supabase.functions.invoke(
        "create-avatar-profile",
        {
          body: {
            name,
            referenceAssetIds: [snapshotResultAssetId, assetId],
            coverAssetId: snapshotResultAssetId,
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

  // Download handler
  const handleDownload = async () => {
    if (!resultUrl) return;
    try {
      const res = await fetch(resultUrl);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `variacao.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Erro ao baixar imagem.");
    }
  };

  const showMainButton = step === "ready" || step === "generating" || step === "tracking";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Geração Rápida</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Envie uma imagem, gere uma variação e decida: crie um novo avatar ou apenas baixe o resultado.
            </p>
          </div>
          <Link
            to="/avatars"
            className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors flex items-center gap-1 mt-1"
          >
            Ver avatares
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
            {(step === "idle" || step === "uploading" || step === "ready") && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/10 aspect-square">
                <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60 text-center px-4">
                  {step === "ready"
                    ? 'Clique em "Gerar Variação" para criar uma variação'
                    : "Selecione uma imagem de referência para começar"}
                </p>
              </div>
            )}

            {/* Generating / Tracking */}
            {(step === "generating" || step === "tracking") && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/10 aspect-square">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando variação…</p>
                {step === "tracking" && (
                  <div className="w-3/4 space-y-1">
                    <Progress value={progressPct} className="h-2" />
                    <p className="text-xs text-muted-foreground/60 text-center">
                      {progressPct}%
                      {currentStepLabel && ` · ${currentStepLabel}`}
                    </p>
                    {(statusData?.generation.retry_count ?? 0) > 0 && (
                      <p className="text-xs text-yellow-500 text-center">
                        Retry #{statusData?.generation.retry_count}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Completed: result image + actions */}
            {step === "completed" && resultUrl && (
              <>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <img
                    src={resultUrl}
                    alt="Variação gerada"
                    className="w-full aspect-square object-cover"
                  />
                </div>
                <div className="space-y-2 pt-1">
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => setActionModal("create")}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Criar novo avatar com esta variação
                  </Button>
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
                    onClick={handleDownload}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar imagem
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground"
                    onClick={resetAll}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Recomeçar
                  </Button>
                </div>
              </>
            )}

            {/* Error state */}
            {step === "error" && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 aspect-square p-4">
                <AlertCircle className="h-10 w-10 text-destructive/60" />
                <Alert variant="destructive" className="border-0 bg-transparent">
                  <AlertDescription className="text-center text-sm">
                    {genError || "Erro desconhecido."}
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2 w-full max-w-[200px]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => {
                      setGenError(null);
                      setStep("ready");
                      generateMutation.mutate(undefined);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground"
                    onClick={handleSwapImage}
                  >
                    Trocar imagem
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground"
                    onClick={resetAll}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Recomeçar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main generate button — only visible in ready/generating/tracking */}
        {showMainButton && (
          <div className="flex justify-center">
            <Button
              size="lg"
              className="gap-2"
              disabled={step !== "ready" || !assetId || generateMutation.isPending}
              onClick={() => generateMutation.mutate(undefined)}
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar Variação
            </Button>
          </div>
        )}
      </main>

      {/* Create Avatar Modal */}
      <CreateAvatarFromResultModal
        open={actionModal === "create"}
        onOpenChange={(v) => { if (!v) setActionModal(null); }}
        isPending={createAvatarMutation.isPending}
        onSubmit={(name) => createAvatarMutation.mutate(name)}
        resultUrl={resultUrl}
      />
    </div>
  );
}

/* ---------- Create Avatar Modal ---------- */

function CreateAvatarFromResultModal({
  open,
  onOpenChange,
  isPending,
  onSubmit,
  resultUrl,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPending: boolean;
  onSubmit: (name: string) => void;
  resultUrl: string | null;
}) {
  const [name, setName] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Criar avatar a partir da variação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {resultUrl && (
            <div className="flex items-center gap-3 rounded-lg border border-border/50 p-2 bg-muted/10">
              <img
                src={resultUrl}
                alt="Variação"
                className="h-14 w-14 rounded-md object-cover shrink-0"
              />
              <p className="text-xs text-muted-foreground">
                A variação gerada será usada como imagem de referência do novo avatar.
              </p>
            </div>
          )}
          <div className="space-y-2">
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
