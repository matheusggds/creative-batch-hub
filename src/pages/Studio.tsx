import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGenerationsRealtime } from "@/hooks/useGenerationsRealtime";
import { useCreateBatch } from "@/hooks/useBatches";
import { AssetGallery } from "@/components/studio/AssetGallery";
import { AiSettings } from "@/components/studio/AiSettings";
import { BatchResults } from "@/components/studio/BatchResults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Sparkles, Zap, LogOut } from "lucide-react";
import type { AiParameters } from "@/types/studio";

export default function Studio() {
  const { user, signOut } = useAuth();
  const createBatch = useCreateBatch();
  useGenerationsRealtime();

  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [aiParams, setAiParams] = useState<AiParameters>({
    aspect_ratio: "9:16",
    style_prompt: "",
    negative_prompt: "",
  });

  const canGenerate = selectedReferences.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    try {
      await createBatch.mutateAsync({
        baseAssetId: null,
        referenceAssetIds: selectedReferences,
        aiParameters: aiParams,
      });
      toast.success(`Lote criado com ${selectedReferences.length} variação(ões)!`);
      setSelectedReferences([]);
    } catch {
      toast.error("Erro ao criar lote.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">UGC Studio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Left Column - Setup */}
          <div className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">🖼️ Imagem de Referência</CardTitle>
              </CardHeader>
              <CardContent>
                <AssetGallery
                  type="clothing"
                  selected={selectedReferences}
                  onSelect={setSelectedReferences}
                  multiple
                  label="Selecione imagens para extrair o prompt"
                />
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="pt-4">
                <AiSettings params={aiParams} onChange={setAiParams} />
              </CardContent>
            </Card>

            <Separator />

            <Button
              size="lg"
              className="w-full gap-2 font-semibold"
              disabled={!canGenerate || createBatch.isPending}
              onClick={handleGenerate}
            >
              <Zap className="h-4 w-4" />
              {createBatch.isPending
                ? "Criando lote..."
                : `Gerar${selectedReferences.length > 0 ? ` (${selectedReferences.length})` : ""}`}
            </Button>
          </div>

          {/* Right Column - Results */}
          <div>
            <h2 className="text-lg font-semibold mb-4">📊 Resultados</h2>
            <BatchResults />
          </div>
        </div>
      </main>
    </div>
  );
}
