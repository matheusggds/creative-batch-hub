

## Plan: Make Avatar Library the main page + add navigation menu

### Changes

#### 1. Update routing in `App.tsx`
- Change `/` (authenticated) to redirect to `/avatars` instead of `/studio`
- Remove `/studio` route (or redirect it to `/avatars`)
- Make `/avatars` the default authenticated landing page

#### 2. Add a shared navigation header/menu
Create a reusable `AppHeader` component with navigation links:
- **Avatares** → `/avatars`
- **Quick Flow** → `/quick`
- Include user email + sign out button

#### 3. Update page headers
- **AvatarLibrary.tsx**: Remove the back arrow to `/studio`, use the new `AppHeader`
- **AvatarDetails.tsx**: Back arrow goes to `/avatars`, use `AppHeader`
- **QuickFlow.tsx**: Use `AppHeader`

#### 4. Clean up
- Remove or keep `Studio.tsx` as a redirect — depends on whether any deep links exist. Safest: keep the route but redirect to `/avatars`.

### Affected Files
| File | Change |
|---|---|
| `src/App.tsx` | Update routes, redirect `/studio` → `/avatars` |
| `src/components/AppHeader.tsx` | **New** — shared header with nav links |
| `src/pages/AvatarLibrary.tsx` | Use `AppHeader`, remove back arrow to studio |
| `src/pages/AvatarDetails.tsx` | Use `AppHeader` |
| `src/pages/QuickFlow.tsx` | Use `AppHeader` |
| `src/pages/Studio.tsx` | Optional: keep as redirect or delete |

### Risks
- Minimal — routing change only. No data/backend changes.
- Studio page preserved as redirect so no broken bookmarks.

