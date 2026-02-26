

## Plan: Multi-Angle Generation from Avatar Details

### Architecture Validation

| Requirement | Supported? | Notes |
|---|---|---|
| Multiple reference assets per generation | Yes | `generation_reference_assets` table exists with `generation_id`, `asset_id`, `role`, `sort_order` |
| Multiple generations from one submit | Yes | Create N generation records (one per shot), each linked to the same reference set |
| References from both uploaded and library images | Yes | Both are `assets` rows; Avatar Library images already have `asset_id` via `avatar_reference_assets` |
| Reuse library assets without duplication | Yes | `generation_reference_assets` links to existing `asset_id`s |
| Generation history consistency | Yes | Each generation has `avatar_profile_id`; history hook already queries by it |

**Critical finding**: The `create-generation` edge function invoked in `GenerateBaseAnglesModal` does **not exist** in `supabase/functions/`. Only `process-generation` exists. This means the current "Gerar Ângulos Base" flow is already broken. The plan must account for this.

### No Schema Changes Required

The existing tables (`generations`, `generation_reference_assets`, `generation_jobs`, `generation_events`) already support the multi-ref, multi-generation pattern.

---

### Recommended UX Flow

1. User clicks **"Gerar Ângulos Base"** (or renamed "Adicionar Novos Ângulos").
2. **Step 1 — Select References**: Grid of Avatar Library images with multi-select (up to 3). Optional: upload new image inline (goes to `assets` + `avatar_reference_assets`).
3. **Step 2 — Select Shots**: Multi-select from the `SHOT_LIST`. Each selected shot = 1 generation to be created.
4. **Step 3 — Optional focus piece** input (shared across all generations).
5. **Submit**: Creates N generation records (one per selected shot), each linked to the same set of reference `asset_id`s via `generation_reference_assets`. Invokes the edge function for each.
6. **Success state**: Shows count of generations created, closes modal, activates polling in history.

### Backend Pattern

On submit, the frontend will:
1. Create N `generations` rows (one per shot) with `avatar_profile_id`, `status: 'pending'`
2. For each generation, insert rows into `generation_reference_assets` linking the selected `asset_id`s
3. Fire-and-forget `process-generation` for each generation ID

This mirrors the existing `useCreateBatch` pattern in `useBatches.ts` — no new edge function needed.

**Note**: `process-generation` currently only reads `base_asset_id` and `reference_asset_id` from the generation row (single ref). It does NOT read from `generation_reference_assets`. Since the constraint is "do not modify existing Edge Functions", the plan will set `reference_asset_id` to the first selected reference for backward compatibility, and populate `generation_reference_assets` for future use.

---

### Affected Files

| File | Change |
|---|---|
| `src/components/avatar/GenerateBaseAnglesModal.tsx` | Refactor: multi-shot selection, submit loop creating N generations, inline upload option |
| `src/pages/AvatarDetails.tsx` | Minor: pass uploaded-image callback to modal, ensure history refreshes after batch submit |
| `src/hooks/useAvatarGenerations.ts` | No change needed — already polls by `avatar_profile_id` |

### Frontend State Implications

- `selectedRefIds: Set<string>` — already exists, no change
- `selectedShotIds: Set<string>` — **new**, replaces single `shotId` string
- On submit success: invalidate `avatar_generations` query key, set multiple `activeGenerationId`s or rely on history polling
- Optional: track `submittingCount` for progress feedback

### Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `process-generation` only reads single `reference_asset_id` | Set it to first selected ref; populate `generation_reference_assets` for future edge function updates |
| N parallel edge function calls could timeout/fail | Fire-and-forget pattern already used in `useCreateBatch`; individual failures don't block others |
| `create-generation` edge function doesn't exist | Stop using it; create generations client-side + invoke `process-generation` directly (matches `useCreateBatch` pattern) |

### Implementation Order

1. Refactor `GenerateBaseAnglesModal.tsx`: multi-shot selection UI + new submit logic (create generations client-side, invoke `process-generation`)
2. Update `AvatarDetails.tsx`: ensure query invalidation on generation created
3. Test end-to-end

### Knowledge Updates

Add to project knowledge:
- "Gerar Ângulos Base" creates generation records client-side and invokes `process-generation` per generation. There is no `create-generation` edge function.
- `generation_reference_assets` should be populated for all generations even though `process-generation` currently only reads `reference_asset_id`. This prepares for future edge function updates.
- Each shot/angle = 1 generation record. Multiple angles in one flow = multiple generation records sharing the same reference set.
