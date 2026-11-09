> **Code structure (signed-in app):** read `ARCHITECTURE.md` first. It says where every kind of code goes and which rules `npm run lint` enforces.

@AGENTS.md

# InRange landing page

Doctor-led metabolic care (obesity and type 2 diabetes) for affluent urban India, Delhi NCR first.
Parent: PDPL (pharmaceutical company), funding from its balance sheet. The landing page is the whole funnel: it has to earn a 2-minute assessment start.
The tech team owns functionality. This repo owns design and content. Brief: `~/Downloads/GLP1_Digital_Care_Strategy_Brief.pdf`. Old prototype (a MEDVi copy): https://medistry.vercel.app/

## Non-negotiables

1. **Mobile first.** Design at 390px first. Every detail and every motion moment must exist on mobile, and nothing may overlap, clip or scroll sideways. Desktop is the expansion.
2. **Apple-grade craft.** Every border, radius, gap and easing must be a deliberate, defensible value. Avoid clutter and avoid bare minimalism.
3. **Zero AI slop.** See the ban list below. Check every section against it before calling it done.
4. **Legal (India).** Read the compliance rules. Breaking them is a criminal risk, not a style issue.

## Compliance rules (DMR Act 1954, CDSCO Mar-May 2026, ASCI, CCPA, NMC)

Full notes: the scratchpad `compliance.md` (copied to `docs/compliance.md`).
- NEVER write drug or molecule names, "GLP-1", "incretin", "injection", "jab", "shot", "pen", "dose", "weekly dose", "weight-loss drug/medicine", or "same medicine as ...".
- NEVER state quantified or guaranteed outcomes (kg, %, inches, HbA1c drops), "reverse/cure diabetes", "permanent", "effortless", "no diet", before/after images, "#1", "best", "India's first", or false scarcity.
- Say: "doctor-led", "medication only if your doctor judges it clinically appropriate", "not everyone is prescribed medication", process claims (30-minute consultation, reviews, labs).
- Pricing: ONE package, prepaid 1, 4, 6 or 12-month plans, paid after the doctor's review. The package can include prescription medicine, so NO rupee figure appears on the page (obesity drugs cannot be advertised); the page promises an itemised price before payment. Beside the plan: "Medicine, only if your doctor prescribes it" and "not everyone is prescribed medication". Revisit any figure only with counsel.
- Disclaimers in the footer, and near the pricing and the assessment: results vary, not emergency care, adults 18+, registered practitioners, TPG 2020.
- No cold-chain, refrigeration or temperature cues anywhere public (copy, charts or imagery). The pharmacy section says InRange dispenses through its own licensed pharmacy, keeps patient choice ("or any licensed pharmacy you prefer") and QR seal verification, and never names or pictures a medicine.
- No implied or lasting outcomes: no weight trajectories, "goal reached", "one year on" or with/without comparisons. Charts show process (check-ins, reviews, labs), never results.
- Do not name the PDPL parent on the public page until counsel signs off.
- The primary CTA label is "Start free check" everywhere (deck: free eligibility check). It links to `ASSESSMENT_URL` (env `NEXT_PUBLIC_ASSESSMENT_URL`). The hero secondary "See where you stand" scrolls to `#check`.

