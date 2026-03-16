

## Refactor Quick Flow Post-Generation Actions

### Problem Analysis

1. **Batch response parsing is broken**: Backend returns `{ generations: [{ generationId, ... }] }` but code expects `data.generationIds`. This is why batch fails silently.
2. **Two separate buttons** ("Gerar outra variação" + "Gerar 5 variações") should be unified into quantity selector + single button.
3. **Internal step names leak** into the UI (e.g., `generate_image`, `extract_prompt` shown in progress text).
4. **Raw error messages** from Edge Functions shown to user.

### Changes (single file: `src/pages/QuickFlow.tsx`)

**1. Fix batch response parsing**

The `onSuccess` handler currently looks for `data.generationIds` which doesn't exist. The actual backend response for batch is:
```json
{
  "generations": [{ "generationId": "...", ... }, ...]
}
```

Fix: extract IDs from `data.generations?.map(g => g.generationId)`.

**2. Replace two buttons with quantity selector + single "Gerar Variações" button**

- Add `selectedCount` state (default: 1)
- Render 5 numbered buttons `[1] [2] [3] [4] [5]` as a toggle group
- Single "Gerar Variações" button uses `selectedCount`
- Both the selector and button only appear after first completed generation
- Button disabled while `pendingCount > 0`

**3. Unified generate handler**

Replace `handleRegenerate` + `handleGenerateBatch` with single `handleGenerateVariations` that reads `selectedCount` and calls mutation with `{ reuseFromId: activeVar.generationId, variationCount: selectedCount }`.

**4. Hide internal step names**

Remove `currentStepLabel` from progress display. Show only percentage + "Gerando variação..." text.

**5. Humanize error messages**

In `onError` of `generateMutation`, sanitize the error message — if it contains "non-2xx" or technical terms, replace with "Não foi possível iniciar a geração. Tente novamente."

**6. Button order (post-generation)**

```text
(thumbnails if > 1)
[1] [2] [3] [4] [5]   ← quantity selector
[Gerar Variações]      ← disabled while pending
[Criar novo avatar]    ← primary/purple
[Baixar imagem]
Recomeçar              ← ghost/link
```

### Visual: Quantity Selector

Five 36px square buttons in a row, the selected one gets `bg-primary text-primary-foreground`, others get `border border-input bg-background`. Simple, no external component needed.

### Files changed
- `src/pages/QuickFlow.tsx`

### What gets validated at runtime
- Batch response parsing with real `generations[]` array
- `variationCount` parameter reaching backend correctly for values 1-5
- Individual variation tracking completing for each batch item

