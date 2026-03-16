

## Quick Flow — Fit in One Viewport

### Problem
Images use `aspect-ratio: 9/16` which makes them tall regardless of viewport. Actions require scrolling.

### Changes (all in `src/pages/QuickFlow.tsx`)

#### 1. Constrain image heights to viewport
Replace `style={{ aspectRatio: "9/16" }}` on all main images/containers with `max-height: 55vh` + `object-fit: contain`. This applies to:
- Reference image (line 564)
- Reference upload placeholder (line 539)
- Variation empty state (line 592)
- Single tracking spinner (line 607)
- Batch tracking image/spinner (lines 631, 636)
- Completed result image (line 660)
- Error state (line 741)

Each container gets `style={{ maxHeight: "55vh", aspectRatio: "9/16" }}` — the aspect-ratio provides the shape but maxHeight caps it.

#### 2. Lightbox with variation navigation
Replace the simple lightbox with one that navigates between session variations:
- State: `lightboxIndex: number | null` (instead of `lightboxUrl: string | null`)
- Left/right arrow buttons (ChevronLeft/ChevronRight from lucide)
- "2 de 5" indicator text at bottom
- Arrow key support (useEffect with keydown listener)
- Only navigate to completed variations
- Keep clicking reference image opening its own standalone lightbox (separate state or special index like -1)

#### 3. Compact spacing
- Page header: reduce `py-6` to `py-4`, reduce title from `text-2xl` to `text-xl`
- Card containers: `p-4` → `p-3`
- Action area `space-y-2` → `space-y-1.5`
- Button heights already `h-8`, keep as-is

#### 4. History visibility
- Reduce `space-y-4` on main container to `space-y-3` so history title peeks into viewport

### Files changed
- `src/pages/QuickFlow.tsx` — all changes above

