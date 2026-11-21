# MailMind AI — Scrollytelling Landing Page Design Brief (v2)

**Project:** MailMind AI (Autonomous, Privacy-First Email Firewall & Copilot)  
**Target:** Pre-login landing & onboarding experience (`client/src/components/auth/LoginView.jsx`)  
**Architecture:** React 19 + Tailwind CSS + GSAP ScrollTrigger + Code-split Dynamic Loader

---

## 1. Benchmarked Design References & Patterns

We analyzed 6 leading high-craft dark SaaS experiences across Godly, Land-book, and Awwwards:

1. **Linear.app (Precision & Engineering Craft)**
   - *Pattern:* Deep obsidian-steel backdrop (`#080C14`), hairline semi-transparent borders (`border-white/10`), ambient radial glow that recedes into the background, and micro-metric badges.
   - *Adopted:* Crisp dark steel canvas with ultra-fine border highlights, geometric hierarchy, and mono-accented telemetry badges.

2. **Stripe Radar (Forensic Inspection & Trust Metaphor)**
   - *Pattern:* Real-time evaluation conveyor, visual radar sweeps, side-by-side transaction risk dissection.
   - *Adopted:* Chapter "Scan" sticky stage with an oscillating laser beam contrasting human-rendered email text against adversarial token overrides.

3. **Framer Supply & Awwwards Site-of-the-Day Scrollytelling**
   - *Pattern:* Pinned scroll sections where user scroll progress drives tactile mechanics (conveyor belt scrubbing, stamp flips).
   - *Adopted:* Sticky stage animation pipeline using GSAP `ScrollTrigger` with clean scrubbing (`scrub: 1`).

4. **Superhuman & Raycast (Kinetic Speed & Tactile Keyboard Tokens)**
   - *Pattern:* High-contrast typography, live typing draft animations, multi-tone toggle pills, voice waveform visuals.
   - *Adopted:* Chapter "Autopilot" showcasing dynamic 3-tone draft generation (Professional, Concise, Detailed) and voice waveform sync with *"You approve. Always."*

5. **Apple Security Whitepapers (Sober, Defensible Trust Claims)**
   - *Pattern:* Rigorous absence of hype ("100% unbreakable" is forbidden; instead, exact architectural barriers, local token isolation, and explicit human authorization gates).
   - *Adopted:* Best-effort honesty ("Sensitive mail kept away from the AI (best-effort)", "Zero Auto-Send (Human Approval Required)", "Zero Email Retention").

6. **Cron / Notion Calendar (Fluid Dual-Theme Execution)**
   - *Pattern:* Flawless dark-to-light theme switching preserving high contrast and legible typography in daylight and darkroom conditions.
   - *Adopted:* Synchronized `useTheme()` support with crisp platinum-steel light mode variant.

---

## 2. Color Palette & Lighting Model

### Dark Mode (Primary Night Operations)
- **Base Canvas:** `#080C14` (Deep Space Obsidian)
- **Secondary Surface:** `#0F172A` / `#111827` (Cardite Steel with glassmorphic blur)
- **Primary Accent:** `#F59E0B` (High-Energy Amber) & `#D97706` (Warm Safety Gold)
- **Inspection Beam (Laser):** `#06B6D4` (Cyan Diagnostic Scan)
- **Adversarial Vector (Threat):** `#F43F5E` (Crimson Malicious Highlight)
- **Integrity Verified:** `#10B981` (Emerald Cleared Stamp)
- **Text:** Primary `#F8FAFC`, Secondary `#94A3B8`, Muted `#64748B`

### Light Mode Variant (Daylight Field Operations)
- **Base Canvas:** `#F8FAFC` (Clean Titanium White)
- **Card Surface:** `#FFFFFF` with `border-slate-200/80`
- **Text:** Primary `#0F172A`, Secondary `#475569`, Muted `#94A3B8`
- **Accents:** `#D97706` (Amber Accent), `#E11D48` (Rose Threat), `#059669` (Emerald Verified)

---

## 3. Typography Architecture

- **Display & Headline Font:** `Plus Jakarta Sans` / `Outfit` (loaded via Google Fonts)
  - Geometric, punchy uppercase headings with tight tracking (`tracking-tight`), confident modern silhouette.
- **Monospace Font:** `JetBrains Mono` / `Fira Code`
  - Utilized for header telemetry (SPF, DKIM, DMARC), composite threat score meters, forensic findings, and prompt override tokens.
- **Body Font:** Inter / System UI sans-serif for comfortable reading with 1.6 line height.

---

## 4. Motion Principles & Interaction Dynamics

1. **Scrubbed Narrative:** Scroll progress directly controls the timeline in Chapter 2 (conveyor transport under X-Ray lens) and Chapter 3 (stamp flip impact).
2. **X-Ray Lens Cursor:**
   - On `pointer: fine` devices, an illuminated cursor-following circular lens overlays the hero headline. Moving the lens over the text reveals secret adversarial instructions hidden in neon red behind the innocent visible text.
   - On touch/mobile devices, a prominent "Tap to reveal hidden prompt override" button triggers an interactive toggle with instant feedback.
   - **Strict rule:** Native OS cursor is **never** hidden (`cursor: none` is forbidden); the lens acts purely as an ambient forensic overlay.
3. **Floating 3D Glass Envelope:**
   - Kinetic floating envelope in hero responding smoothly to cursor position with specular glare reflection and depth parallax.
4. **`prefers-reduced-motion` Invariant:**
   - When reduced motion is requested, all continuous looping animations and scroll scrubbing are disabled, replacing interactive parallax with accessible, clean static layouts.

---

## 5. Photographic Imagery Style (Duotone Amber Treatment)

- All images adhere strictly to a unified **Duotone Amber / Steel** photographic treatment:
  - Deep dark charcoal shadows, desaturated midtones, and high-contrast amber specular highlights.
- Self-hosted in `client/public/landing/`, WebP format, `<200KB` each, explicit width/height, `loading="lazy"`.
- Sources documented in `client/public/landing/CREDITS.md` under open-source / Unsplash / Pexels free licenses. Zero copyrighted celebrity imagery.
