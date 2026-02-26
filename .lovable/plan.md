

## Plan: Eliminate Legacy Direct-Processing for Avatar Generation

### Status: ✅ IMPLEMENTED

### Changes Made

#### 1. `src/components/avatar/GenerateBaseAnglesModal.tsx`
- Switched from `process-generation` to `create-generation` edge function
- Passes full payload: `toolType`, `pipelineType`, `sourceMode`, `referenceAssetIds`, `generationId`, and `input` object
- Added `pipeline: "create-generation"` to `_debug` marker in `ai_parameters`

#### 2. `supabase/functions/process-generation/index.ts`
- Added guardrail: rejects any generation with `pipeline_type === "multimodal_image_generation"`
- Prevents accidental future use of the legacy path for avatar/multimodal flows

### Remaining Risks
- `create-generation` is deployed but not in repo — contract assumed from QuickFlow.tsx usage
- Studio batch flow (`useBatches.ts`) still uses `process-generation` (out of scope, uses `text_to_image`)
