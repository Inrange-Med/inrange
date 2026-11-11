# The design kit (`src/components/ui`)

Shared, presentational pieces for every signed-in screen. A component receives data as props and
never calls a service. Each `X.tsx` default-exports `X`; its styles sit beside it in `X.module.css`.

## Components

| File | What it is |
| --- | --- |
| `AppTheme.tsx` | Wraps a signed-in layout and applies the dashboard tokens and base styles (`styles/appTheme.css`). |
| `Avatar.tsx` | Round portrait, or initials on carbon when there is no photo. |
| `BackLink.tsx` | The one back link (arrow on a tinted plate); `backControlClass` styles a back button that is not a link. |
| `Card.tsx` | The card surface with an optional title row and action. |
| `ContourField.tsx` | The WebGL isoline field on dark plates (shaders in `contourFieldShaders.ts`). |
| `DeviceCheck.tsx` | Camera and microphone rehearsal before a video call. |
| `ErrorNotice.tsx` | A failed load or save in words, with an optional Try again. |
| `LabReportUpload.tsx` | Report date, its 90-day check, then the file. |
| `LoadingSkeleton.tsx` | The waiting state for a whole page. |
| `PageHead.tsx` | Every dashboard page's head: Back, title, action, line under it. `className` swaps its spacing (the doctor dashboard passes `clinicStyles.pageHead` for its larger title). |
| `SegmentedControl.tsx` | The one segmented control. |
| `Sheet.tsx` | Bottom sheet on a phone, centred panel on a laptop. |
| `SlotPicker.tsx` | Week, day, time, confirm; days come from `@/lib/calendar/bookingWeeks` (India time). |
| `ToastProvider.tsx` | The confirmation toast; pages call `useToast()`. |
| `PilotLegalPage.tsx` | The pilot privacy, terms and grievance pages: title, pilot note and plain sections. |
| `Wordmark.tsx` | The inrange wordmark (geometry in `wordmarkPaths.ts`; the landing page reuses it). |

## Stylesheets (`styles/`)

| File | Import as | What it holds |
| --- | --- | --- |
| `appTheme.css` | (global, via `AppTheme`) | Tokens (colour, radius, easing, type), element base styles, `.btn`, `.num`, `.sr-only`, `.tag`, `.art`. |
| `FormControls.module.css` | `formStyles` | Fields, labels, inputs, the full-width action (`go`), quiet links, round icon buttons, hints, errors, the spinner. |
| `CardSurface.module.css` | `surfaceStyles` | The bare card surface (`card`). |
| `PageLayout.module.css` | `layoutStyles` | The page column (`page`, `page narrow`). |
