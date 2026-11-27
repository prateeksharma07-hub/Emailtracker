# MailMind AI — Design System & Visual Identity Brief
**Theme: "The Sorting Room" (Post Office + Customs & Inspection Bureau)**  
*Document Version: 1.0.0 — Canonical Specification for MailMind AI*

---

## 1. Concept & Atmosphere: "The Sorting Room"

MailMind AI is reimagined not as another generic, purple-gradient AI SaaS tool, but as a physical-feeling, high-trust postal dispatch center and customs inspection bureau: **"The Sorting Room"**.

Every email that enters your life is treated like physical correspondence entering a quarantine station. Before an untrusted payload reaches an AI engine or a human inbox, it passes through postal customs inspection:
- **Physical tactile cues**: Heavy manila envelopes, letterpress paper grain, rubber stamps with distressed ink edges, circular postal cancellation marks (postmarks), ruled schematic ledger lines, typewriter specimen labels, and perforated parcel tear-offs.
- **Two Atmospheric Modes**:
  - **Night Sorting Room** (Dark): Late-night dispatch terminal. Low amber lighting over dark oak sorting desks, carbon ink, warm glowing red heat lamps, and glowing vacuum-tube status lights.
  - **Day Post Office** (Light): Sunlit government postal counter. Sturdy manila folders, crisp fibrous parchment, dark typewriter ink, crimson wax seals, and airmail teal registration bands.

---

## 2. Color System & OKLCH Ramps

The color architecture is tightly restricted to **2-3 purposeful hues + warm paper neutrals**. Every color pairing is audited to exceed WCAG 2.1 AA standards (4.5:1 for body copy, 3:1 for large display elements).

### 2.1 Tokens & Mappings

| Role | Night Sorting Room (Dark) | Day Post Office (Light) | OKLCH / Hex Rationale |
| :--- | :--- | :--- | :--- |
| **Canvas / Background** | `#12100E` (`oklch(18% 0.01 50)`) | `#F4EBDD` (`oklch(93.5% 0.02 75)`) | Deep charcoal ink desk vs. warm unbleached kraft paper |
| **Surface (Card / Desk)**| `#1B1815` (`oklch(22% 0.012 55)`) | `#FBF6EC` (`oklch(97% 0.015 80)`) | Elevated sorting tray vs. pristine parchment sheet |
| **Surface Elevated** | `#24201C` (`oklch(26% 0.014 60)`) | `#FFFFFF` (`oklch(100% 0 0)`) | Raised ledger cards |
| **Border / Ruled Line** | `#2C2722` (`oklch(28% 0.015 60)`) | `#D9CBB3` (`oklch(82% 0.025 75)`) | Ruled ledger lines & postal envelope edges |
| **Border Strong** | `#453E35` (`oklch(37% 0.02 60)`) | `#B8A488` (`oklch(70% 0.035 75)`) | Tactile borders & stamp outlines |
| **Text Primary (Ink)** | `#F4EBDD` (`oklch(93.5% 0.02 75)`) | `#1B1815` (`oklch(22% 0.012 55)`) | Bold typewriter ink (Contrast: > 12:1) |
| **Text Muted (Pencil)** | `#B7A995` (`oklch(73% 0.025 75)`) | `#6B5F50` (`oklch(48% 0.025 65)`) | Pencil margin notes (Contrast: > 5.2:1) |
| **Customs Red (Accent)** | `#FF4B2B` (`oklch(63% 0.24 35)`) | `#C8321A` (`oklch(50% 0.22 32)`) | Primary buttons, warnings, `DETAINED` stamps |
| **Customs Red Surface** | `rgba(255, 75, 43, 0.12)` | `rgba(200, 50, 26, 0.08)` | Detained alerts & warning backdrops |
| **Airmail Teal (Accent)**| `#2DD4BF` (`oklch(80% 0.14 180)`) | `#0F766E` (`oklch(48% 0.11 190)`) | Express routing, verified badges, active tabs |
| **Cleared Green (Status)**| `#2FBF71` (`oklch(72% 0.17 145)`) | `#137A47` (`oklch(49% 0.14 148)`) | `CLEARED` customs stamp, verified safe |
| **Suspicious Amber** | `#F2A81D` (`oklch(76% 0.16 75)`) | `#A86A00` (`oklch(51% 0.15 70)`) | `SUSPICIOUS` customs stamp, triage warning |

### 2.2 Shadows & Depth
- **Night Sorting Room**: Subtle warm glow and deep charcoal falloffs: `box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.7)`.
- **Day Post Office**: Tactile offset hard shadows: `box-shadow: 3px 3px 0px #1B1815` (press-down on active: `1px 1px 0px #1B1815` with `translate(2px, 2px)`).

---

## 3. Typography & Font Hierarchy

All fonts are self-hosted via `@fontsource` to prevent external network calls, respect privacy, and guarantee zero layout shifts (CLS ~0).

