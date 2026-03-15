

## Session Variations History for Quick Flow

### What changes

**Single file**: `src/pages/QuickFlow.tsx`

### Data model (in-memory only)

A `sessionVariations` array of `{ resultUrl, resultAssetId, generationId }` stored in React state. A `selectedIndex` tracks which variation is active. No persistence — cleared on reset/swap.

### UI addition

Below the main result image on the right column, a horizontal strip of thumbnails appears when `sessionVariations.length > 1`. Each thumbnail is a small clickable image (48×48) with a ring highlight on the selected one. Minimal footprint — no carousel, no pagination, just a `flex gap-2 overflow-x-auto` row.

### State flow

1. **On generation completed**: push `{ resultUrl, resultAssetId, generationId }` into `sessionVariations`, set `selectedIndex` to last item
2. **On thumbnail click**: update `selectedIndex` — this updates `snapshotResultUrl`, `snapshotResultAssetId`, `snapshotGenerationId` to match the selected variation
3. **"Gerar outra variação"**: reuses prompt from `selectedVariation.generationId` (any completed generation works as source), new result appends to array
4. **"Criar novo avatar"**: uses `selectedVariation.resultAssetId` as cover
5. **"Baixar imagem"**: downloads `selectedVariation.resultUrl`
6. **`resetAll` / `handleFileChange`**: clears `sessionVariations` and `selectedIndex`

### Concrete changes

- Add `sessionVariations` state (`Array<{ resultUrl: string; resultAssetId: string; generationId: string }>`) and `selectedVarIndex` state (`number`)
- On completed transition (line ~92-100): push to array, set index to new last element, set snapshots from that element
- On thumbnail click: update index + snapshots
- `handleRegenerate`: read `generationId` from `sessionVariations[selectedVarIndex]` instead of `snapshotGenerationId`
- `createAvatarMutation`: read `resultAssetId` from `sessionVariations[selectedVarIndex]`
- `handleDownload`: read `resultUrl` from `sessionVariations[selectedVarIndex]`
- `resetAll` / `handleFileChange`: clear array + index
- Remove standalone `snapshotResultUrl`, `snapshotResultAssetId`, `snapshotGenerationId` — replaced by the array + index
- Keep `snapshotRetryCount` as-is (display-only during tracking)
- Render thumbnail strip between result image and CTAs when `sessionVariations.length > 1`

### Thumbnail strip UI

```text
┌─────────────────────────────────┐
│  [result image - active var]    │
├─────────────────────────────────┤
│  [■] [■] [■]  ← 48px thumbs    │
├─────────────────────────────────┤
│  [Criar avatar]                 │
│  [Gerar outra variação]         │
│  [Baixar imagem]                │
│  [Recomeçar]                    │
└─────────────────────────────────┘
```

### What gets cleared

| Action | Clears variations? |
|---|---|
| Trocar imagem | Yes |
| Recomeçar | Yes |
| Gerar outra variação | No (appends) |
| Thumbnail click | No (selects) |

### Files changed
- `src/pages/QuickFlow.tsx`

### What depends on backend
Nothing — purely frontend session state.

