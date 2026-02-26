import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

const SHOT_LIST = [
  { id: "TH1_FRONT_NEUTRAL", label: "Frontal Neutro", group: "Torso/Head" },
  { id: "TH2_FRONT_GENTLE_SMILE", label: "Frontal Sorriso Leve", group: "Torso/Head" },
  { id: "TH3_FRONT_SPEAKING_FRAME", label: "Frontal Falando", group: "Torso/Head" },
  { id: "TH4_45_NEUTRAL", label: "45° Neutro", group: "Torso/Head" },
  { id: "TH5_45_GENTLE_SMILE", label: "45° Sorriso Leve", group: "Torso/Head" },
  { id: "TH6_PROFILE_90_NEUTRAL", label: "Perfil 90° Neutro", group: "Torso/Head" },
  { id: "FB1_FULL_FRONT", label: "Corpo Inteiro Frontal", group: "Full Body" },
  { id: "FB2_FULL_45", label: "Corpo Inteiro 45°", group: "Full Body" },
  { id: "FB3_FULL_PROFILE_90", label: "Corpo Inteiro Perfil 90°", group: "Full Body" },
  { id: "FB4_FULL_BACK_180", label: "Corpo Inteiro Costas", group: "Full Body" },
  { id: "FB5_HANDS_FOCUS", label: "Foco nas Mãos", group: "Full Body" },
  { id: "FB6_UPPER_GARMENT_DETAIL", label: "Detalhe Roupa Superior", group: "Full Body" },
  { id: "FB7_LOWER_GARMENT_DETAIL", label: "Detalhe Roupa Inferior", group: "Full Body" },
  { id: "FB8_LIFESTYLE_UGC", label: "Lifestyle UGC", group: "Full Body" },
] as const;

const SHOT_GROUPS = [...new Set(SHOT_LIST.map((s) => s.group))];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarProfileId: string;
  references: AvatarReferenceAsset[];
  onGenerationCreated?: (generationId: string) => void;
}

