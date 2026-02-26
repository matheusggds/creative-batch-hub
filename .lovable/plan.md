

## Fix: Add missing `avatarProfileId` to `create-generation` payload

### Root Cause

`GenerateBaseAnglesModal.tsx` receives `avatarProfileId` as a prop and writes it to the `generations` DB row (line 126), but the `create-generation` invoke body (lines 178-191) omits it. The edge function requires `avatarProfileId` when `sourceMode === "avatar_workspace"`.

### Fix (1 line addition)

**File**: `src/components/avatar/GenerateBaseAnglesModal.tsx`, line ~182

Add `avatarProfileId` to the body object:

```typescript
body: {
  toolType: "avatar_base_pack_generation",
  pipelineType: "multimodal_image_generation",
  sourceMode: "avatar_workspace",
  avatarProfileId,                        // ← ADD THIS
  referenceAssetIds: referenceAssetIds,
  generationId: gen.id,
  input: { ... },
},
```

### No other callers affected

- `QuickFlow.tsx` uses `sourceMode: "quick_flow"` — does not need `avatarProfileId`.
- `useBatches.ts` uses `process-generation` — unrelated.

### Verification

In browser devtools Network tab, trigger a generation from Avatar Details, inspect the `create-generation` request body and confirm `avatarProfileId` is present and matches the current avatar UUID from the URL.

### Risks

None — this is a one-field addition to an existing payload. No other flows are touched.

