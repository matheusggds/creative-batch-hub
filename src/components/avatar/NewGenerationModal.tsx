import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { AvatarReferenceAsset } from "@/hooks/useAvatarProfile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { GenerationTypeSelector, type GenerationType } from "./GenerationTypeSelector";
import { ShotPicker, SHOT_LIST, toggleShotInSet, toggleGroupInSet } from "./ShotPicker";

/* ── Image Model definitions ── */
interface ImageModelOption {
  id: string;
  label: string;
  subtitle: string;
  image_model: string;
  thinking_level?: string;
}

const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro",
    subtitle: "Máxima qualidade · Mais lento",
    image_model: "gemini-3-pro-image-preview",
  },
  {
    id: "nano-banana-2-high",
    label: "Nano Banana 2 High",
    subtitle: "Alta qualidade · Moderado",
    image_model: "gemini-3.1-flash-image-preview",
    thinking_level: "high",
  },
  {
    id: "nano-banana-2-fast",
    label: "Nano Banana 2 Fast",
    subtitle: "Rápido · Boa qualidade",
    image_model: "gemini-3.1-flash-image-preview",
    thinking_level: "minimal",
  },
];

const DEFAULT_MODEL_ID = "nano-banana-2-fast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarProfileId: string;
  references: AvatarReferenceAsset[];
  onGenerationCreated?: (generationId: string) => void;
  preselectedAssetIds?: string[];
  completedShotIds?: Set<string>;
}

type Step = 1 | 2 | 3 | 4;

