

## Plan: Avatar Details UX Refactor

### Problem Summary
1. Page-level selection (`selectedIds`) uses `ref.id` (reference row ID) but modal selection uses `ref.asset_id` — different ID spaces, no bridge
2. "Criar Novo Look" is a dead button (no handler). "Adicionar Imagem" has no handler either
3. Opening "Gerar Ângulos Base" ignores page-level selections — user must re-select
4. `GenerationStatusPanel` and `GenerationHistorySection` visually compete and show overlapping data

### Proposed New Page Hierarchy

```text
┌─────────────────────────────────────────────┐
│ AppHeader (nav)                              │
├─────────────────────────────────────────────┤
│ Avatar Hero: cover + name + status           │
│ Primary CTA: [Gerar Ângulos Base]            │
│   (shows selected count if any)              │
├─────────────────────────────────────────────┤
│ Biblioteca do Avatar                         │
│   Select All / N selecionadas                │
│   Image grid with checkboxes                 │
├─────────────────────────────────────────────┤
│ ▸ Histórico de Gerações (collapsible)        │
│   Compact timeline log                       │
└─────────────────────────────────────────────┘
```

### Actions: Keep, Remove, Redesign

| Action | Decision | Reason |
|---|---|---|
| **Gerar Ângulos Base** | **Keep as primary CTA** | Core flow |
| **Adicionar Imagem** | **Remove** | No handler, not strategic — images come from generations or upload flow elsewhere |
| **Criar Novo Look** | **Remove** | Dead button, no implementation |
| **GenerationStatusPanel** (inline) | **Remove** | Redundant — GenerationHistorySection already shows active jobs with progress |

### Selection State: Bridge Page → Modal

**Key change**: The modal currently receives `references` (the full list) and manages its own `selectedRefIds` starting empty. Instead:

1. **AvatarDetails** passes `preselectedAssetIds` (derived from page `selectedIds` mapped to `asset_id`) to the modal
2. **GenerateBaseAnglesModal** initializes `selectedRefIds` from `preselectedAssetIds` on open (not on mount — on each open)
3. Modal still allows adjusting selections (add/remove up to 3)
4. Page selection uses `asset_id` instead of `ref.id` to align with modal's ID space

### Exact Changes

#### 1. `src/pages/AvatarDetails.tsx`
- Change `selectedIds` to track `asset_id` instead of `ref.id`
- Remove "Adicionar Imagem" button (both in action bar and empty state)
- Remove "Criar Novo Look" button
- Remove `GenerationStatusPanel` and `activeGenerationId` state
- Make "Gerar Ângulos Base" the primary button (not outline), show selected count
- Pass `preselectedAssetIds={Array.from(selectedIds)}` to modal
- Wrap `GenerationHistorySection` in a `Collapsible` (from radix)
- Update `toggleSelect` and `selectAll` to use `ref.asset_id`

#### 2. `src/components/avatar/GenerateBaseAnglesModal.tsx`
- Add `preselectedAssetIds?: string[]` prop
- On dialog open, initialize `selectedRefIds` from `preselectedAssetIds` (use `useEffect` keyed on `open`)
- No other logic changes needed

#### 3. Remove or keep `GenerationStatusPanel.tsx`
- Stop importing it in AvatarDetails. File can remain for now (no deletion needed).

### State Management Implications
- No new hooks or stores needed
- Selection state stays local in `AvatarDetails` (useState)
- The only new data flow is `selectedIds → preselectedAssetIds` prop to modal
- All query keys and cache invalidation unchanged

### Implementation Order
1. Clean up AvatarDetails: remove dead buttons, remove GenerationStatusPanel, switch selection to `asset_id`
2. Add `preselectedAssetIds` prop to GenerateBaseAnglesModal + sync on open
3. Make GenerationHistory collapsible
4. Promote "Gerar Ângulos Base" to primary CTA with selection count

### Risks
| Risk | Mitigation |
|---|---|
| Changing selection from `ref.id` to `asset_id` could break if duplicates exist | `avatar_reference_assets` has unique `(avatar_profile_id, asset_id)` — safe |
| Removing GenerationStatusPanel loses real-time status for just-created generation | GenerationHistorySection already shows active jobs with progress bars and auto-polls |
| Collapsible history hides important info | Default to expanded; only collapses on user action |

### How to Verify
1. Select 2 images in the library grid → open "Gerar Ângulos Base" → confirm those 2 are pre-checked in the modal
2. Open modal with no selection → confirm all references are unchecked, user can pick manually
3. Confirm "Adicionar Imagem" and "Criar Novo Look" are gone
4. Trigger a generation → confirm progress appears in the history section
5. Confirm history section collapses/expands