| Family | Role | Weights | Usage Rules |
| :--- | :--- | :--- | :--- |
| **Bricolage Grotesque** | Display Headings | 700, 800 | Expressive, slightly condensed grotesque. Used for page titles, section headlines, and major numbers. |
| **Instrument Sans** | Body & Interface | 400, 500, 600 | Clean, humanistic modernist sans. High legibility for paragraphs, email previews, and descriptions. |
| **Special Elite** | Rubber Stamps & Typewriter Labels | 400 | Grungy vintage mechanical typewriter face. Strictly reserved for stamps (`CLEARED`, `DETAINED`), registration serial numbers, and postal marks. Never for body text. |
| **JetBrains Mono** | Data, Timestamps & Schematics | 400, 500 | Monospaced technical telemetry, header inspection, priority badges (`No. 01`), and JSON/X-Ray data. |

### Font Loading Strategy
- `font-display: swap;` configured on all `@fontsource` stylesheet imports.
- Preload critical weight (`bricolage-grotesque-latin-800` or `instrument-sans-latin-400`) in `index.html`.

---

## 4. UI Primitives & Anatomy

### 4.1 Rubber Stamp (`<Stamp />`)
- Visual style: Double border (outer solid 2px, inner thin 1px), distressed edges, rotated slightly (-6° to +8°).
- Variants:
  - `CLEARED`: Green tone, says `★ CUSTOMS CLEARED ★`
  - `SUSPICIOUS`: Amber tone, says `⚠ SUSPICIOUS // HELD ⚠`
  - `DETAINED`: Red tone, says `⛔ DETAINED // QUARANTINE ⛔`
  - `APPROVED`: Teal/Ink tone, says `✓ APPROVED FOR DISPATCH ✓`

### 4.2 Postal Cancellation Postmark (`<Postmark />`)
- Circular wavy cancel stamp with date, registry number, and text: `MAILMIND BUREAU OF INSPECTION • SORTING ROOM`.

### 4.3 Tactile Postal Button (`<Button />`)
- Primary button in Customs Red (`#FF4B2B` Night / `#C8321A` Day).
- Hard offset border and shadow (`2px solid var(--color-ink)`, shadow `3px 3px 0px var(--color-ink)`).
- Tactile mechanical press-down on active (`:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0px var(--color-ink); }`).

### 4.4 Ruled Paper Panel (`<Panel />`)
- Paper card with subtle horizontal ledger lines (24px ruled interval).
- Solid border and stamp notch corners.

### 4.5 Section Label (`<SectionLabel />`)
- Uppercase monospaced telegraph label with docket format: `NO. 01 · AI EMAIL FIREWALL`.

### 4.6 Perforated Divider (`<PerforatedDivider />`)
- Stamp sheet perforated dotted punch-hole separation line.

---

## 5. Motion & Accessibility Principles

1. **Purposeful & Tactile**:
   - UI transitions are brief (120ms to 240ms cubic-bezier).
   - The interactive Giant Envelope opening sequence is deliberate (~700ms) with flap fold, letter rise, and particle burst.
2. **First-Class Reduced Motion Support**:
   - Dedicated "Reduce Motion" toggle in header (`Motion: ON / OFF`) alongside system `prefers-reduced-motion` listener.
   - When active, all floating loops, confetti bursts, flap rotations, and laser sweeps immediately stop and collapse into an instantaneous, accessible state.
3. **No Flashing Theme Switch**:
   - An inline pre-paint script in `index.html` parses `localStorage` or system preference before DOM painting to prevent theme flicker.

---

## 6. Voice, Tone & Copywriting Rules

- **Direct, Transparent & Plainspoken**: Speak like an efficient postal inspector who values your time and security.
- **Subtle Postal Metaphors**: Use terms like "Dispatch", "Customs clearance", "Quarantine", "Ledger", and "Approved draft", but keep explanations grounded in plain English.
- **Strict Compliance & Honest Privacy Claims**:
  - ❌ **NEVER CLAIM**: "100%", "Zero-Retention", "Autonomous", "Guaranteed", "Unbreakable".
  - ✅ **ALWAYS USE**: "Never sends mail on its own", "You approve every draft", "Tokens encrypted at rest", "Sensitive mail kept away from the AI (best-effort)", "A student project".

---

## 7. The "Don'ts" Checklist

- ❌ NO generic purple-to-blue neon gradients.
- ❌ NO blurry glassmorphism / `backdrop-blur-3xl` cards.
- ❌ NO centered-stack-everything hero blocks.
- ❌ NO jargon-heavy AI marketing fluff.
- ❌ NO unapproved Google/Gmail logo modifications (only the official pre-approved Sign-in button).
- ❌ NO heavy animation libraries (GSAP, Three.js). Pure CSS, SVG, and clean React state.
