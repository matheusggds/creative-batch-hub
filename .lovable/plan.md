

## Plan: Delete Images/Avatars, Block Generated Shots, Fix Typos

### 1. Database: Add DELETE policy on `assets` table

Currently `assets` has no DELETE RLS policy. Add one so users can delete their own assets.

```sql
CREATE POLICY "Users can delete own assets" ON public.assets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### 2. Delete individual images from Avatar Library

**File: `src/pages/AvatarDetails.tsx`**

- Add a `Trash2` icon button on hover (top-left) of each `ReferenceCard`
- On click, show an `AlertDialog` confirmation: "Tem certeza que deseja excluir esta imagem?"
- On confirm, delete the `avatar_reference_assets` record, then delete the `assets` record
- Invalidate `avatar_profile` and `avatar_generations` queries to refresh counts and grid
- Use a mutation hook inline or a shared delete function

### 3. Delete avatar from list and detail page

**File: `src/components/avatar/AvatarProfileCard.tsx`**
- Add a `Trash2` icon on hover (top-right, beside the status badge)
- On click, stop propagation, show `AlertDialog` confirmation
- On confirm, delete from `avatar_profiles` (cascade handles `avatar_reference_assets`)
- Invalidate `avatar_profiles` query

**File: `src/pages/AvatarDetails.tsx`**
- Add a destructive "Excluir avatar" button in the hero section (beside "Nova Geração")
- On confirm, delete + navigate to `/avatars`

### 4. Block already-generated shots in NewGenerationModal

**File: `src/components/avatar/NewGenerationModal.tsx`**
- Accept a new prop: `completedShotIds: Set<string>` (computed in AvatarDetails from `generations` with status `completed`)
- Pass it down to `ShotPicker`

**File: `src/components/avatar/ShotPicker.tsx`**
- Accept optional `disabledShotIds?: Set<string>` prop
- Shots in `disabledShotIds` render with reduced opacity, `cursor-not-allowed`, a `✓ Já gerado` indicator
- `onToggleShot` ignores disabled shots
- Group checkbox logic accounts for disabled shots
- If all shots in a group are disabled, show "Todos os ângulos já foram gerados"

**File: `src/pages/AvatarDetails.tsx`**
- Compute `completedShotIds` from `generations` data by extracting `shotId` from `ai_parameters._debug.selectedShotId` or `ai_parameters.shotId` for completed generations
- Pass to `NewGenerationModal`

### 5. Fix typo: "imagemens" → "imagens"

**File: `src/pages/AvatarDetails.tsx` line 201**
- Change `imagem{refCount !== 1 ? "ens" : ""}` → `imagem{refCount !== 1 ? "ns" : ""}`

Also check `NewGenerationModal.tsx` line 415: `imagem{referenceCount !== 1 ? "ns" : ""}` — this one is correct.

### 6. Fix `generate_image` showing in avatar library placeholder

**File: `src/pages/AvatarDetails.tsx` line 485**
- Replace `{gen.current_step ?? "Processando…"}` with a humanized version:
  - `generate_image` → `Gerando imagem...`
  - `extract_prompt` → `Analisando imagem...`
  - Anything else → `Processando...`

### Files changed
- Migration: add DELETE policy on `assets`
- `src/pages/AvatarDetails.tsx` — delete image, delete avatar, computed completedShotIds, typo fix, humanize step
- `src/components/avatar/AvatarProfileCard.tsx` — delete avatar from list
- `src/components/avatar/NewGenerationModal.tsx` — pass `completedShotIds` to ShotPicker
- `src/components/avatar/ShotPicker.tsx` — `disabledShotIds` prop with visual blocking

