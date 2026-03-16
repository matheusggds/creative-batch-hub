

## Quick Flow Layout Redesign

### Overview
Restructure the two-column layout to emphasize the variation image, add a lightbox for zoom, clean up action hierarchy, and adjust history card sizing.

### Changes

#### 1. Asymmetric columns (35/65 split)
Change the grid from `grid-cols-2` to a custom split. At `md` breakpoint use `md:grid-cols-[35fr_65fr]` (or `md:grid-cols-[2fr_3fr]` which is close enough). Below `md`, stack as single column.

#### 2. Reference column — minimal
- Remove the `maxHeight: 400px` constraint. Let image fill column width naturally with `object-contain` and `aspect-ratio: 9/16`.
- Only contents: image + "Trocar imagem" button. No other actions.

#### 3. Variation column — hero image larger
- Remove `maxHeight: 400px`. Let image use full column width with `object-contain` and `aspect-ratio: 9/16`. The 65% column is wider so the image will naturally be bigger.
- Make the image clickable — wrap in a `<button>` with `cursor-zoom-in`. Clicking opens a lightbox.

#### 4. Lightbox component
Add a simple lightbox using the existing `Dialog` component:
- Full-screen dark overlay (`DialogContent` with `max-w-[90vw] max-h-[90vh]` and transparent/minimal chrome)
- Image displayed with `object-contain` filling the modal
- Close on click outside or X button
- No actions inside — purely for viewing
- Reuse for both reference and variation images (pass URL + alt to state)

#### 5. Variation thumbnails
- Keep existing `VariationThumbnailStrip` but bump size from `h-10 w-10` (40px) to `h-12 w-[34px]` (~34x48 respecting 9:16 ratio). Or simpler: `h-14 w-10` (40x56).
- Hide strip when only 1 variation (already done).

#### 6. Actions — clear hierarchy

```text
[1][2][3][4][5]  [✨ Gerar Variações]     ← inline row, as today
[🎭 Criar avatar]  [⬇ Baixar]             ← two buttons side by side
              Recomeçar                     ← text link, no button chrome
```

- "Criar avatar" + "Baixar" in a `flex gap-2` row, both `flex-1`. Criar = default/primary. Baixar = outline.
- "Recomeçar" becomes a plain text button: `variant="link"` with `text-xs text-muted-foreground`, centered. Remove the icon.

#### 7. History cards — slightly smaller
- Reduce `paddingBottom` from `177.78%` to ~`142%` (keeping 9:16-ish but in a smaller container)
- Or keep ratio but constrain card max-width. Simpler: change grid to `lg:grid-cols-10` to make cards narrower.
- Increase infinite scroll rootMargin to `300px`.

### Files changed
- `src/pages/QuickFlow.tsx` — layout grid, lightbox state, image click handlers, action restructure, thumbnail sizing
- `src/components/quick-flow/QuickFlowHistory.tsx` — rootMargin to 300px

### Implementation details

**Lightbox state** in QuickFlow:
```typescript
const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
```

**Lightbox JSX** — simple Dialog:
```tsx
<Dialog open={!!lightboxUrl} onOpenChange={(v) => !v && setLightboxUrl(null)}>
  <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none">
    <img src={lightboxUrl} className="w-full h-full object-contain" />
  </DialogContent>
</Dialog>
```

**Action rows** (completed state):
```tsx
{/* Row 1: quantity + generate */}
<div className="flex items-center gap-1.5">...</div>
{/* Row 2: create + download side by side */}
<div className="flex gap-2">
  <Button className="flex-1" onClick={...}>Criar avatar</Button>
  <Button variant="outline" className="flex-1" onClick={...}>Baixar</Button>
</div>
{/* Row 3: reset link */}
<button className="text-xs text-muted-foreground hover:underline mx-auto block" onClick={resetAll}>
  Recomeçar
</button>
```

