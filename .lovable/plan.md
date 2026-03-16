

## Quick Flow Bug Fixes

### 1. Variation count in history (useQuickFlowHistory.ts)

The query already filters `status: "completed"`, but `variationCount` uses `sorted.length` while `variations` array filters by `result_url`. These can diverge. Fix: set `variationCount` to the filtered variations array length, not the raw count.

**Line 118-132**: Change `variationCount: sorted.length` to `variationCount: variations.length` (compute variations first, then use its length).

### 2. Performance (useQuickFlowHistory.ts + QuickFlowHistory.tsx)

- Reduce `PAGE_SIZE` from 30 to 12
- Images already have `loading="lazy"` -- good
- Add fixed pixel dimensions to thumbnail containers in `SessionCard` (max 160px square) to prevent layout shift and signal browser to not decode full-res images

### 3. Technical messages (QuickFlow.tsx)

The progress display is already clean ("Gerando variação..." + percentage). The main leak risk is in error messages passed through `genError`. Expand `sanitizeErrorMessage` to catch any unrecognized error as a fallback: if the message contains common technical patterns (stack traces, HTTP codes, function names), replace with friendly text. Also add a catch-all: if message length > 120 chars, it's likely technical.

### 4. Button disabled during loading (QuickFlow.tsx)

Add `generateMutation.isPending` to the disabled condition on the "Gerar Variações" button (line 671). Currently only checks `pendingCount > 0` but misses the brief moment between click and when pending entries are added.

Also disable the quantity selector buttons during `generateMutation.isPending`.

### 5. Selector reset on restore (QuickFlow.tsx)

Already handled at line 439 (`setSelectedCount(1)`). No change needed.

### Files changed
- `src/hooks/useQuickFlowHistory.ts` — fix variation count, reduce page size
- `src/components/quick-flow/QuickFlowHistory.tsx` — fixed-size thumbnail containers
- `src/pages/QuickFlow.tsx` — disable button during mutation pending, expand error sanitization

