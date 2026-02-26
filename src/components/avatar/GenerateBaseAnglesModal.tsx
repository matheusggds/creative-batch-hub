import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
  Copy,
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarProfileId: string;
  references: AvatarReferenceAsset[];
}

interface SuccessResult {
  generationId?: string;
  jobId?: string;
}

export function GenerateBaseAnglesModal({
  open,
  onOpenChange,
  avatarProfileId,
  references,
}: Props) {
  const [selectedRefIds, setSelectedRefIds] = useState<Set<string>>(new Set());
  const [shotId, setShotId] = useState<string>("");
  const [focusPiece, setFocusPiece] = useState("");
  const [result, setResult] = useState<SuccessResult | null>(null);

  const reset = () => {
    setSelectedRefIds(new Set());
    setShotId("");
    setFocusPiece("");
    setResult(null);
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

  const mutation = useMutation({
    mutationFn: async () => {
      const referenceAssetIds = Array.from(selectedRefIds);

      const { data, error } = await supabase.functions.invoke(
        "create-generation",
        {
          body: {
            toolType: "avatar_base_pack_generation",
            pipelineType: "multimodal_image_generation",
            sourceMode: "avatar_workspace",
            avatarProfileId,
            referenceAssetIds,
            input: {
              promptPackId: "ugc-avatar-reference-pack-v1",
              shotId,
              focusPiece: focusPiece.trim() || undefined,
              geminiPreferredModel: "gemini-3-pro-image-preview",
            },
          },
        }
      );

      if (error) throw error;
      return data as SuccessResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Geração criada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar geração.");
      console.error("GenerateBaseAngles error:", err);
    },
  });

  const canSubmit =
    selectedRefIds.size >= 1 &&
    selectedRefIds.size <= 3 &&
    shotId.length > 0 &&
    !mutation.isPending;

  const copyId = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("ID copiado!");
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
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Ângulos Base</DialogTitle>
          <DialogDescription>
            Selecione até 3 imagens de referência e um ângulo para gerar.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* Success state */
          <div className="flex flex-col items-center py-6 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg">Geração iniciada!</h3>
            <div className="space-y-2 w-full">
              {result.generationId && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Generation ID</span>
                    <p className="text-sm font-mono truncate max-w-[280px]">{result.generationId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyId(result.generationId!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {result.jobId && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Job ID</span>
                    <p className="text-sm font-mono truncate max-w-[280px]">{result.jobId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyId(result.jobId!)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
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
              <div className="space-y-2 flex-1 min-h-0 flex flex-col">
                <Label>
                  Imagens de Referência{" "}
                  <span className="text-muted-foreground font-normal">
                    ({selectedRefIds.size}/3)
                  </span>
                </Label>
                <ScrollArea className="flex-1 max-h-[200px] rounded-lg border border-border/50 p-2">
                  {references.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma imagem disponível.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
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
                                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
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

              {/* Shot selection */}
              <div className="space-y-2">
                <Label htmlFor="shot-select">Ângulo / Shot</Label>
                <Select value={shotId} onValueChange={setShotId}>
                  <SelectTrigger id="shot-select">
                    <SelectValue placeholder="Selecione um ângulo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOT_LIST.map((shot) => (
                      <SelectItem key={shot.id} value={shot.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {shot.group}
                          </Badge>
                          <span>{shot.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Focus piece */}
              <div className="space-y-2">
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
                {mutation.isPending ? "Enviando…" : "Gerar Ângulo"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
