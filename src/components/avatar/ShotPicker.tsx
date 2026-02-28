import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

export function ShotPicker({ selectedShotIds, onToggleShot, onToggleGroup, disabled }: ShotPickerProps) {
  return (
    <div className="space-y-2 flex-1 min-h-0 flex flex-col">
      <Label>
        Ângulos / Shots{" "}
        <span className="text-muted-foreground font-normal">
          ({selectedShotIds.size} selecionado{selectedShotIds.size !== 1 ? "s" : ""})
        </span>
      </Label>
      <ScrollArea className="flex-1 max-h-[220px] rounded-lg border border-border/50 p-2">
        <div className="space-y-3">
          {SHOT_GROUPS.map((group) => {
            const groupShots = SHOT_LIST.filter((s) => s.group === group);
            const allSelected = groupShots.every((s) => selectedShotIds.has(s.id));
            const someSelected = groupShots.some((s) => selectedShotIds.has(s.id));
            return (
              <div key={group} className="space-y-1">
                <button
                  type="button"
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  onClick={() => onToggleGroup(group)}
                  disabled={disabled}
                >
                  <Checkbox
                    checked={allSelected}
                    className="h-3.5 w-3.5"
                    data-state={someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onToggleGroup(group)}
                    disabled={disabled}
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
                          isSelected ? "" : "hover:bg-accent hover:text-accent-foreground"
                        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
                        onClick={() => !disabled && onToggleShot(shot.id)}
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
  );
}

/** Helper: toggle a single shot in a Set (immutable) */
export function toggleShotInSet(prev: Set<string>, shotId: string): Set<string> {
  const next = new Set(prev);
  if (next.has(shotId)) next.delete(shotId);
  else next.add(shotId);
  return next;
}

/** Helper: toggle all shots of a group (immutable) */
export function toggleGroupInSet(prev: Set<string>, group: string): Set<string> {
  const groupShots = SHOT_LIST.filter((s) => s.group === group).map((s) => s.id);
  const allSelected = groupShots.every((id) => prev.has(id));
  const next = new Set(prev);
  groupShots.forEach((id) => {
    if (allSelected) next.delete(id);
    else next.add(id);
  });
  return next;
}
