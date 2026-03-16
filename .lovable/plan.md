

## Plan: Unify Avatar Library with Generation Timeline

### Summary
Remove the separate Generation History section. Show in-progress and failed generations as inline cards in the Avatar Library grid. Replace the raw image preview with a rich Image Detail Modal.

### Changes

#### 1. New component: `src/components/avatar/ImageDetailModal.tsx`
Rich modal for clicking any image card. Shows:
- Large image preview (or placeholder for in-progress/error for failed)
- Status badge, timestamp, shot/angle label
- Whether image is original reference or generated
- Reference images used (from `generation_reference_assets` via generation data)
- Extracted prompt / debug info (collapsible)
- Generation ID for debugging
- Actions: "Use as Reference" (future), Close

#### 2. Refactor `src/pages/AvatarDetails.tsx`
- Import and use `useAvatarGenerations` to get all generations for this avatar
- Build a unified grid: reference assets + active/failed generation placeholders
  - Completed generations already appear as references (pipeline adds to `avatar_reference_assets`)
  - Active generations (pending/processing/queued) → placeholder cards with spinner + progress
  - Failed generations (no `result_asset_id`) → error cards with inline error state
- Remove the `Collapsible` + `GenerationHistorySection` import entirely
- Remove `historyOpen` state
- Replace the raw `previewUrl` dialog with `ImageDetailModal`
- Track clicked item as `{ type: 'reference' | 'generation', ref?, generation? }` instead of just `previewUrl`
- Normal-mode click opens `ImageDetailModal` with full context

#### 3. No changes to `GenerateBaseAnglesModal.tsx`
Selection mode, preloading, and generation pipeline stay untouched.

#### 4. Keep `GenerationHistorySection.tsx` file
Just stop importing it. No deletion needed.

### Grid merge logic
```text
gridItems = [
  ...activeGenerations.map(g => ({ type: 'generation', generation: g })),
  ...avatar.references.map(r => ({ type: 'reference', ref: r, generation: matchedGen })),
  ...failedGenerations.filter(notInRefs).map(g => ({ type: 'generation', generation: g })),
]
```
Active generations appear first (top of grid). Failed without result appear at end.

Match reference → generation via: find generation where `result_asset_id === ref.asset_id` or generation `reference_asset_id === ref.asset_id`.

### `useAvatarGenerations` update
Add `result_asset_id` to the select query so we can match generations to reference assets.

### Files affected
| File | Change |
|---|---|
| `src/components/avatar/ImageDetailModal.tsx` | **New** — rich image detail view |
| `src/pages/AvatarDetails.tsx` | Merge grid, remove history section, use ImageDetailModal |
| `src/hooks/useAvatarGenerations.ts` | Add `result_asset_id` to select |

### Risks
- If pipeline doesn't add completed results to `avatar_reference_assets`, completed generations would be invisible. Mitigation: also show completed generations without matching reference as grid items.
- Polling for active generations already exists in `useAvatarGenerations` (3s interval when active). No new polling needed.