export function GenerateBaseAnglesModal({
  open,
  onOpenChange,
  avatarProfileId,
  references,
  onGenerationCreated,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set());
  const [focusPiece, setFocusPiece] = useState("");
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const reset = () => {
    setSelectedRefIds(new Set());
    setSelectedShotIds(new Set());
    setFocusPiece("");
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

  const toggleShot = (shotId: string) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      if (next.has(shotId)) next.delete(shotId);
      else next.add(shotId);
      return next;
    });
  };

  const toggleGroup = (group: string) => {
    const groupShots = SHOT_LIST.filter((s) => s.group === group).map((s) => s.id);
    const allSelected = groupShots.every((id) => selectedShotIds.has(id));
    setSelectedShotIds((prev) => {
      const next = new Set(prev);
      groupShots.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const referenceAssetIds = Array.from(selectedRefIds);
      const shotIds = Array.from(selectedShotIds);

      // Create one generation per selected shot
      const generations = shotIds.map((shotId) => ({
        user_id: user.id,
        avatar_profile_id: avatarProfileId,
        reference_asset_id: referenceAssetIds[0], // backward compat with process-generation
        status: "pending" as const,
        pipeline_type: "multimodal_image_generation",
        tool_type: "avatar_base_pack_generation",
        source_mode: "avatar_workspace",
        ai_parameters: {
          promptPackId: "ugc-avatar-reference-pack-v1",
          shotId,
          focusPiece: focusPiece.trim() || undefined,
          geminiPreferredModel: "gemini-3-pro-image-preview",
          _debug: {
            pipeline: "create-generation",
            selectedRefAssetIds: referenceAssetIds,
            selectedShotId: shotId,
            shotLabel: SHOT_LIST.find((s) => s.id === shotId)?.label ?? shotId,
            focusPiece: focusPiece.trim() || null,
            refCount: referenceAssetIds.length,
            submittedAt: new Date().toISOString(),
          },
        } as unknown as Record<string, never>,
      }));

      const { data: insertedGens, error: genError } = await supabase
        .from("generations")
        .insert(generations)
        .select();

      if (genError) throw genError;
      if (!insertedGens?.length) throw new Error("No generations created");

      // For each generation, populate generation_reference_assets
      const refAssetRows = insertedGens.flatMap((gen) =>
        referenceAssetIds.map((assetId, idx) => ({
          generation_id: gen.id,
          asset_id: assetId,
          role: "reference",
          sort_order: idx,
        }))
      );

      if (refAssetRows.length > 0) {
        const { error: refError } = await supabase
          .from("generation_reference_assets")
          .insert(refAssetRows);
        if (refError) console.error("generation_reference_assets insert error:", refError);
      }

      // Fire-and-forget: invoke create-generation (queued job-based pipeline)
      for (const gen of insertedGens) {
        const shotId = (gen.ai_parameters as Record<string, unknown>)?.shotId as string;
        supabase.functions
          .invoke("create-generation", {
            body: {
              toolType: "avatar_base_pack_generation",
              pipelineType: "multimodal_image_generation",
              sourceMode: "avatar_workspace",
              avatarProfileId,
              referenceAssetIds: referenceAssetIds,
              generationId: gen.id,
              input: {
                shotId,
                focusPiece: focusPiece.trim() || undefined,
                geminiPreferredModel: "gemini-3-pro-image-preview",
                promptPackId: "ugc-avatar-reference-pack-v1",
              },
            },
          })
          .then(({ error }) => {
            if (error) console.error(`Edge function error for ${gen.id}:`, error);
          });
      }

      return insertedGens;
    },
    onSuccess: (data) => {
      setCreatedCount(data.length);
      toast.success(`${data.length} geração(ões) criada(s) com sucesso!`);
      qc.invalidateQueries({ queryKey: ["avatar_generations", avatarProfileId] });
      // Notify parent with first generation for status panel
      if (data[0]?.id) onGenerationCreated?.(data[0].id);
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar gerações.");
      console.error("GenerateBaseAngles error:", err);
    },
  });

  const canSubmit =
    selectedRefIds.size >= 1 &&
    selectedRefIds.size <= 3 &&
    selectedShotIds.size > 0 &&
    !mutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (mutation.isPending) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Ângulos Base</DialogTitle>
          <DialogDescription>
            Selecione até 3 referências e os ângulos desejados.
          </DialogDescription>
        </DialogHeader>

        {createdCount !== null ? (
          /* Success state */
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">
              {createdCount} geração{createdCount !== 1 ? "ões" : ""} iniciada{createdCount !== 1 ? "s" : ""}!
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Acompanhe o progresso no Histórico de Gerações abaixo.
            </p>
            <Button
              className="mt-2"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Fechar
            </Button>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="space-y-4 py-1 flex-1 overflow-hidden flex flex-col">
              {/* Reference image selection */}
              <div className="space-y-2 flex-shrink-0">
                <Label>
                  Imagens de Referência{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedRefIds.size}/3)
                  </span>
                </Label>
                <ScrollArea className="max-h-[160px] rounded-lg border border-border/50 p-2">
                  {references.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma imagem disponível.
                    </p>
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
                            }`}
                            onClick={() => toggleRef(ref.asset_id)}
                          >
                            {ref.file_url ? (
                              <img
                                src={ref.file_url}
                                alt={ref.asset_name ?? "Ref"}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted">
                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                            <div
                              className={`absolute top-1 left-1 transition-opacity ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            >
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

              {/* Shot multi-selection */}
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                <Label>
                  Ângulos / Shots{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedShotIds.size} selecionado{selectedShotIds.size !== 1 ? "s" : ""})
                  </span>
                </Label>
                <ScrollArea className="flex-1 max-h-[200px] rounded-lg border border-border/50 p-2">
                  <div className="space-y-3">
                    {SHOT_GROUPS.map((group) => {
                      const groupShots = SHOT_LIST.filter((s) => s.group === group);
                      const allSelected = groupShots.every((s) => selectedShotIds.has(s.id));
                      const someSelected = groupShots.some((s) => selectedShotIds.has(s.id));
                      return (
                        <div key={group} className="space-y-1">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => toggleGroup(group)}
                          >
                            <Checkbox
                              checked={allSelected}
                              className="h-3.5 w-3.5"
                              // indeterminate-like styling via data attribute
                              data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                              onClick={(e) => e.stopPropagation()}
                              onCheckedChange={() => toggleGroup(group)}
                            />
                            {group}
                          </button>
                          <div className="flex flex-wrap gap-1.5 pl-5">
                            {groupShots.map((shot) => {
                              const isSelected = selectedShotIds.has(shot.id);
                              return (
                                <Badge
                                  key={shot.id}
                                  variant={isSelected ? "default" : "outline"}
                                  className={`cursor-pointer text-xs transition-all ${
                                    isSelected
                                      ? ""
                                      : "hover:bg-accent hover:text-accent-foreground"
                                  }`}
                                  onClick={() => toggleShot(shot.id)}
                                >
                                  {shot.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Focus piece */}
              <div className="space-y-2 flex-shrink-0">
                <Label htmlFor="focus-piece">
                  Focus Piece{" "}
                  <span className="text-muted-foreground font-normal">(opcional)</span>
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

              {/* Error */}
              {mutation.isError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {(mutation.error as Error).message}
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
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={!canSubmit}
                className="gap-2"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {mutation.isPending
                  ? "Enviando…"
                  : `Gerar ${selectedShotIds.size || ""} Ângulo${selectedShotIds.size !== 1 ? "s" : ""}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
