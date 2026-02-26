

## Plan: Eliminate Legacy Direct-Processing for Avatar Generation

### Current State

There are **3 callers** of generation edge functions:

| Caller | Edge Function | Pipeline | Creates Jobs/Events? |
|---|---|---|---|
| `GenerateBaseAnglesModal.tsx` (Avatar) | `process-generation` | Legacy direct | **No** — this is the bug |
| `useBatches.ts` (Studio) | `process-generation` | Legacy direct | **No** |
| `QuickFlow.tsx` | `create-generation` | Queued job-based | **Yes** |

**Root cause confirmed**: `GenerateBaseAnglesModal` calls `process-generation`, which directly calls OpenAI+Gemini and updates the generation record — bypassing `generation_jobs` and `generation_events` entirely. The `create-generation` edge function exists deployed but is **not in the repo**.

### Changes Required

#### 1. Switch Avatar flow to `create-generation` (Frontend)

**File**: `src/components/avatar/GenerateBaseAnglesModal.tsx`

Replace `supabase.functions.invoke("process-generation", ...)` with `supabase.functions.invoke("create-generation", ...)`, passing the same payload shape that `QuickFlow.tsx` uses:

```typescript
supabase.functions.invoke("create-generation", {
  body: {
    toolType: "avatar_base_pack_generation",
    pipelineType: "multimodal_image_generation",
    sourceMode: "avatar_workspace",
    referenceAssetIds: referenceAssetIds,
    generationId: gen.id,  // pass the pre-created generation ID
    input: {
      shotId,
      focusPiece: focusPiece.trim() || undefined,
      geminiPreferredModel: "gemini-3-pro-image-preview",
      promptPackId: "ugc-avatar-reference-pack-v1",
    },
  },
})
```

#### 2. Add `_debug.pipeline` marker to generation records

**File**: `src/components/avatar/GenerateBaseAnglesModal.tsx`

Add `pipeline: "create-generation"` to the `_debug` object in `ai_parameters` so every generation self-documents which pipeline handled it.

#### 3. Add guardrail to `process-generation` (Edge Function)

**File**: `supabase/functions/process-generation/index.ts`

At the top of the handler, after fetching the generation record, add:

```typescript
if (gen.pipeline_type === "multimodal_image_generation") {
  throw new Error("multimodal_image_generation must use create-generation pipeline");
}
```

This prevents accidental future use of the legacy path for avatar/multimodal flows.

### Affected Files

| File | Change |
|---|---|
| `src/components/avatar/GenerateBaseAnglesModal.tsx` | Switch from `process-generation` to `create-generation`; add pipeline debug marker |
| `supabase/functions/process-generation/index.ts` | Add guardrail rejecting `multimodal_image_generation` |

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `create-generation` is deployed but not in repo — we can't verify its contract | Use the same payload shape as `QuickFlow.tsx` which already works |
| Studio batch flow (`useBatches.ts`) also uses `process-generation` | Out of scope — Studio uses `text_to_image` pipeline, not affected by the guardrail |
| Pre-created generation IDs may conflict with `create-generation`'s own insert logic | Pass `generationId` so the edge function can adopt the existing record instead of creating a new one; if unsupported, remove client-side insert and let the edge function create the record |

### Implementation Order

1. Add guardrail to `process-generation` edge function
2. Switch `GenerateBaseAnglesModal` to call `create-generation`
3. Add `pipeline` debug marker
4. Test end-to-end: verify new generations have `generation_jobs` and `generation_events` rows

