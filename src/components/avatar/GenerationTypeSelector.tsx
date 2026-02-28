import { Camera, Shirt, Sparkles, Images } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type GenerationType = "base_angles" | "new_look" | "outfit_variation" | "from_references";

interface TypeOption {
  id: GenerationType;
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
}

const TYPE_OPTIONS: TypeOption[] = [
  {
    id: "base_angles",
    label: "Ângulos Base",
    description: "Gere poses e ângulos padronizados do avatar para consistência visual.",
    icon: <Camera className="h-5 w-5" />,
    available: true,
  },
  {
    id: "new_look",
    label: "Novo Look",
    description: "Crie uma nova aparência ou estilo visual para o avatar.",
    icon: <Sparkles className="h-5 w-5" />,
    available: false,
  },
  {
    id: "outfit_variation",
    label: "Variação de Roupa",
    description: "Gere o avatar com uma peça ou combinação de roupa diferente.",
    icon: <Shirt className="h-5 w-5" />,
    available: false,
  },
  {
    id: "from_references",
    label: "A partir de Referências",
    description: "Use imagens selecionadas da biblioteca como base para novas gerações.",
    icon: <Images className="h-5 w-5" />,
    available: false,
  },
];

interface GenerationTypeSelectorProps {
  selected: GenerationType | null;
  onSelect: (type: GenerationType) => void;
}

export function GenerationTypeSelector({ selected, onSelect }: GenerationTypeSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {TYPE_OPTIONS.map((opt) => {
        const isSelected = selected === opt.id;
        const isDisabled = !opt.available;

        return (
          <button
            key={opt.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onSelect(opt.id)}
            className={`relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : isDisabled
                ? "border-border/30 opacity-50 cursor-not-allowed"
                : "border-border/50 hover:border-primary/40 hover:bg-accent/30 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-2 w-full">
              <div className={`rounded-md p-1.5 ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                {opt.icon}
              </div>
              <span className="font-medium text-sm flex-1">{opt.label}</span>
              {isDisabled && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                  Em breve
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}
