import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";

export const SHOT_LIST = [
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

interface ShotPickerProps {
  selectedShotIds: Set<string>;
  onToggleShot: (shotId: string) => void;
  onToggleGroup: (group: string) => void;
  disabled?: boolean;
  disabledShotIds?: Set<string>;
}

export function ShotPicker({ selectedShotIds, onToggleShot, onToggleGroup, disabled, disabledShotIds }: ShotPickerProps) {
  const selectableCount = SHOT_LIST.filter((s) => !disabledShotIds?.has(s.id)).length;
  const selectedCount = Array.from(selectedShotIds).filter((id) => !disabledShotIds?.has(id)).length;

  return (
    <div className="space-y-2 flex-1 min-h-0 flex flex-col">
      <Label>
        Ângulos / Shots{" "}
        <span className="text-muted-foreground font-normal">
          ({selectedCount} selecionado{selectedCount !== 1 ? "s" : ""}
          {disabledShotIds && disabledShotIds.size > 0 && ` · ${disabledShotIds.size} já gerado${disabledShotIds.size !== 1 ? "s" : ""}`})
        </span>
      </Label>
      <ScrollArea className="flex-1 max-h-[220px] rounded-lg border border-border/50 p-2">
        <div className="space-y-3">
          {SHOT_GROUPS.map((group) => {
            const groupShots = SHOT_LIST.filter((s) => s.group === group);
            const enabledGroupShots = groupShots.filter((s) => !disabledShotIds?.has(s.id));
            const allGroupDisabled = enabledGroupShots.length === 0;
            const allSelected = enabledGroupShots.length > 0 && enabledGroupShots.every((s) => selectedShotIds.has(s.id));
            const someSelected = enabledGroupShots.some((s) => selectedShotIds.has(s.id));

            return (
              <div key={group} className="space-y-1">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  onClick={() => !allGroupDisabled && onToggleGroup(group)}
                  disabled={disabled || allGroupDisabled}
                >
                  <Checkbox
                    checked={allSelected}
                    className="h-3.5 w-3.5"
                    data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => !allGroupDisabled && onToggleGroup(group)}
                    disabled={disabled || allGroupDisabled}
                  />
                  {group}
                </button>

                {allGroupDisabled && (
                  <p className="text-[10px] text-muted-foreground pl-5 italic">
                    Todos os ângulos desta categoria já foram gerados
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5 pl-5">
                  {groupShots.map((shot) => {
                    const isDisabled = disabledShotIds?.has(shot.id);
                    const isSelected = selectedShotIds.has(shot.id);
                    return (
                      <Badge
                        key={shot.id}
                        variant={isDisabled ? "outline" : isSelected ? "default" : "outline"}
                        className={`text-xs transition-all ${
                          isDisabled
                            ? "opacity-50 cursor-not-allowed"
                            : isSelected
                            ? "cursor-pointer"
                            : "cursor-pointer hover:bg-accent hover:text-accent-foreground"
                        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
                        onClick={() => !disabled && !isDisabled && onToggleShot(shot.id)}
                      >
                        {isDisabled && <Check className="h-3 w-3 mr-1 text-muted-foreground" />}
                        {shot.label}
                        {isDisabled && <span className="ml-1 text-[9px] text-muted-foreground">Já gerado</span>}
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
  );
}

/** Helper: toggle a single shot in a Set (immutable) */
export function toggleShotInSet(prev: Set<string>, shotId: string): Set<string> {
  const next = new Set(prev);
  if (next.has(shotId)) next.delete(shotId);
  else next.add(shotId);
  return next;
}

/** Helper: toggle all shots of a group (immutable), skipping disabled shots */
export function toggleGroupInSet(prev: Set<string>, group: string, disabledShotIds?: Set<string>): Set<string> {
  const groupShots = SHOT_LIST.filter((s) => s.group === group).map((s) => s.id);
  const enabledGroupShots = groupShots.filter((id) => !disabledShotIds?.has(id));
  const allSelected = enabledGroupShots.every((id) => prev.has(id));
  const next = new Set(prev);
  enabledGroupShots.forEach((id) => {
    if (allSelected) next.delete(id);
    else next.add(id);
  });
  return next;
}