export function NewGenerationModal({
  open,
  onOpenChange,
  avatarProfileId,
  references,
  onGenerationCreated,
  preselectedAssetIds,
  completedShotIds,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>(1);
  const [generationType, setGenerationType] = useState<GenerationType | null>(null);
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [focusPiece, setFocusPiece] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const availableReferenceIds = new Set(references.map((ref) => ref.asset_id));

  // Sync preselected IDs when modal opens
  const preselectedKey = preselectedAssetIds?.slice().sort().join(",") ?? "";
  useEffect(() => {
    if (!open) return;
    const parsedIds = preselectedKey ? preselectedKey.split(",") : [];
    const validIds = parsedIds.filter((id) => availableReferenceIds.has(id)).slice(0, 3);
    if (validIds.length > 0) {
      setSelectedRefIds(new Set(validIds));
    } else {
      setSelectedRefIds(new Set());
    }
  }, [open, preselectedKey, references]);

  const reset = () => {
    setStep(1);
    setGenerationType(null);
    setSelectedRefIds(new Set());
    setSelectedShotIds(new Set());
    setFocusPiece("");
    setSelectedModelId(DEFAULT_MODEL_ID);
    setCreatedCount(null);
  };

  const toggleRef = (assetId: string) => {
    setSelectedRefIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        if (next.size >= 3) {
          toast.error("Máximo de 3 imagens de referência.");
          return prev;
        }
        next.add(assetId);
      }
      return next;
    });
  };

  const validReferenceCount = Array.from(selectedRefIds).filter((id) => availableReferenceIds.has(id)).length;

  const selectedModel = IMAGE_MODELS.find((m) => m.id === selectedModelId)!;

  // --- Mutation ---
  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const referenceAssetIds = Array.from(selectedRefIds).filter((id) => availableReferenceIds.has(id));
      const shotIds = Array.from(selectedShotIds);

      if (referenceAssetIds.length < 1) throw new Error("Selecione ao menos 1 imagem de referência.");
      if (shotIds.length < 1) throw new Error("Selecione ao menos 1 ângulo.");

      const results = await Promise.all(
        shotIds.map(async (shotId) => {
          const input: Record<string, unknown> = {
            shotId,
            focusPiece: focusPiece.trim() || undefined,
            image_model: selectedModel.image_model,
            promptPackId: "ugc-avatar-reference-pack-v1",
          };
          if (selectedModel.thinking_level) {
            input.thinking_level = selectedModel.thinking_level;
          }

          const { data, error } = await supabase.functions.invoke("create-generation", {
            body: {
              toolType: "avatar_base_pack_generation",
              pipelineType: "multimodal_image_generation",
              sourceMode: "avatar_workspace",
              avatarProfileId,
              referenceAssetIds,
              input,
            },
          });
          if (error) {
            console.error(`create-generation error for shot ${shotId}:`, error);
            throw new Error(`Falha ao criar geração para ${SHOT_LIST.find((s) => s.id === shotId)?.label ?? shotId}`);
          }
          return data as { generationId: string };
        })
      );
      return results;
    },
    onSuccess: (data) => {
      setCreatedCount(data.length);
      toast.success(`${data.length} ${data.length === 1 ? "geração criada com sucesso" : "gerações criadas com sucesso"}!`);
      qc.invalidateQueries({ queryKey: ["avatar_generations", avatarProfileId] });
      if (data[0]?.generationId) onGenerationCreated?.(data[0].generationId);
      reset();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar gerações.");
      console.error("NewGenerationModal error:", err);
    },
  });

  // --- Step navigation helpers ---
  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return generationType !== null;
      case 2: return validReferenceCount >= 1;
      case 3: return selectedShotIds.size > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 4) setStep((s) => (s + 1) as Step);
  };
  const handleBack = () => {
    if (step > 1) setStep((s) => (s - 1) as Step);
  };

  const stepLabels: Record<Step, string> = {
    1: "Tipo de Geração",
    2: "Referências",
    3: "Opções",
    4: "Revisar e Gerar",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (mutation.isPending) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova Geração</DialogTitle>
          <DialogDescription>
            {createdCount !== null ? "Geração criada com sucesso." : stepLabels[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {createdCount === null && (
          <div className="flex items-center gap-1 px-1">
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {createdCount !== null ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">
              {createdCount} geração{createdCount !== 1 ? "ões" : ""} iniciada{createdCount !== 1 ? "s" : ""}!
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Acompanhe o progresso na Biblioteca do Avatar.
            </p>
            <Button className="mt-2" onClick={() => { reset(); onOpenChange(false); }}>
              Fechar
            </Button>
          </div>
        ) : (
          /* ── Step content ── */
          <>
            <div className="flex-1 overflow-y-auto py-1 space-y-4">
              {step === 1 && (
                <GenerationTypeSelector
                  selected={generationType}
                  onSelect={(t) => { setGenerationType(t); }}
                />
              )}

              {step === 2 && (
                <ReferencePicker
                  references={references}
                  selectedRefIds={selectedRefIds}
                  toggleRef={toggleRef}
                  validReferenceCount={validReferenceCount}
                  hasPreselection={!!preselectedKey && validReferenceCount > 0}
                  disabled={mutation.isPending}
                />
              )}

              {step === 3 && generationType === "base_angles" && (
                <div className="space-y-4">
                  {/* Model Selector */}
                  <div className="space-y-2">
                    <Label>Modelo de imagem</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {IMAGE_MODELS.map((model) => {
                        const isSelected = selectedModelId === model.id;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => setSelectedModelId(model.id)}
                            disabled={mutation.isPending}
                            className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-border/50 bg-card hover:border-primary/40"
                            } disabled:pointer-events-none disabled:opacity-50`}
                          >
                            <span className="text-xs font-medium leading-tight">{model.label}</span>
                            <span className="text-[10px] leading-tight text-muted-foreground">{model.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <ShotPicker
                    selectedShotIds={selectedShotIds}
                    onToggleShot={(id) => setSelectedShotIds((p) => toggleShotInSet(p, id))}
                    onToggleGroup={(g) => setSelectedShotIds((p) => toggleGroupInSet(p, g, completedShotIds))}
                    disabled={mutation.isPending}
                    disabledShotIds={completedShotIds}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="focus-piece">
                      Focus Piece <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="focus-piece"
                      placeholder="Ex: jaqueta jeans, vestido floral…"
                      value={focusPiece}
                      onChange={(e) => setFocusPiece(e.target.value)}
                      disabled={mutation.isPending}
                      maxLength={200}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <ReviewStep
                  generationType={generationType}
                  referenceCount={validReferenceCount}
                  shotCount={selectedShotIds.size}
                  focusPiece={focusPiece}
                  modelLabel={selectedModel.label}
                />
              )}

              {mutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{(mutation.error as Error).message}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack} disabled={mutation.isPending} className="gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </Button>
              ) : (
                <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={mutation.isPending}>
                  Cancelar
                </Button>
              )}

              {step < 4 ? (
                <Button onClick={handleNext} disabled={!canAdvance()} className="gap-1.5">
                  Avançar <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button onClick={() => mutation.mutate()} disabled={!canAdvance() || mutation.isPending} className="gap-2">
                  {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mutation.isPending
                    ? "Gerando…"
                    : `Gerar ${selectedShotIds.size} Ângulo${selectedShotIds.size !== 1 ? "s" : ""}`}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Reference Picker (Step 2) ── */
function ReferencePicker({
  references,
  selectedRefIds,
  toggleRef,
  validReferenceCount,
  hasPreselection,
  disabled,
}: {
  references: AvatarReferenceAsset[];
  selectedRefIds: Set<string>;
  toggleRef: (id: string) => void;
  validReferenceCount: number;
  hasPreselection: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          Imagens de Referência{" "}
          <span className="text-muted-foreground font-normal">({validReferenceCount}/3)</span>
        </Label>
        {hasPreselection && (
          <span className="text-xs text-muted-foreground">Pré-carregado da biblioteca</span>
        )}
      </div>
      <ScrollArea className="h-[340px] rounded-lg border border-border/50 p-2">
        {references.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma imagem disponível.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {references.map((ref) => {
              const isSelected = selectedRefIds.has(ref.asset_id);
              return (
                <div
                  key={ref.id}
                  className={`relative aspect-square rounded-md border overflow-hidden cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/50 hover:border-primary/40"
                  } ${disabled ? "pointer-events-none opacity-50" : ""}`}
                  onClick={() => toggleRef(ref.asset_id)}
                >
                  {ref.file_url ? (
                    <img src={ref.file_url} alt={ref.asset_name ?? "Ref"} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className={`absolute top-1 left-1 transition-opacity ${isSelected ? "opacity-100" : "opacity-0"}`}>
                    <Checkbox
                      checked={isSelected}
                      className="h-4 w-4 rounded bg-background/80 backdrop-blur-sm"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleRef(ref.asset_id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ── Review Step (Step 4) ── */
const TYPE_LABELS: Record<GenerationType, string> = {
  base_angles: "Ângulos Base",
  new_look: "Novo Look",
  outfit_variation: "Variação de Roupa",
  from_references: "A partir de Referências",
};

function ReviewStep({
  generationType,
  referenceCount,
  shotCount,
  focusPiece,
  modelLabel,
}: {
  generationType: GenerationType | null;
  referenceCount: number;
  shotCount: number;
  focusPiece: string;
  modelLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border/50 p-4 space-y-3">
      <h4 className="font-medium text-sm">Resumo da Geração</h4>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-medium">{generationType ? TYPE_LABELS[generationType] : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Modelo</span>
          <span className="font-medium">{modelLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Referências</span>
          <span className="font-medium">{referenceCount} imagem{referenceCount !== 1 ? "ns" : ""}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ângulos</span>
          <span className="font-medium">{shotCount} shot{shotCount !== 1 ? "s" : ""}</span>
        </div>
        {focusPiece.trim() && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Focus Piece</span>
            <span className="font-medium truncate max-w-[200px]">{focusPiece.trim()}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 border-t border-border/30">
          <span className="text-muted-foreground">Total de gerações</span>
          <span className="font-semibold text-primary">{shotCount}</span>
        </div>
      </div>
    </div>
  );
}
