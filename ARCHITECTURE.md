# InRange app: how the code is organised

Read this before adding or moving a file. Every rule here is a rule; the ones marked **(lint)**
fail `npm run lint` when broken. The visual design of every signed-in screen comes from the design
repository (Arhaan's prototype) and is carried here by the design kit in `src/components/ui/`.

## Where do I find...

| Looking for                                                               | Go to                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A patient page                                                            | `src/app/patient-dashboard/<section>/page.tsx` (URL `/patient-dashboard/<section>`; Home is `src/app/patient-dashboard/page.tsx`)                                                                                                                                           |
| A doctor page                                                             | `src/app/doctor-dashboard/<section>/page.tsx` (Today is `src/app/doctor-dashboard/page.tsx`, its pieces in `components/today/`; a patient's record is `patients/[patientId]/`, a call note under review `notes/[noteId]/`)                                                  |
| Sign-in, onboarding, the video call                                       | `src/app/sign-in/`, `src/app/onboarding/`, `src/app/consultation/[appointmentId]/`                                                                                                                                                                                          |
| An onboarding question or screen                                          | `src/app/onboarding/components/questions/` (questions 1 to 8 are saved to the profile; question 9, the recent blood test, picks the path; the ruler in `measure-field/`), `components/blood-test-step/` (upload, report sent, lab booking)                                  |
| The app-wide 404 and error screens                                        | `src/app/not-found.tsx` (title) renders `src/app/NotFoundView.tsx`; `src/app/error.tsx`. Both offer the signed-in home, else the website                                                                                                                                    |
| A page's own pieces                                                       | `components/` beside its `page.tsx`                                                                                                                                                                                                                                         |
| Pieces shared by one dashboard                                            | `src/app/patient-dashboard/components/`, `src/app/doctor-dashboard/components/` (and `styles/`)                                                                                                                                                                             |
| The dashboard shells (navigation)                                         | `PatientShell.tsx`, `DoctorShell.tsx` in those `components/` folders                                                                                                                                                                                                        |
| Shared UI (buttons, sheets, slot picker...)                               | `src/components/ui/` (its `README.md` lists every component and stylesheet)                                                                                                                                                                                                 |
| A flow used in two places (lab booking)                                   | `src/features/lab-booking/`                                                                                                                                                                                                                                                 |
| Styles                                                                    | tokens and base styles: `src/components/ui/styles/appTheme.css`; shared kit sheets: `src/components/ui/styles/` (`FormControls`, `CardSurface`, `PageLayout`); a page: `<Name>Page.module.css` beside `page.tsx`; a component (kit or route): `X.module.css` beside `X.tsx` |
| The call behind a screen                                                  | `src/services/<area>Service.ts`: its top comment lists every endpoint, in the order of its functions                                                                                                                                                                        |
| What an endpoint should return                                            | `docs/backend/README.md` (the index and the checklist of PROPOSED endpoints)                                                                                                                                                                                                |
| A data shape                                                              | `src/types/<domain>.ts`                                                                                                                                                                                                                                                     |
| HTTP, session, formatting, units, form checks                             | `src/lib/` (`http/apiClient.ts`, `session/authSession.ts`, `format/`, `units/`, `calendar/`, `consultations/`, `navigation/`, `payments/`, `validation/`)                                                                                                                   |
| Env values                                                                | `src/config/env.ts` (public); `.env.example` lists every variable                                                                                                                                                                                                           |
| Redcliffe Labs reference client (for the backend; the app never calls it) | `src/server/redcliffe/redcliffeClient.ts` (+ `redcliffeTypes.ts`, `redcliffeClient.check.mjs`, run by `npm run check:redcliffe`)                                                                                                                                            |
| Payments                                                                  | `src/services/paymentService.ts`, `src/lib/payments/razorpayCheckout.ts`, `src/lib/payments/checkoutHref.ts` (every link to the checkout), `src/app/patient-dashboard/checkout/`, `docs/backend/payments-razorpay.md`                                                       |
| The public homepage (frozen)                                              | `src/components/landing/`, `src/app/page.tsx`                                                                                                                                                                                                                               |

## 1. The layers

```
src/
  app/            Routes. A folder is a URL. Owns pages, layouts and the page's own pieces.
  components/
    ui/           The design kit: shared, presentational, used by more than one area.
                  Its README.md lists every component and stylesheet in one line each.
    landing/      The public homepage. Frozen: it keeps its own globals.css, ui.tsx and
                  ContourField. Dashboards never import from it.
  features/       A whole flow used by more than one area (lab-booking: onboarding and the
                  dashboard both run it). Components plus their hook; may call services.
  services/       The ONLY code that talks to the backend. One file per backend area.
  server/         Server-only code (secrets allowed). Today one reference client: Redcliffe Labs,
                  written for the backend to adopt (the app itself never calls Redcliffe).
                  Guarded by `import "server-only"`; never imported by a page or component.
                  Reads its own secret env vars: an exception to config/env.ts.
  types/          The app's data shapes, one file per domain, named like its service
                  (appointmentService -> appointment.ts, patientProfileService -> patientProfile.ts).
  hooks/          Shared React hooks (useApiResource, useNow, useOnline, useSessionUser: who is
                  signed in, useSignedInHome, useSignOut).
  lib/            Plain helpers with no UI, one sub-folder per purpose: http, session, format,
                  units, calendar, consultations, navigation, payments, validation.
  config/env.ts   The ONLY file that reads public environment variables.
```

Data flows one way:

```
page.tsx  ->  services/xService.ts  ->  lib/http/apiClient.ts  ->  backend
   |                 |
   |                 +-- maps raw backend JSON (PascalCase, many shapes) to types/x.ts
   +-- passes typed data as props to components (route-local or components/ui)
```

### Who may import what

| From                 | May import                                                      | Never                                 |
| -------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `app/<area>/**`      | services, components, features, hooks, lib, types, its own area | another area's folder (lint)          |
| `features/<flow>/**` | services, components, hooks, lib, types                         | route folders (lint)                  |
| `components/**`      | other components, hooks, lib, types                             | services, features, config/env (lint) |
| `services/**`        | lib, types, other services                                      | React, next, components (lint)        |
| `lib/**`, `types/**` | lib, types, config/env                                          | services, components, app             |
| `server/**`          | its own files                                                   | anything in the browser bundle        |

## 2. A route folder (the patient dashboard is the reference)

```
src/app/patient-dashboard/appointments/
  page.tsx                       The route: a small server file that sets the title.
  AppointmentsPage.module.css    Styles for this page; its components import it as ../AppointmentsPage.module.css.
  components/                    Pieces used ONLY by this page (and its child routes).
    AppointmentsView.tsx         The client screen: loads data via services, composes components.
    UpcomingCard.tsx
    ConsultationChangeTimeSheet.tsx
```

Patient-area pieces shared by several sections sit in `src/app/patient-dashboard/components/`
(`PatientShell`, `ConsultationVisit`, `ItemisedBill`, `StatusTracker`, `EligibilityStatus`, Home's
pieces in `components/home/`) and `styles/` (`FoldingSection.module.css`, imported as `foldingStyles`).

- Folders are `kebab-case` because they are URLs (`lab-tests`, `doctor-dashboard`).
- Component files are `PascalCase.tsx`, one component per file, default export, named the same as
  the file. Its stylesheet sits beside it with the same name: `X.tsx` + `X.module.css`.
- Hooks are `useSomething.ts`; services are `somethingService.ts`; types are `something.ts`;
  helper modules are camelCase and named for what they do.
- A file's own stylesheet is imported as `styles`. The shared kit sheets keep descriptive names:
  `formStyles` (FormControls.module.css), `surfaceStyles` (CardSurface.module.css),
  `layoutStyles` (PageLayout.module.css). A kit component's own styles sit beside it
  (`Card.tsx` + `Card.module.css`); the shared sheets hold only what pages use directly.
- A page's `<Name>Page.module.css` holds the page-level layout and any rule whose selector crosses
  components (CSS module class names only match within one sheet); a component that uses it as well
  as its own sheet imports it as `pageStyles` (onboarding, sign-in and the patient Care, Home and
  Resources pages are examples).
- Code shared by several pages of ONE area lives in that area's `components/` and `styles/`, imported
  by alias (`@/app/doctor-dashboard/components/AppointmentRow`). If a second AREA needs it, move it
  to `src/components/ui/` in the same change.
- Every file starts with a short comment saying what it is for and anything non-obvious about it.
- Every page sets its own document title (`export const metadata` in a server `page.tsx` or
  `layout.tsx`). Known exception: `assessment` and `pricing`, which only redirect to sign-in and onboarding. The pilot
  legal pages (`privacy`, `terms`, `grievance`) use `PilotLegalPage` until counsel supplies the final text. A screen that needs the browser keeps `page.tsx` a small server file that sets the
  title, reads route params and renders the client screen from `components/` (`HomeView`,
  `TodayView`, `PatientRecordView`).

### The areas

Every signed-in layout wraps its content in `<AppTheme>` (`src/components/ui/AppTheme.tsx`), which
applies the dashboard design tokens. The landing page does not.

| Area       | URL                             | Folder                       | Shell (layout)                              |
| ---------- | ------------------------------- | ---------------------------- | ------------------------------------------- |
| Patient    | `/patient-dashboard/...`        | `src/app/patient-dashboard/` | `patient-dashboard/components/PatientShell` |
| Doctor     | `/doctor-dashboard/...`         | `src/app/doctor-dashboard/`  | `doctor-dashboard/components/DoctorShell`   |
| Admin      | `/admin`, `/admin/doctors`      | `src/app/admin/`             | `admin/components/AdminShell`               |
| Sign-in    | `/sign-in`                      | `src/app/sign-in/`           | none                                        |
| Onboarding | `/onboarding`                   | `src/app/onboarding/`        | none                                        |
| Video call | `/consultation/[appointmentId]` | `src/app/consultation/`      | none (both roles)                           |
| Pricing    | `/pricing`                      | `src/app/pricing/`           | none: redirects to `/onboarding`            |

## 3. Talking to the backend

- **Only `src/lib/http/apiClient.ts` calls `fetch`** (lint). It adds the base URL and the
  `Authorization: Bearer` header, parses JSON, and throws `ApiError` (with `.status`) when the
  status is not 2xx or the body says `success: false`.
- **Only `src/services/*` call `apiRequest`.** A service file starts with its endpoint list (method,
  path, one line each, `PROPOSED` on any the backend does not have yet) and a `Doc:` link, then has
  one exported function per endpoint, named verb + noun, in the same order. Functions return app
  types from `src/types/`, never raw backend JSON; raw-shape quirks are handled once, in the
  service's mapper (`toAppointment`, `toAddress`...).
- **Pages load data with `useApiResource`** so loading, error and empty states look the same
  everywhere. Show errors with `ErrorNotice`, waiting with `LoadingSkeleton`.
- A PROPOSED endpoint is still called by its path, and the screen shows a plain "not available yet"
  state on 404 (`ApiError.isMissingEndpoint`). Every one is in `docs/backend/` with its request and
  response, and in the checklist in `docs/backend/README.md`. Nothing is mocked.
- Third parties with secret keys (Redcliffe Labs, Razorpay secret) are called by the backend only.
  The browser never holds a secret.

## 4. Single sources of truth

| Thing                                                   | Lives in                                                                                                                                         | Never                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Colours, radii, easing, type                            | `src/components/ui/styles/appTheme.css` (dashboards)                                                                                             | hex values in a component                                    |
| Backend URL and env values                              | `src/config/env.ts` (exceptions: server secrets in `src/server/`; the frozen landing page's `ASSESSMENT_URL` in `src/components/landing/ui.tsx`) | `process.env` anywhere else                                  |
| Access token and signed-in user                         | `src/lib/session/authSession.ts`                                                                                                                 | `localStorage` anywhere else (lint)                          |
| Who is signed in, in a component                        | `useSessionUser()` (`src/hooks/useSessionUser.ts`)                                                                                               | reading the session during render                            |
| Sending a signed-out visitor to sign in and back        | `signInHrefFor`, `pathAfterSignIn` in `src/lib/navigation/signInReturn.ts`                                                                       | a bare `/sign-in` from a guard                               |
| A link to the checkout                                  | `checkoutHref()` in `src/lib/payments/checkoutHref.ts`                                                                                           | a hand-built `/patient-dashboard/checkout?...`               |
| Date and time wording, always India time (Asia/Kolkata) | `src/lib/format/dateTime.ts` (`spokenDay`, `monthAndYear`...)                                                                                    | `toLocaleDateString` or `Intl.DateTimeFormat` in a component |
| API dates and slot times                                | `toApiDate`, `combineDateAndTime` in `dateTime.ts` (India time)                                                                                  | the device's local date                                      |
| Money wording                                           | `src/lib/format/money.ts`                                                                                                                        | hand-built `₹` strings                                       |
| Kg/lb, cm/ft units                                      | `src/lib/units/measurementUnits.ts`                                                                                                              | unit maths in a component                                    |
| A data shape                                            | `src/types/<domain>.ts`                                                                                                                          | redeclaring a type in a page or a service                    |
| Icons                                                   | `@phosphor-icons/react`                                                                                                                          | any other icon library (lint)                                |
| Confirmations                                           | `useToast()` or a `Sheet`                                                                                                                        | `alert()` / `confirm()` (lint)                               |

## 5. Before you open a pull request

1. `npm run lint` and `npm run build` pass.
2. The screen works at 390px wide and 1440px wide with no sideways scroll.
3. Loading, error, empty and success states all exist.
4. New endpoints are in the service's list and in `docs/backend/` (and its README checklist).
5. No commented-out code. Git remembers old code; the file should show only what runs.