## Facts we can use (confirmed by the client, 22 Sep 2026; the strategy deck is the source of truth from 24 Sep 2026)
- The deck is CONFIDENTIAL (it lives only on Arhaan's machine). Never commit, publish or quote its figures (market size, revenue, margins, CAC, funding, formulary, partners).
- Programme for obesity AND type 2 diabetes. Journey: a free two-minute eligibility check read by a doctor, then a free 15-minute first video consultation, then plan and payment after the review, then delivery and follow-up. Doctor review every 14 days.
- Blood tests at home through partner labs (confirmed by Arhaan).
- App first (tracker, reminders, how-to videos, AI care assistant that escalates to a doctor, pack verification, reorder), with WhatsApp support (confirmed).
- Pharmacy: InRange's own licensed pharmacy dispenses (Arhaan, 24 Sep), stocked through licensed distributors (deck). Keep both on the page.
- CONFIRM before launch: "Doctors are never paid per prescription" (Doctors facts); cancellation and refund terms for prepaid plans (FAQ, consumer law); how the itemised price changes if medicine is filled elsewhere; the pharmacy's name and drug-licence number for the footer.
- Doctors: 57 on contract within month one. Copy says "50+ doctors" (CONFIRM).
- Consultations are by video only for now (client, 23 Sep 2026). Do not mention clinics or in-person visits anywhere.
- **Inventory-led: InRange is the pharmacy too** (client, 24 Sep 2026). It dispenses and delivers prescriptions itself from its own licensed pharmacy (stock via the pharma parent). Never say or imply that it is asset-light, that a partner pharmacy dispenses, or that "InRange does not sell medicine". CONFIRM the pharmacy name and drug-licence number for the footer, and counsel sign-off on e-pharmacy rules. Packs are QR-verified (temperature handling is not mentioned publicly).
- Pricing on the prototype: Foundation ₹4,500/mo, Complete ₹9,800/mo (CONFIRM; the brief's test ranges differ). Also CONFIRM: GST treatment, minimum term, and what Foundation includes after the first consultation.
- WhatsApp is a primary channel and syncs with the app: text, voice notes (transcribed) and photos (meals, lab reports) are logged to the patient record. CONFIRM transcription, photo reading and lab-report parsing are live at launch. Name WhatsApp in plain text only; do not use its logo (Meta brand rules require the unaltered official mark, its green would be a second accent, and it adds no trust that the doctors do not already carry). Reviewed again 23 Sep 2026: still no.
- An AI assistant answers everyday questions on WhatsApp and in the app; anything clinical, complex or risky is escalated to a doctor (client, 23 Sep 2026). Copy must say the assistant labels itself, never diagnoses, prescribes or changes treatment (Telemedicine Practice Guidelines 2020 bar AI from counselling or prescribing). CONFIRM the escalation rules and that the assistant is live at launch.
- Wearables: say "a watch, ring or smart scale through Apple Health or Health Connect". Do not name Garmin, WHOOP, Oura or Fitbit until a direct integration exists, since naming them claims compatibility.
- Photography is AI-generated (Higgsfield, Nano Banana Pro); raw masters are in `art/` (gitignored). The footer states that photographs are AI-generated illustrations, and the doctor photo is captioned "AI illustration. Not an InRange doctor." Replace with real photography when available.
- The hero and Doctors photos are one video call seen from both ends (`hero-call.jpg`, `consult-call.jpg`); the brief, crops and safe areas are in `docs/photo-brief.md`. Masters are `art/hero-call-master.png` and `art/consult-call-master.png`.
- Indian clinical thresholds (published consensus): BMI 23 = overweight, 25 = obesity for Asian Indians; waist ≥90 cm men / ≥80 cm women; waist-to-height ≥0.5.

## Design system
- Direction: "clinical apothecary under teal light" (client favourite: refero 2.AG) crossed with Impilo-style instrument line-art and the restraint of Apple. Split editorial hero, a deep petrol-teal structure, a porcelain canvas, one luminous signal colour used only for data and live states.
- Signature texture: the WebGL isoline "scan" field (`ContourField`) on dark surfaces, plus technical line drawings with dimension lines (measurement is the brand idea).
- Light sections carry line art (`Art` in `ui.tsx`): ruler ticks, isoline arcs or converging strands, bleeding off a page edge, placed only in guaranteed empty space, wiping in once. One per section per viewport; never within 36px of text (checked 360 to 1920px with the ink-level clearance script).
  - Where: Check (ticks hanging from the top on phones, arcs from the bottom-left at 1100px+), What we measure (arcs, top-right), Pricing (strands merging into one line above the plans), FAQ (arcs top-right on phones, bottom-left on desktop).
  - Deliberately none in Hero, Companion and Maintenance (the contour field already carries them), Timeline (the chart is the drawing) or Doctors and Pharmacy (photography fills the space). Adding more would turn a signature into wallpaper.
  - Arcs are centred just outside the corner so each line crosses the edge at an angle. Check and FAQ intros are not sticky, so the space under them stays empty for the arcs.
- Section tags (`Tag` in `ui.tsx`): sentence case, a 7px-radius tinted plate with the three-tick ruler glyph, 24px above the heading. They say what the section covers ("Free risk check", "If medicine is prescribed"). Never uppercase-tracked, never a dot or orb, never a number.
- Brand kit: `~/Downloads/Medistry-Brand-Kit.pdf` (Sep 2026). Rules we follow:
  - The wordmark is only pure white (#fff) or ink (#111). Never teal, mint or off-white. Use the `Wordmark` component, never hand-set text. Until outlined InRange artwork is supplied, it sets "inrange" in Jost 500 with a drawn i (stem and raised dot); swap `wordmarkPaths.ts` for outlines then. Minimum about 88px wide.
  - The raised dot is the brand idea. `Wordmark sting` plays the kit's rising-dot motion once (nav on load, footer on reveal).
  - Favicon, home-screen icon and avatars are "the dot": an ink dot on white. The phone mockup avatar uses `Dot`.
  - Display type is Jost (headings, nav, tags, prices), weight 500, tracking about -0.02em. Body stays in Wix Madefor Text for small-size legibility.
  - The pharmacy scan shows the kit's genuine-product sticker ("Scan to verify").
  - The kit's own palette is greyscale. The site keeps its teal and mint as the web extension of it, with ink and white reserved for the logo.
- Share image: `src/app/opengraph-image.png` (white wordmark over the contour field).
- Landing page tokens live in `src/app/globals.css` `:root` (the signed-in app's are in `src/components/ui/styles/appTheme.css`). Never hardcode colours in components.
- Radius system: controls are full pills; surfaces 20px (mobile 16px); media 14px; section tags 7px. Nothing else.
- Easing: `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-io: cubic-bezier(.77,0,.175,1)`, `--ease-drawer: cubic-bezier(.32,.72,0,1)`. Never `linear` or `ease-in-out` for UI.
- Motion: one authored moment per section, varied (clip reveals, line drawing, scrubbed timelines). No generic fade-up on everything. Respect `prefers-reduced-motion`.
- Only transform, opacity, clip-path and filter animate. Blur only on fixed chrome.

## AI-slop ban list (content and visual)
Full research: `docs/ai-slop.md`.
- No generic eyebrows: no uppercase tracked kickers, no pill badges with dots or glows. The one allowed label is the section `Tag` described above. No section numbers (01/02/03).
- No 3-equal-card grids, no icon+heading+text card grids, no numbered how-it-works steps with a border, no hero metric template.
- No gradient text, purple/blue AI gradients, glow orbs, aurora/mesh blobs, generic dot/grid backgrounds, glassmorphism for decoration.
- No Inter, Roboto, Arial, Helvetica, Open Sans, Poppins, Montserrat, Geist, Satoshi, DM Sans, Manrope, Space Grotesk, Plus Jakarta, Instrument Serif, Fraunces, Playfair, Clash Display, Cabinet Grotesk, General Sans, Outfit. (Jost is the brand face and is allowed.)
- Copy: no em dashes or en dashes anywhere, no "not X, but Y" / "X, not Y" constructions, no rule-of-three lists for rhythm, no rhetorical questions, no exaggeration, and none of these words: elevate, seamless, unlock, empower, journey, transform, revolutionise, game-changer, delve, holistic, effortless, cutting-edge, tailored, supercharge, world-class, "here's the thing".
- No scroll cues, no decorative status dots, no marquee (max one if earned), no fake stats, no stock-smile collages.

## Workflow
- `npm run dev`, then screenshot at 390x844 and 1440x900 with Playwright (`scripts/shoot.mjs`).
- Before calling a section done: run the ban list, check contrast, and check mobile overflow (`document.documentElement.scrollWidth === innerWidth`).
