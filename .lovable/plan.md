

## Debugging Plan: Generation Prompt/Reference Observability

### Root Cause Analysis

After inspecting the full pipeline, I found **two critical bugs** that explain why outputs don't match selections:

1. **The Edge Function ignores `ai_parameters.shotId`** entirely. The `process-generation/index.ts` never reads `shotId`, `focusPiece`, or `promptPackId` from `ai_parameters`. It sends a generic prompt `"Me gere o prompt dessa imagem."` to OpenAI regardless of the selected angle. The shot selection on the frontend has zero effect on the backend.

2. **The Edge Function uses an old code path** (`gpt-4o` + `gemini-2.0-flash-exp`) while the logs show `gpt-5.2` + `gemini-3-pro-image-preview`. This means **there is a newer deployed version** of the edge function that differs from the code in the repository. The repo code is stale.

3. **System prompt is a placeholder**: `UGC_SYSTEM_PROMPT = "COLE_O_PROMPT_GIGANTE_AQUI"` — a literal placeholder string.

4. **The Edge Function requires both `base_asset_id` AND `reference_asset_id`** (line 53: throws if either URL is missing), but the frontend sets `base_asset_id` to `null` for avatar workspace generations. This means the function should be failing for all avatar-generated requests unless the deployed version differs.

### Debugging Plan (Observability First)

Rather than fixing the prompt pipeline now, the plan focuses on making the full request/response chain visible.

---

### Step 1: Persist a debug snapshot on generation creation (Frontend)

**File**: `src/components/avatar/GenerateBaseAnglesModal.tsx`

Save the complete frontend intent into `ai_parameters` so it's always queryable:

```typescript
ai_parameters: {
  // existing fields...
  _debug: {
    selectedRefAssetIds: referenceAssetIds,
    selectedShotId: shotId,
    shotLabel: SHOT_LIST.find(s => s.id === shotId)?.label,
    focusPiece: focusPiece.trim() || null,
    refCount: referenceAssetIds.length,
    submittedAt: new Date().toISOString(),
  }
}
```

No schema change needed — `ai_parameters` is JSONB.

---

### Step 2: Sync the Edge Function code from deployed version

**File**: `supabase/functions/process-generation/index.ts`

The repo code is stale. We need to either:
- **(a)** Pull the actual deployed code (which uses `gpt-5.2` and `gemini-3-pro-image-preview` per logs), or
- **(b)** Accept the repo code as source of truth and redeploy.

**Recommendation**: Ask the user which version is authoritative. The deployed function is clearly different from the repo.

---

### Step 3: Add a debug detail panel to GenerationDetailModal

**File**: `src/components/studio/GenerationDetailModal.tsx`

Add a collapsible "Debug Info" section showing:
- `ai_parameters.shotId` and `ai_parameters._debug.shotLabel` — what angle the user selected
- `ai_parameters._debug.selectedRefAssetIds` — which references were chosen
- `ai_parameters.extracted_positive_prompt` — the prompt sent to Gemini
- `ai_parameters.openai_raw_response` — full OpenAI output
- `ai_parameters.geminiPreferredModel` — requested model
- Generation `reference_asset_id` — what the backend actually used
- Mismatch indicator: compare `_debug.selectedRefAssetIds[0]` vs `reference_asset_id`

Also used in Avatar Details via the Generation History "Ver detalhes" button.

---

### Step 4: Surface debug info in GenerationHistorySection

**File**: `src/components/avatar/GenerationHistorySection.tsx`

Add the shot label as a small tag on each generation row (read from `ai_parameters.shotId` → lookup in SHOT_LIST).

---

### Affected Files

| File | Change |
|---|---|
| `src/components/avatar/GenerateBaseAnglesModal.tsx` | Add `_debug` snapshot to `ai_parameters` |
| `src/components/studio/GenerationDetailModal.tsx` | Add collapsible debug section showing full request chain |
| `src/components/avatar/GenerationHistorySection.tsx` | Show shot label tag per row |
| `supabase/functions/process-generation/index.ts` | **Needs sync** — repo code is stale vs deployed |

### No Schema Changes

All debug data fits in existing `ai_parameters` JSONB column.

### Risks

| Risk | Level |
|---|---|
| `_debug` field slightly increases row size | Low — negligible |
| Edge function repo/deployed mismatch | **High** — must resolve before any EF edits |
| Detail modal used from both Studio and Avatar Details contexts | Medium — need to ensure it works with both data shapes |

### Implementation Order

1. Add `_debug` snapshot to `GenerateBaseAnglesModal` (frontend-only, safe)
2. Add debug section to `GenerationDetailModal` (frontend-only, safe)
3. Add shot label to `GenerationHistorySection` rows (frontend-only, safe)
4. **Separately**: resolve Edge Function repo vs deployed discrepancy with user

### Critical Question for User

The deployed `process-generation` function uses `gpt-5.2` and `gemini-3-pro-image-preview`, but the repo code uses `gpt-4o` and `gemini-2.0-flash-exp`. **Which version is the source of truth?** We should not edit the Edge Function until this is resolved.

