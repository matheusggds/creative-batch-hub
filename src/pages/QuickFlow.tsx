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
  RefreshCw,
  AlertCircle,
  Download,
  RotateCcw,
  ArrowRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "idle" | "uploading" | "ready" | "generating" | "tracking" | "completed" | "error";

interface SessionVariation {
  generationId: string;
  status: "pending" | "completed" | "error";
  resultUrl?: string;
  resultAssetId?: string;
  errorMessage?: string;
}

const STALL_TIMEOUT_MS = 120_000;

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
  const [genError, setGenError] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<"create" | null>(null);

  // Session variations history (in-memory only)
  const [sessionVariations, setSessionVariations] = useState<SessionVariation[]>([]);
  const [selectedVarIndex, setSelectedVarIndex] = useState<number>(-1);

  // Single tracking id for the first generation (no batch)
  const [singleTrackingId, setSingleTrackingId] = useState<string | null>(null);

  // Active variation derived from array + index
  const activeVar: SessionVariation | null =
    selectedVarIndex >= 0 && selectedVarIndex < sessionVariations.length
      ? sessionVariations[selectedVarIndex]
      : null;

  // Count pending variations
  const pendingCount = sessionVariations.filter((v) => v.status === "pending").length;
  const completedVars = sessionVariations.filter((v) => v.status === "completed");

  // Single generation tracking (first generation only, no batch)
  const trackingId = step === "tracking" ? singleTrackingId : null;
  const { data: statusData } = useGenerationStatus(trackingId, { skipDetails: true });
  const genStatus = statusData?.generation.status ?? null;
  const progressPct = statusData?.generation.progress_pct ?? 0;
  const currentStepLabel = statusData?.generation.current_step ?? null;

  // Result URL: active variation in completed, live data during single tracking
  const resultUrl =
    step === "completed"
      ? activeVar?.resultUrl ?? null
      : statusData?.generation.result_url ?? null;

  // Stall detection
  const lastProgressRef = useRef<{ pct: number; at: number }>({ pct: 0, at: Date.now() });
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Transition from single tracking → completed or error
  useEffect(() => {
    if (step !== "tracking" || !singleTrackingId) return;
    // Only handle single tracking (non-batch) — batch uses VariationTracker
    if (pendingCount > 0 && !singleTrackingId) return;

    if (genStatus === "completed") {
      const newVar: SessionVariation = {
        generationId: singleTrackingId,
        status: "completed",
        resultUrl: statusData?.generation.result_url ?? "",
        resultAssetId: statusData?.generation.result_asset_id ?? "",
      };
      setSessionVariations((prev) => {
        // Replace placeholder if exists, otherwise append
        const idx = prev.findIndex((v) => v.generationId === singleTrackingId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newVar;
          return next;
        }
        return [...prev, newVar];
      });
      setSingleTrackingId(null);
      // Auto-select this variation
      setSessionVariations((prev) => {
        const idx = prev.findIndex((v) => v.generationId === singleTrackingId);
        if (idx >= 0) setSelectedVarIndex(idx);
        else setSelectedVarIndex(prev.length - 1);
        return prev;
      });
      setStep("completed");
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }

    if (genStatus === "failed") {
      setGenError(friendlyError(statusData?.generation.error_code));
      setSingleTrackingId(null);
      setStep("error");
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }
  }, [step, genStatus, singleTrackingId, statusData, pendingCount]);

  // Stall detection for single tracking
  useEffect(() => {
    if (step !== "tracking") {
      lastProgressRef.current = { pct: 0, at: Date.now() };
      if (stallTimerRef.current) { clearTimeout(stallTimerRef.current); stallTimerRef.current = null; }
      return;
    }
    if (progressPct !== lastProgressRef.current.pct) {
      lastProgressRef.current = { pct: progressPct, at: Date.now() };
    }
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (step === "tracking") {
        setGenError("A geração parece travada. Tente novamente.");
        setStep("error");
      }
    }, STALL_TIMEOUT_MS);
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [step, progressPct]);

  // Handle batch variation completion callback
  const handleVariationComplete = useCallback(
    (generationId: string, resultUrl: string, resultAssetId: string) => {
      setSessionVariations((prev) => {
        const next = prev.map((v) =>
          v.generationId === generationId
            ? { ...v, status: "completed" as const, resultUrl, resultAssetId }
            : v
        );
        // Auto-select first completed if nothing selected yet or current selection is pending
        const completedIdx = next.findIndex(
          (v) => v.generationId === generationId
        );
        return next;
      });

      // Check if all pending are now done
      setSessionVariations((prev) => {
        const stillPending = prev.filter((v) => v.status === "pending").length;
        if (stillPending === 0 && step === "tracking") {
          // Find first completed to select
          const firstCompleted = prev.findIndex((v) => v.status === "completed");
          if (firstCompleted >= 0 && (selectedVarIndex < 0 || prev[selectedVarIndex]?.status !== "completed")) {
            setSelectedVarIndex(firstCompleted);
          }
          setStep("completed");
        }
        return prev;
      });
    },
    [step, selectedVarIndex]
  );

  const handleVariationError = useCallback(
    (generationId: string, errorCode: string | null) => {
      setSessionVariations((prev) => {
        const next = prev.map((v) =>
          v.generationId === generationId
            ? { ...v, status: "error" as const, errorMessage: friendlyError(errorCode) }
            : v
        );
        const stillPending = next.filter((v) => v.status === "pending").length;
        if (stillPending === 0 && step === "tracking") {
          const firstCompleted = next.findIndex((v) => v.status === "completed");
          if (firstCompleted >= 0) {
            setSelectedVarIndex(firstCompleted);
            setStep("completed");
          } else {
            setGenError("Todas as variações falharam.");
            setStep("error");
          }
        }
        return next;
      });
    },
    [step]
  );

  const resetAll = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setAssetId(null);
    setAssetUrl(null);
    setStep("idle");
    setSingleTrackingId(null);
    setGenError(null);
    setActionModal(null);
    setSessionVariations([]);
    setSelectedVarIndex(-1);
  }, [preview]);

  // Auto-upload on file select
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const fileUrl = await uploadAssetFile(user.id, file);
      const { data: asset, error } = await supabase
        .from("assets")
        .insert({ user_id: user.id, type: "reference", file_url: fileUrl, name: file.name })
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
    setSingleTrackingId(null);
    setGenError(null);
    setSessionVariations([]);
    setSelectedVarIndex(-1);
    setStep("uploading");
    uploadMutation.mutate(f);
  };

  const handleSwapImage = () => fileInputRef.current?.click();

  // Generate mutation — supports variationCount
  const generateMutation = useMutation({
    mutationFn: async ({
      reuseFromId,
      variationCount,
    }: {
      reuseFromId?: string;
      variationCount?: number;
    }) => {
      if (!assetId) throw new Error("No asset");
      setGenError(null);
      setStep("generating");

      const body: Record<string, unknown> = {
        toolType: "quick_similar_image",
        pipelineType: "text_to_image",
        sourceMode: "single_asset",
        referenceAssetIds: [assetId],
      };

      const input: Record<string, unknown> = {};
      if (reuseFromId) input.reusePromptFromGenerationId = reuseFromId;
      if (variationCount && variationCount > 1) input.variationCount = variationCount;
      if (Object.keys(input).length > 0) body.input = input;

      const { data, error } = await supabase.functions.invoke("create-generation", { body });
      if (error) throw error;
      return data as { generationId?: string; generationIds?: string[] };
    },
    onSuccess: (data, variables) => {
      // Normalize response — handle both single and batch
      const ids: string[] = data?.generationIds ?? (data?.generationId ? [data.generationId] : []);

      if (ids.length === 0) {
        setGenError("Nenhuma geração foi criada.");
        setStep("error");
        return;
      }

      if (ids.length === 1 && !(variables.variationCount && variables.variationCount > 1)) {
        // Single generation — use the existing single tracking path
        setSingleTrackingId(ids[0]);
        setStep("tracking");
        return;
      }

      // Batch — add pending entries and let VariationTrackers handle completion
      const newVars: SessionVariation[] = ids.map((id) => ({
        generationId: id,
        status: "pending" as const,
      }));

      setSessionVariations((prev) => [...prev, ...newVars]);
      setSingleTrackingId(null);
      setStep("tracking");
    },
    onError: (err: Error) => {
      setGenError(err.message || "Erro ao iniciar geração.");
      setStep("error");
      toast.error("Erro ao iniciar geração.");
    },
  });

  // "Gerar outra variação": reuse prompt, single
  const handleRegenerate = useCallback(() => {
    const reuseId = activeVar?.generationId;
    setSingleTrackingId(null);
    setGenError(null);
    setStep("ready");
    setTimeout(() => generateMutation.mutate({ reuseFromId: reuseId ?? undefined, variationCount: 1 }), 0);
  }, [generateMutation, activeVar]);

  // "Gerar 5 variações": reuse prompt, batch
  const handleGenerateBatch = useCallback(() => {
    const reuseId = activeVar?.generationId;
    if (!reuseId) return;
    setSingleTrackingId(null);
    setGenError(null);
    setStep("ready");
    setTimeout(() => generateMutation.mutate({ reuseFromId: reuseId, variationCount: 5 }), 0);
  }, [generateMutation, activeVar]);

  const handleSelectVariation = useCallback((index: number) => {
    const v = sessionVariations[index];
    if (v?.status === "completed") setSelectedVarIndex(index);
  }, [sessionVariations]);

  // Create avatar from active variation
  const createAvatarMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!activeVar?.resultAssetId) throw new Error("Imagem não encontrada.");
      if (!assetId) throw new Error("No reference asset");
      const { error } = await supabase.functions.invoke("create-avatar-profile", {
        body: {
          name,
          referenceAssetIds: [activeVar.resultAssetId, assetId],
          coverAssetId: activeVar.resultAssetId,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avatar criado!");
      qc.invalidateQueries({ queryKey: ["avatar_profiles"] });
      setActionModal(null);
    },
    onError: () => toast.error("Erro ao criar avatar."),
  });

  const handleDownload = async () => {
    const url = activeVar?.resultUrl;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `variacao.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Erro ao baixar imagem.");
    }
  };

  const showMainButton = step === "ready" || step === "generating" || (step === "tracking" && !!singleTrackingId);
  const hasCompletedSource = completedVars.length > 0;

  // Pending variation IDs for batch tracking
  const pendingVariationIds = sessionVariations
    .filter((v) => v.status === "pending")
    .map((v) => v.generationId);

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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={handleFileChange}
        />

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
                <img src={preview} alt="Referência" className="w-full aspect-square object-cover" />
                {step === "uploading" && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                )}
              </div>
            )}

            {preview && step !== "uploading" && (
              <Button variant="ghost" size="sm" className="w-full gap-2" onClick={handleSwapImage}>
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
            {(step === "idle" || step === "uploading" || step === "ready") && !hasCompletedSource && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/10 aspect-square">
                <Sparkles className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60 text-center px-4">
                  {step === "ready"
                    ? 'Clique em "Gerar Variação" para criar uma variação'
                    : "Selecione uma imagem de referência para começar"}
                </p>
              </div>
            )}

            {/* Single generation tracking */}
            {(step === "generating" || (step === "tracking" && !!singleTrackingId)) && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/10 aspect-square">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando variação…</p>
                {step === "tracking" && (
                  <div className="w-3/4 space-y-1">
                    <Progress value={progressPct} className="h-2" />
                    <p className="text-xs text-muted-foreground/60 text-center">
                      {progressPct}%{currentStepLabel && ` · ${currentStepLabel}`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Batch tracking — show result area with thumbnails updating live */}
            {step === "tracking" && !singleTrackingId && pendingCount > 0 && (
              <div className="space-y-3">
                {/* Show active completed var or a loading placeholder */}
                {activeVar?.status === "completed" && activeVar.resultUrl ? (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <img src={activeVar.resultUrl} alt="Variação ativa" className="w-full aspect-square object-cover" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border/50 bg-muted/10 aspect-square">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Gerando {pendingCount} variação{pendingCount > 1 ? "ões" : ""}…
                    </p>
                  </div>
                )}
                {/* Live thumbnail strip during batch */}
                <VariationThumbnailStrip
                  variations={sessionVariations}
                  selectedIndex={selectedVarIndex}
                  onSelect={handleSelectVariation}
                />
              </div>
            )}

            {/* Completed: result image + thumbnail strip + actions */}
            {step === "completed" && resultUrl && (
              <>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <img src={resultUrl} alt="Variação gerada" className="w-full aspect-square object-cover" />
                </div>

                <VariationThumbnailStrip
                  variations={sessionVariations}
                  selectedIndex={selectedVarIndex}
                  onSelect={handleSelectVariation}
                />

                <div className="space-y-2 pt-1">
                  <Button size="sm" className="w-full gap-2" onClick={() => setActionModal("create")}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Criar novo avatar com esta variação
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleRegenerate}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar outra variação
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleGenerateBatch}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Gerar 5 variações
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleDownload}>
                    <Download className="h-3.5 w-3.5" />
                    Baixar imagem
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={resetAll}>
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
                      generateMutation.mutate({ variationCount: undefined });
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar novamente
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleSwapImage}>
                    Trocar imagem
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={resetAll}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    Recomeçar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main generate button */}
        {showMainButton && !hasCompletedSource && (
          <div className="flex justify-center">
            <Button
              size="lg"
              className="gap-2"
              disabled={step !== "ready" || !assetId || generateMutation.isPending}
              onClick={() => generateMutation.mutate({ variationCount: undefined })}
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

      {/* Headless batch trackers */}
      {pendingVariationIds.map((id) => (
        <VariationTracker
          key={id}
          generationId={id}
          onComplete={handleVariationComplete}
          onError={handleVariationError}
        />
      ))}

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

/* ---------- Headless Variation Tracker ---------- */

function VariationTracker({
  generationId,
  onComplete,
  onError,
}: {
  generationId: string;
  onComplete: (id: string, resultUrl: string, resultAssetId: string) => void;
  onError: (id: string, errorCode: string | null) => void;
}) {
  const { data } = useGenerationStatus(generationId, { skipDetails: true });
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !data) return;
    if (data.generation.status === "completed") {
      firedRef.current = true;
      onComplete(
        generationId,
        data.generation.result_url ?? "",
        data.generation.result_asset_id ?? ""
      );
    } else if (data.generation.status === "failed") {
      firedRef.current = true;
      onError(generationId, data.generation.error_code);
    }
  }, [data, generationId, onComplete, onError]);

  return null;
}

/* ---------- Variation Thumbnail Strip ---------- */

function VariationThumbnailStrip({
  variations,
  selectedIndex,
  onSelect,
}: {
  variations: SessionVariation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  if (variations.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-1 px-0.5">
      {variations.map((v, i) => (
        <button
          key={v.generationId}
          onClick={() => onSelect(i)}
          disabled={v.status !== "completed"}
          className={cn(
            "shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-all relative",
            v.status === "completed" && i === selectedIndex
              ? "border-primary ring-1 ring-primary/50"
              : v.status === "completed"
              ? "border-border/50 opacity-70 hover:border-border hover:opacity-90"
              : "border-border/30 opacity-50"
          )}
        >
          {v.status === "completed" && v.resultUrl ? (
            <img src={v.resultUrl} alt={`Variação ${i + 1}`} className="h-full w-full object-cover" />
          ) : v.status === "pending" ? (
            <div className="h-full w-full flex items-center justify-center bg-muted/20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive/60" />
            </div>
          )}
          <span className="absolute bottom-0 right-0 text-[9px] bg-background/80 px-0.5 rounded-tl text-muted-foreground">
            {i + 1}
          </span>
        </button>
      ))}
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
              <img src={resultUrl} alt="Variação" className="h-14 w-14 rounded-md object-cover shrink-0" />
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
          <Button disabled={!name.trim() || isPending} onClick={() => onSubmit(name.trim())} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
