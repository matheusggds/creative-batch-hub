import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AiParameters } from "@/types/studio";

interface AiSettingsProps {
  params: AiParameters;
  onChange: (params: AiParameters) => void;
}

export function AiSettings({ params, onChange }: AiSettingsProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="ai-settings" className="border-border/50">
        <AccordionTrigger className="text-sm font-medium hover:no-underline">
          ⚙️ Advanced AI Settings
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="style-prompt" className="text-xs">Prompt de Estilo</Label>
            <Input
              id="style-prompt"
              placeholder="e.g. professional studio lighting, clean background"
              value={params.style_prompt || ""}
              onChange={(e) => onChange({ ...params, style_prompt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="neg-prompt" className="text-xs">Negative Prompt</Label>
            <Input
              id="neg-prompt"
              placeholder="e.g. blurry, low quality, distorted"
              value={params.negative_prompt || ""}
              onChange={(e) => onChange({ ...params, negative_prompt: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Aspect Ratio</Label>
            <Select
              value={params.aspect_ratio}
              onValueChange={(v) => onChange({ ...params, aspect_ratio: v as AiParameters["aspect_ratio"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">9:16 (TikTok)</SelectItem>
                <SelectItem value="1:1">1:1 (Quadrado)</SelectItem>
                <SelectItem value="16:9">16:9 (Wide)</SelectItem>
                <SelectItem value="4:5">4:5 (Instagram)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
