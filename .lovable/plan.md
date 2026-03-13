

## Quick Flow — Request Leak Fix

### Root Causes Found

**Cause 1: Polling never stops on stall.** When the 2-minute stall timer fires, `step` becomes `"error"` but `generationId` stays set. The hook's `refetchInterval` only checks for DB status `"completed"` or `"failed"` — a stalled generation remains `"pending"` in the DB, so polling returns 3000ms forever. This is the primary leak.

**Cause 2: 3 requests per poll cycle.** Each 3-second poll fires 3 separate queries: `generations`, `generation_jobs`, and `generation_events`. Quick Flow only uses data from `generations` (status, progress_pct, result_url, retry_count, current_step). The jobs and events queries are wasted — they exist for `GenerationStatusPanel` and `GenerationHistorySection` but Quick Flow never renders them.

### Fix Strategy (2 files)

**1. QuickFlow.tsx — Disable hook on terminal states**

- Pass `generationId` to `useGenerationStatus` only when `step === "tracking"`
- Before transitioning to `completed` or `error`, snapshot the needed data (`resultUrl`, `errorCode`, `retryCount`) into local state
- This instantly kills all polling on any terminal transition (completed, failed, stall)
- On `handleRegenerate`/`resetAll`, local snapshots are cleared naturally

**2. useGenerationStatus.ts — Add lightweight mode**

- Add an optional `skipDetails` parameter that skips the `generation_jobs` and `generation_events` queries
- Quick Flow passes `skipDetails: true` → 1 request per poll instead of 3
- `GenerationStatusPanel` and `GenerationHistorySection` continue working unchanged (they don't pass the flag)
- Returns empty arrays for `jobs`/`events` when skipped

### Polling On/Off Conditions (after fix)

| Condition | Polling |
|---|---|
| `generationId === null` | OFF (hook disabled) |
| `step !== "tracking"` | OFF (null passed to hook) |
| `step === "tracking"` | ON, 3s interval, 1 request/cycle |
| DB status → `completed` | OFF (step transitions, generationId nullified for hook) |
| DB status → `failed` | OFF (same) |
| Stall timer fires | OFF (same) |
| Regenerate clicked | Old OFF instantly, new ON after new generationId arrives |

### Request count comparison

- **Before**: 3 requests × every 3s × indefinitely after stall = unbounded
- **After**: 1 request × every 3s × only during `tracking` step = bounded

### Files changed
- `src/hooks/useGenerationStatus.ts`
- `src/pages/QuickFlow.tsx`

### What depends on backend
Nothing — this is purely a frontend polling/lifecycle fix.

