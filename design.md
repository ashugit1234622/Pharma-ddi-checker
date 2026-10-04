# Pharma DDI Checker — Design Document

> **Status:** Living document. All values are sourced directly from the codebase.
> Last audited: Oct 2026, commit `e906a55`.

---

## 1. Design Foundation

### 1.1 Color Tokens
Defined in `src/app/globals.css` `:root`. **All UI must use these CSS variables.**

| Token | Value | Usage |
|---|---|---|
| `--bg-main` | `#020617` | Page background, WebGL canvas clear color |
| `--bg-card` | `#0f172a` | Card and panel surfaces |
| `--bg-hover` | `#1e293b` | Hover states, selected rows |
| `--bg-input` | `#0f172a` | Input field backgrounds |
| `--text-main` | `#f8fafc` | Primary text |
| `--text-muted` | `#94a3b8` | Secondary / supporting text |
| `--text-dim` | `#64748b` | Tertiary, placeholders, labels |
| `--accent-primary` | `#0ea5e9` | Sky-500 blue — primary action, links, focus |
| `--accent-hover` | `#0284c7` | Sky-600 — hover on primary |
| `--accent-glow` | `rgba(14,165,233,0.1)` | Box-shadow glow on primary elements |
| `--accent-soft` | `rgba(14,165,233,0.05)` | Subtle tinted backgrounds |
| `--success` | `#10b981` | Emerald-500 — safe / no interaction |
| `--success-glow` | `rgba(16,185,129,0.15)` | Success glow |
| `--warning` | `#f59e0b` | Amber-500 — moderate risk |
| `--warning-glow` | `rgba(245,158,11,0.15)` | Warning glow |
| `--danger` | `#ef4444` | Red-500 — major / contraindicated |
| `--danger-glow` | `rgba(239,68,68,0.15)` | Danger glow |
| `--border` | `#334155` | Slate-700 — default border |
| `--border-hover` | `#475569` | Slate-600 — hover border |
| `--chart-drug1` | `#0ea5e9` | Drug 1 bars in charts |
| `--chart-drug2` | `#8b5cf6` | Drug 2 bars in charts |
| `--chart-low` | `#10b981` | Toxicity low bar fill |
| `--chart-moderate` | `#f59e0b` | Toxicity moderate bar fill |
| `--chart-high` | `#ef4444` | Toxicity high bar fill |

### 1.2 Typography

```
Font stack: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
Google Fonts weights loaded: 300, 400, 500, 600, 700

Type scale:
  h1:   2.2rem,  letter-spacing -0.03em, weight 600
  h2:   1.6rem,  letter-spacing -0.02em, weight 600
  h3:   1.25rem, weight 600
  body: 1rem,    line-height 1.6
  muted: 0.875rem
  label: 0.78rem
  micro: 0.7rem, letter-spacing 0.08–0.12em, uppercase

Landing page hero:  clamp(2.4rem, 5.5vw, 4rem), weight 900, letter-spacing -0.035em
```

### 1.3 Spacing and Layout

```
Global max-width:         1100px  (.container, .wl-container)
Inline form/chat max:      800px
Drug search row max:       900px

Container padding: 1.5rem (desktop), 1rem (mobile ≤768px)
Card padding:      1.5rem (desktop), 1rem (mobile)
Card radius:       8px (global), 1rem (landing feature cards), 1.25rem (hero demo)

Border-radius system:
  6px   — small chips, source-item, dropdown items
  8px   — inputs, buttons, dropdown menu, avatar
  10px  — alt-card, btn, input
  14px  — report-section
  1rem  — feature cards, review cards, showcase image wrappers
  1.25rem — hero DDI demo card, aastha panel
  24px  — aastha mobile bottom sheet top corners
  50px  — tabs-container pill row
  999px — badge chips, severity pills, dose pills, legend dots
```

### 1.4 Background System

```
Layer stack (bottom to top):
  z=0: Fixed WebGL CinematicVisualLayer (position: fixed, inset: 0)
       Canvas bg: #02070B
       Pointer-events: none
  z=0: Fixed gradient veil:
       linear-gradient(to bottom,
         rgba(2,6,23,0.72) 0%,
         rgba(2,6,23,0.88) 55%,
         #020617 100%)
 z=10: All page content

Body grid texture:
  background-image:
    linear-gradient(rgba(14,165,233,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(14,165,233,0.03) 1px, transparent 1px)
  background-size: 40px 40px

Idle screensaver (main app only):
  After 10 seconds of no input events (mousemove, keydown, touchstart, scroll, wheel)
  isIdle state = true
  → CinematicVisualLayer ramps to full animation
  → Vignette overlay opacity 0→1: radial-gradient(ellipse, transparent 30%, rgba(2,7,11,0.55))
  → Content opacity 1→0.28
  → All transitions: 1.2s ease-in-out

WebGL fallback (no GPU):
  background: radial-gradient(ellipse at 50% 40%, #0d2b45 0%, #02070b 70%)
```

### 1.5 Animation System

```
Page transitions (src/app/template.tsx — framer-motion):
  opacity: 0→1, duration: 0.5s, ease: 'easeOut'
  Applied to every route change

Global keyframes:
  fadeIn:       opacity 0→1, translateY 12px→0
  slideUp:      opacity 0→1, translateY 20px→0
  fadeSlideUp:  opacity 0→1, translateY 15px→0 (tab content)
  scaleIn:      opacity 0→1, scale 0.95→1
  pulseGreen:   box-shadow 15px→30px rgba(16,185,129,*), 2s infinite
  pulseDanger:  box-shadow 15px→30px rgba(239,68,68,*), 1.5s infinite
  spin:         rotate 0→360°, 0.8s linear (loading spinners)
  rotate-spin:  2s linear (scanning/analysis icons)
  slideUpFade:  translateY(20px)+scale(0.96)→origin, Aastha panel entry
  bob:          translateY 0→6px→0, 2s infinite (scroll hint)

Scroll reveal pattern:
  Class: .scroll-reveal / .is-visible
  Trigger: IntersectionObserver threshold=0.1 (0.3 for stats)
  Transition: opacity + translateY(24px→0), 0.7s cubic-bezier(0.25,0.8,0.25,1)
  will-change: opacity, transform

Chart animation triggers:
  All chart animations start on IntersectionObserver enter (threshold 0.1)
  Bar width: 0→value%, 1.2s cubic-bezier(0.25,0.8,0.25,1)
  Radar polygon: vertices scale from 0 via progress float, 1.2s ease
  Gauge arc: stroke-dashoffset, 1.4s cubic-bezier(0.25,0.8,0.25,1); stroke color 0.6s ease
  Gauge glow: drop-shadow(0 0 8px <color>)

Card hover transitions:
  border-color: 0.25–0.3s
  transform (lift): 0.25–0.4s
  box-shadow: 0.2–0.3s
```

### 1.6 Severity System

Source: `prompts.ts` severity enum. Used on badges, borders, backgrounds globally.

| Value | Color | Bg alpha | Border alpha | Display Label |
|---|---|---|---|---|
| `contraindicated` | `#ef4444` (--danger) | 0.12 | 0.25 | CONTRAINDICATED |
| `major` | `#f59e0b` (--warning) | 0.15 | 0.25 | MAJOR |
| `moderate` | `#0ea5e9` (--accent-primary) | 0.12 | 0.3 | MODERATE |
| `minor` | `#10b981` (--success) | 0.12 | 0.25 | MINOR |

Badge anatomy: `display:inline-flex`, `padding:0.35rem 0.85rem`, `border-radius:20px`,
`font-size:0.8rem`, `font-weight:600`, `text-transform:uppercase`, `letter-spacing:0.5px`

Risk score mapping (from `severityToScore()` in page.tsx):
- `contraindicated` → 96
- `major` → 80
- `moderate` → 54
- `minor` → 25
- default → 8

Score → color (from `scoreToColor()`):
- ≥70 → `--danger`
- ≥40 → `--warning`
- <40 → `--success`

---

## 2. Global Shell

### 2.1 Header (`src/components/Header.tsx`)

```
Position: sticky top:0, z-index:100
Background: rgba(2,6,23,0.95)
Border-bottom: 1px solid var(--border)
Padding: 0.65rem 1.25rem (desktop), 0.55rem 1rem (mobile ≤640px)
Display: flex, justify-content: space-between, align-items: center
flex-wrap: wrap (to allow mobile dropdown below)

Logo (.logo):
  Left side
  Font: 1.05rem, weight:700
  "Pharma" → .logo-brand (color: --accent-primary)
  "DDI Checker" → .logo-sub (color: --text-main, weight:600)
  Gap: 0.35rem between icon and text

Desktop nav (>640px):
  .header-nav-desktop: flex, gap:0.75rem, align-items:center

  "Powered by Gemini AI" badge (.powered-badge):
    font-size:0.75rem, color:--text-dim
    padding:0.25rem 0.6rem, bg:--bg-hover, radius:6px

  Nav links (.nav-link):
    Home (Home icon) → /
    History (Clock icon) → /history
    Reminders (Bell icon) → /reminders
    Health Tips (Apple icon) → /health-tips
    Skincare (Heart icon) → /skincare
    Cycle Tracker (CalendarDays icon) → /cycle-tracker  [female users only]
    Feedback (MessageSquare icon) → /feedback
    Each: 0.88rem, padding:0.3rem 0.5rem, radius:6px, hover:bg --bg-hover

  Prescription Scanner button (ScanBarcode icon, 0.88rem) → opens MedCheck modal
  Food Check button (Apple icon) → opens FoodCheck modal

  Avatar area:
    User avatar: 30×30px, radius:50%, border:2px solid --border
    Fallback: same size div with bg:--bg-card + User icon
    Skeleton: same size div, bg:--bg-hover (during session load)
    Hamburger dropdown (.header-dropdown-menu):
      position:absolute, top:120%, right:0
      bg:--bg-card, border:1px solid --border, radius:8px
      shadow: 0 8px 32px rgba(0,0,0,0.5), min-width:180px, padding:0.4rem
      Items (.header-dropdown-item): User/Profile, Feedback, Sign Out
        Each: 0.9rem, weight:500, padding:0.65rem 0.9rem, radius:8px, hover:--bg-hover

  Sign in button (.btn-signin):
    bg:--accent-primary, color:#fff, padding:0.4rem 0.85rem, radius:6px, 0.85rem weight:500

  PWA Install button: shown if 'beforeinstallprompt' event available

Mobile nav (≤640px):
  .header-nav-desktop hidden
  .header-nav-mobile shown: sign-in btn + hamburger btn
  .mobile-dropdown: full-width below header, bg:rgba(10,10,12,0.97)
    Order: User row → divider → nav links → PWA row → sign out
    Sign out text: #ff6b6b (.mobile-signout)
    Sign in: full-width btn (.mobile-signin-full)

Auth dialog (CustomDialog):
  Triggered when unauthenticated user clicks protected action
  Modal overlay: "Please sign in to access {feature}."

Cycle Tracker prompt:
  Female users without last_menstruation_date set get a prompt to fill it
```

### 2.2 Footer (`src/components/Footer.tsx`)
```
border-top: 1px solid --border
bg: --bg-main
Centered copyright text
Not rendered on /welcome (welcome has its own footer)
```

### 2.3 Floating Global Components
```
Aastha trigger button:
  position:fixed, bottom:2rem, right:2rem, z-index:100
  56×56px circle
  bg: linear-gradient(135deg, --accent-primary, --accent-hover)
  shadow: 0 8px 24px --accent-glow
  hover: scale(1.08) translateY(-2px), expanded shadow

GlobalReminder:
  Toast-style floating component
  Medication reminder notifications

TipOfTheDay:
  Ephemeral daily tip notification
```

---

## 3. Screen: `/welcome` — Landing Page

### 3.1 Layer Architecture
```
z=0 fixed: CinematicVisualLayer (WebGL)
z=0 fixed: Dark gradient veil (transparent → rgba(2,6,23,0.95) → #020617)
z=10: All .wl-section content
```

### 3.2 Hero Section
```
class: .wl-hero
min-height: 92vh
padding: 7rem top, 4rem bottom, 1.5rem sides

Inner layout (.wl-hero-inner):
  flex column (mobile) → flex row (≥1024px), gap:3rem
  max-width: 1100px, centered

--- LEFT COLUMN (.wl-hero-text, max-width: 520px desktop) ---

Badge (.wl-badge):
  "Next-Gen Pharmacovigilance" + ShieldCheck icon (13px)
  border: 1px solid rgba(14,165,233,0.3)
  bg: rgba(14,165,233,0.06), color:#0ea5e9
  radius:999px, font:0.8rem weight:600, letter-spacing:0.04em
  margin-bottom: 1.5rem

H1 (.wl-h1):
  "Know if your drugs"
  [gradient: "conflict — before"] ← <em> tag, no font-style
  "they reach you."
  Size: clamp(2.4rem,5.5vw,4rem), weight:900, letter-spacing:-0.035em
  Gradient: linear-gradient(110deg, #0ea5e9 0%, #8b5cf6 100%)
  -webkit-background-clip:text, -webkit-text-fill-color:transparent
  margin-bottom: 1.25rem

Subtitle (.wl-subtitle):
  "Evidence-based Drug-Drug Interaction analysis powered by Google Gemini AI.
   ADME tracking, organ toxicity profiles, CYP450 pathway analysis, and clinical
   alternatives — built for clinicians and patients alike."
  font-size: clamp(1rem,2.2vw,1.2rem), color:--text-muted, line-height:1.7
  max-width: 44rem, margin-bottom: 2rem

CTA row (.wl-cta-row):
  flex, flex-wrap, gap:0.875rem

  Primary button (.wl-btn-primary):
    "Check an Interaction →" + ArrowRight icon (18px)
    bg:#0ea5e9, radius:0.75rem, padding:0.875rem 1.75rem
    font-size:1rem, weight:700, color:#fff
    shadow: 0 0 24px rgba(14,165,233,0.25)
    onClick → signIn('google', {callbackUrl:'/'})
    hover: bg:#0284c7, translateY(-2px), shadow 0 0 36px rgba(14,165,233,0.35)

  Ghost button (.wl-btn-ghost):
    "See Features ↓" + ChevronDown icon (16px) → href="#features"
    border:1px solid #334155, bg:transparent, radius:0.75rem
    color:#94a3b8, font-size:1rem, weight:600
    hover: border#475569, color:#f8fafc, bg rgba(30,41,59,0.5)

Severity legend row (below CTAs):
  4 pills using SEVERITY_COLORS object:
    minor:           7px green dot + "Minor"
    moderate:        7px blue dot + "Moderate"
    major:           7px amber dot + "Major"
    contraindicated: 7px red dot + "Contraindicated"
  Each pill: inline-flex, padding:0.25rem 0.625rem, radius:999px
    bg and color from severity system
  Trailing label: "interaction severity scale" in #334155, 0.72rem

--- RIGHT COLUMN (.wl-hero-graphic, max-width: 480px) ---

Interactive DDI Demo Card (pure React, no external deps):
  bg:rgba(15,23,42,0.85), border:1px solid #334155, radius:1.25rem
  padding:1.75rem, backdrop-filter:blur(20px)
  shadow: 0 0 60px rgba(14,165,233,0.08), 0 25px 50px rgba(0,0,0,0.5)
  max-width:480px

  Tab switcher (3 example pairs):
    Warfarin + Aspirin / Metformin + Alcohol / Simvastatin + Clarithromycin
    Active tab: border rgba(14,165,233), bg rgba(14,165,233,0.1), color:#0ea5e9
    Inactive: border #334155, color:#94a3b8
    font:0.8rem weight:600, radius:6px, transition:all 0.2s

  Drug pair row:
    Drug 1 box: bg rgba(14,165,233,0.08), border rgba(14,165,233,0.25), radius:0.75rem
    Drug 2 box: bg rgba(139,92,246,0.08), border rgba(139,92,246,0.25), radius:0.75rem
    Label: 0.7rem, uppercase, letter-spacing:0.08em, color:#64748b, margin-bottom:0.2rem
    Value: 1rem, weight:700, color:#f8fafc
    Center: "⇄" in #334155

  Severity badge:
    Same severity system (pill anatomy above)
    Right side shows CYP label string (e.g. "CYP2C9 substrate competition")
      font-size:0.75rem, color:#64748b

  Mechanism box:
    bg:rgba(2,6,23,0.5), border:rgba(51,65,85,0.5), radius:0.625rem
    padding:0.875rem, margin-bottom:1.25rem
    Label: 0.7rem uppercase; Text: 0.875rem, color:#cbd5e1, line-height:1.5

  Toxicity bars section:
    Label row: "Combined Toxicity Risk" — 0.7rem uppercase, #64748b
    4 rows: Cardiac / Hepatic / Renal / Neuro
    Each row: label(50px right-aligned, 0.72rem #94a3b8) + track + value(28px, #64748b)
    Track: h:6px, bg:rgba(51,65,85,0.6), radius:999px, overflow:hidden
    Fill: colored per organ, width=value%, transition:width 0.6s ease
    Gap between rows: 0.5rem

Scroll hint (absolute bottom-2rem, centered):
  "Scroll" + ChevronDown, color:#334155, 0.75rem
  animation: bob 2s infinite (translateY 0→6px)
```

### 3.3 Stats Bar
```
class: .wl-section .wl-section-alt (bg rgba(15,23,42,0.45), side borders)
padding: 3.5rem 1.5rem

Grid (.wl-stats-grid):
  2 cols (mobile) → 4 cols (≥640px), gap: 2.5rem 3rem

4 stats (animated counter, trigger: IntersectionObserver 0.3):
  5000+ — "Drug profiles indexed"
  4     — "Toxicity systems tracked"
  100%  — "Evidence-based results"
  2     — "User roles: Pro & Patient"

Each stat:
  Counter: clamp(2rem,4vw,2.75rem), weight:800, color:#f8fafc, letter-spacing:-0.03em
  Label: 0.875rem, color:#64748b, margin-top:0.375rem, text-align:center
```

### 3.4 Features Grid
```
id="features"
class: .wl-section, padding:5rem 1.5rem

Section header:
  .wl-section-label: "Platform Capabilities" — 0.72rem, uppercase, #0ea5e9, letter-spacing:0.12em
  .wl-section-title: clamp(1.75rem,3.5vw,2.4rem), weight:800, -0.03em
  .wl-section-desc: #64748b, 1.05rem, line-height:1.7, max-width:44rem

Grid (.wl-feature-grid):
  1 col → 2 col (≥640px) → 3 col (≥1024px)
  gap:1.25rem, margin-top:3rem

Feature card (.wl-feature-card):
  padding:1.75rem, radius:1rem
  border:1px solid #1e293b, bg:rgba(15,23,42,0.6)
  position:relative, overflow:hidden
  Hover: border-color rgba(14,165,233,0.35), translateY(-3px)
  ::before (hover glow): radial-gradient at top-left, opacity 0→1

  Icon wrapper (.wl-feature-icon): 2.75rem square, radius:0.625rem, margin-bottom:1.25rem
  Title (.wl-feature-title): 1.05rem, weight:700, color:#f8fafc
  Desc (.wl-feature-desc): 0.9rem, color:#64748b, line-height:1.6

  Primary card (DDI): border:rgba(14,165,233,0.25) override
    "Core Feature" badge: position:absolute top:0.875rem right:0.875rem
      bg:rgba(14,165,233,0.1), color:#0ea5e9, 0.65rem uppercase, radius:999px

6 cards in order:
  1. DDI + CYP450 Analysis  icon:Dna      bg:rgba(14,165,233,0.12) color:#0ea5e9  [PRIMARY]
  2. ADME Scoring           icon:Brain    bg:rgba(139,92,246,0.12) color:#8b5cf6
  3. Organ Toxicity Profiles icon:AlertTriangle bg:rgba(239,68,68,0.12) color:#ef4444
  4. Prescription OCR       icon:Scan     bg:rgba(16,185,129,0.12) color:#10b981
  5. Personalized Health Tips icon:Lightbulb bg:rgba(245,158,11,0.12) color:#f59e0b
  6. Interaction History    icon:Clock    bg:rgba(51,65,85,0.5)   color:#94a3b8
```

### 3.5 Product Showcase
```
class: .wl-section .wl-section-alt, padding:4rem 1.5rem 6rem

Section header: same pattern (label: "Product Walkthrough", title: "See it in action")

4 rows (.wl-showcase, gap:6rem):
  Layout per row (.wl-showcase-row):
    flex column (mobile) → flex row (≥900px, gap:4rem)
    Even rows: flex-direction:row-reverse on desktop
    Each .wl-showcase-col: flex:1, width:100% mobile / 50% desktop

  Text column anatomy:
    .wl-showcase-label: 0.7rem uppercase #0ea5e9 letter-spacing:0.1em
    .wl-showcase-title: clamp(1.4rem,2.5vw,1.875rem) weight:800 -0.025em color:#f8fafc
    .wl-showcase-desc:  1rem, color:#64748b, line-height:1.75

  Image column anatomy (.wl-showcase-img-wrap):
    radius:0.875rem, overflow:hidden, border:1px solid #1e293b, bg:#0f172a
    shadow: 0 20px 60px rgba(0,0,0,0.5)
    hover: translateY(-6px) scale(1.015), border-color rgba(14,165,233,0.4)
    transition: 0.4s cubic-bezier(0.16,1,0.3,1)
    img: width:100%, height:auto, display:block

Rows:
  Row 1 (text-left): "Intelligent DDI Analysis"
    Label: "Primary Feature"
    Tag pills below desc: "CYP450 pathways" / "ADME overlap" / "Dose thresholds" / "Alternatives"
      Each: border:1px solid #334155, color:#64748b, radius:999px, 0.78rem
    Image: /assets/images/DDI_checks.png

  Row 2 (text-right, image-left): "Prescription Scanning"
    Label: "OCR Feature"
    Image: /assets/images/Priscription_scan.png

  Row 3 (text-left): "Personalized Health Tips"
    Label: "Wellness Feature"
    Image: /assets/images/Health_tips.png

  Row 4 (text-right, image-left): "Interaction History"
    Label: "Audit Trail"
    Image: /assets/images/History.png
```

### 3.6 Reviews Section
```
class: .wl-section, padding:5rem 1.5rem

Header: label "Trusted By", title "Built for clinicians and patients"

Grid (.wl-review-grid): 1 col → 3 col (≥768px), gap:1.25rem, margin-top:3rem

Review card (.wl-review-card):
  padding:1.5rem, radius:1rem, border:1px solid #1e293b, bg:rgba(15,23,42,0.5)

  Stars (.wl-stars): 5× Star (size 14, fill:currentColor, color:#f59e0b), gap:0.2rem
  Quote (.wl-review-text): 0.9rem, color:#94a3b8, line-height:1.7, italic, margin-bottom:1.25rem
  Name (.wl-review-name): 0.9rem, weight:700, color:#f8fafc
  Role (.wl-review-role): 0.78rem, color:#475569, margin-top:0.15rem

3 reviewers:
  Dr. Sarah Jenkins — Clinical Pharmacologist
  Mark T. — Patient
  Dr. Rajesh K. — General Physician
```

### 3.7 CTA Banner
```
class: .wl-section-alt, padding:5rem 1.5rem, text-align:center

Badge: CheckCircle icon + "Free to use"
Title: clamp(1.875rem,4vw,2.75rem), weight:800, margin-bottom:1rem
Desc: #64748b, 1.05rem, max-width:38rem, centered, margin-bottom:2rem
Button: same as hero primary, font-size:1.1rem, padding:1rem 2.25rem
  "Get Started — It's Free →" + ArrowRight (20px)
```

### 3.8 Welcome Footer
```
class: .wl-footer
bg: rgba(2,6,23,0.8), border-top:1px solid #1e293b, padding:2rem 1.5rem

Inner (.wl-footer-inner): flex column mobile → flex row desktop, gap:1.25rem
  Left:  "💊 Pharma DDI Checker" — weight:700, color:#f8fafc
  Center (.wl-footer-links):
    "Source on GitHub" (Code icon 14px) → GitHub repo, target:_blank
    "Privacy Policy"  → /legal/privacy
    "Terms of Service" → /legal/terms
    "Refund Policy"   → /legal/refund
    Each: .wl-footer-link — 0.85rem, color:#475569, hover:#94a3b8
  Right: "© {year} Pharma DDI Checker. Not a substitute for medical advice."
    0.78rem, color:#334155
```

---

## 4. Screen: `/` — Main DDI Checker (Authenticated)

### 4.1 Page Structure
```
Root: div.print-white-bg, bg:#02070b, position:relative

1. CinematicVisualLayer (fixed WebGL, isIdle prop controls screensaver intensity)
2. Idle vignette overlay (position:fixed, z-index:5, radial gradient vignette)
   opacity: isIdle ? 1 : 0, transition: 1.2s
3. Content wrapper (position:relative, z-index:10)
   opacity: isIdle ? 0.28 : 1, transition: 1.2s
4. AnalysisScanner overlay (z-index:50, shown during API call)
5. Print summary (hidden except when printing)
```

### 4.2 Hero Area (above drug search)
```
text-align:center, margin-bottom:2.5rem, padding-top:1.5rem

Icon: Pill (Lucide, size:48)
  color:--accent-primary, filter:drop-shadow(0 0 12px --accent-glow)

H1 (role-conditional):
  Pharmacologist → "Drug-Drug Interaction Checker"
  User           → "Aastha Health Assistant"

Subtitle (role-conditional, 1rem, --text-muted, max-width:550px):
  Pharmacologist → "Select two drugs to check for interactions, view ADME & toxicity charts..."
  User           → "Ask Aastha about your health, medications, or any medical questions..."
```

### 4.3 Drug Search UI (Pharmacologist mode only)
```
Container (.ddi-search-container):
  flex, gap:1rem, align-items:center, justify-content:center
  flex-wrap:wrap, max-width:900px, margin:0 auto

DrugSearchBox (×2):
  id: "drug-box-1" / "drug-box-2"
  class: .card, flex:1, min-width:280px, position:relative

  Label: 0.9rem, --text-muted, weight:500, margin-bottom:0.75rem

  Empty state:
    .input + "Select" btn-primary (appears when query≥1 char)
    .dropdown-menu (absolute, left:0, right:0):
      bg:--bg-card, border:1px solid --border, radius:8px
      shadow: 0 8px 24px rgba(0,0,0,0.5), max-height:280px, overflow-y:auto
      
      Drug result row (.dropdown-item):
        padding:0.75rem 1rem, cursor:pointer, hover:bg --bg-hover
        Name: 0.95rem weight:600
        Drug class: 0.78rem --text-muted, margin-top:0.15rem

      Custom drug row (always shown at bottom when query≥1):
        bg:rgba(99,102,241,0.08), color:--accent-primary, weight:600, 0.88rem
        "➕ Use "{query}" as custom drug"  |  "Press Enter ↵"
        hover: bg:rgba(99,102,241,0.16)

  Selected state:
    Drug display card: bg:--bg-hover, border-left:3px solid accentColor, radius:10px
      Name: 1.1rem, weight:700, accentColor (--chart-drug1 or --chart-drug2)
      Generic name: 0.8rem, --text-muted, margin-top:0.15rem
      Drug class: 0.75rem, --text-dim, margin-top:0.3rem
    "Change" button: .btn.btn-outline, width:100%, 0.85rem, margin-top:auto

Centre status indicator (.ddi-search-indicator):
  56×56px circle (40px on ≤768px)
  bg:--bg-main, border:1px solid --border

  States and classes:
    .indicator-pending: border:--border, bg:rgba(139,139,150,0.08)
      Icon: ArrowRightLeft (20px)
    .indicator-safe:    border:--success, bg:success-glow, pulseGreen animation
      Icon: CheckCircle (20px)
    .indicator-danger:  border:--danger, bg:danger-glow, pulseDanger animation
      Icon: AlertTriangle (20px)

Drug 1 accent: --chart-drug1 (#0ea5e9, blue)
Drug 2 accent: --chart-drug2 (#8b5cf6, violet)
```

### 4.4 Analyze Button
```
Appears: when drug1 AND drug2 selected AND no report AND not analyzing
class: btn btn-primary, fade-in animation
text-align:center, margin-top:1rem margin-bottom:1rem
font-size:1.05rem, padding:0.85rem 2.5rem
Icon: Microscope (20px) + "Check Interaction"
onClick → runAnalysis(drug1, drug2)
```

### 4.5 Error State
```
.card.fade-in, border-color:--danger, bg:rgba(239,68,68,0.06)
"Error:" in --danger + error message in --text-muted
```

### 4.6 AnalysisScanner Overlay
```
Position: covers viewport content area
bg:rgba(2,6,23,0.92), backdrop-filter:blur(8px)

Content (centered):
  Drug pair header: "{drug1.name} + {drug2.name}"
  
  4-step stepper (.stepper):
    Steps text:
      "Resolving drugs & loading evidence"
      "Analyzing CYP enzyme pathways"
      "Evaluating ADME & toxicity profiles"
      "Generating AI-powered report"
    
    Step states (.step):
      Inactive: opacity:0.4, color:--text-muted
      Active:   opacity:1, color:--text-main, .spinner on left
      Completed: opacity:1, color:--success, checkmark icon
    
    Stepper: updates every 2.5s via setInterval
  
  Cancel button: ghost style, text: "Cancel Analysis"
    onClick → abort AbortController, setError('Analysis cancelled by user.')
```

### 4.7 DDI Analysis Report
```
Container: ref=reportRef, scrollIntoView after report loads
Dose mode switcher (.dose-pill buttons):
  Normal / High Dose / Elderly
  Active (.dose-pill-active): bg:--accent-soft, border:--accent-primary, color:--accent-primary
    shadow: 0 0 8px --accent-glow

Report header card (.card):
  Severity-conditional style (getSeverityStyle()):
    contraindicated/major: border:--danger, bg:rgba(239,68,68,0.06)
    moderate: border:--warning, bg:rgba(245,158,11,0.06)
    minor/safe: border:--success, bg:rgba(16,185,129,0.06)
  
  Layout: flex row (left content + right gauge), align-items:center

  Left side:
    H2: "{Drug1.name} + {Drug2.name}" + Swap button
      Swap (.swap-btn): border:rgba(6,182,212,0.35), bg:rgba(6,182,212,0.07)
        color:--chart-drug2, 0.75rem weight:600
        hover: bg:rgba(6,182,212,0.15), shadow:0 0 10px rgba(6,182,212,0.2)
    
    Status badge (.status-badge):
      Appropriate class (status-safe/status-warning/status-danger)
      Icon: CheckCircle (safe) / AlertTriangle (moderate) / AlertOctagon (major) / XCircle (contraindicated)
    
    Executive summary paragraph (--text-muted, 1rem, line-height:1.6)
    
    Report actions (.report-header-actions):
      Print button: FileText icon, btn-outline, 0.85rem → triggerPrint()
      Reset button: btn-outline → handleReset()
      Swap button (drug re-analysis)

  Right side:
    RadialGauge (SVG, 130×130px):
      viewBox: "0 0 130 130"
      Track circle: cx:65, cy:65, r:54, stroke:rgba(255,255,255,0.05), strokeWidth:10
        strokeDasharray: ARC(270°) CIRC, transform:rotate(135 65 65)
      Value arc: same geometry, stroke:color-by-score
        strokeDashoffset: animates 1.4s cubic-bezier(0.25,0.8,0.25,1)
        filter: drop-shadow(0 0 8px <color>)
      Score number: x:65, y:60, fill:color, fontSize:22, weight:700
      "RISK SCORE" text: x:65, y:75, fill:rgba(255,255,255,0.35), fontSize:8.5, letterSpacing:1
      Gauge label below SVG: 0.65rem uppercase, letter-spacing:1.5px
        Text: CONTRAINDICATED / MAJOR RISK / MODERATE RISK / MINOR RISK / SAFE

Tab navigation (.tabs-container):
  bg:--bg-card, border:1px solid --border, radius:50px, padding:0.5rem
  margin-top:1.5rem, margin-bottom:2rem
  Tabs: Overview | ADME | Toxicity | Alternatives
  Active (.tab-pill-active): bg:--accent-primary, color:#fff
    shadow: 0 4px 15px --accent-glow
  Hover: color:--text-main, bg:rgba(255,255,255,0.05)
  Tab content: .tab-content → fadeSlideUp 0.5s animation

---

TAB: Overview
  .report-section cards (bg:rgba(14,20,32,0.90), border:rgba(255,255,255,0.09), radius:14px):
    h3 inside: color:--accent-primary, 1.1rem

  Interaction Mechanisms:
    .mechanism-card per mechanism:
      bg:rgba(255,255,255,0.05), radius:10px, border-left:3px solid --accent-primary
      backdrop-filter:blur(8px)
      Type badge + Explanation + Evidence string

  Clinical Significance: prose paragraph

  Potential Consequences: bulleted list (--text-muted)

  Monitoring Parameters:
    .monitoring-card per parameter (same style as mechanism-card)
    Parameter name / Reason / Frequency

  Dose Risk: dangerousDoseThreshold + safeCoAdminGuidance + adjustment flag

  Demographic Effects: grid of named sections
    pediatric / geriatric / maleSpecific / femaleSpecific / pregnancyLactation
    hepaticImpairment / renalImpairment

  Evidence Assessment + Source IDs:
    .source-item chips per source: 0.8rem, bg:rgba(255,255,255,0.06), radius:6px

  Limitations: bulleted list

---

TAB: ADME (ADMEChart component)
  .chart-container: bg:rgba(14,20,32,0.90), backdrop-filter:blur(14px)
    border:rgba(255,255,255,0.1), radius:8px, shadow:0 4px 20px rgba(0,0,0,0.4)
  
  Title: "ADME Comparison" + Beaker icon (20px)

  4 chart rows: Absorption / Distribution / Metabolism / Excretion
    .chart-label (90px): 0.78rem, --text-muted, text-align:right, weight:500
    .chart-bars: flex column, gap:4px
      Drug1 bar: gradient rgba(99,102,241,0.6) → #0ea5e9
      Drug2 bar: gradient rgba(6,182,212,0.6) → #8b5cf6
      Track: h:14px, bg:rgba(255,255,255,0.03), radius:7px
      Fill: animates on IntersectionObserver
    .chart-value: 0.7rem, --text-dim, width:32px, two lines (d1 / d2)

  Legend: Drug1 dot (#0ea5e9) + Drug2 dot (#8b5cf6)

---

TAB: Toxicity (3 components stacked)

  1. DosageToxicityChart:
    Title: "☠️ Adjusted Toxicity Profile"
    5 rows: Hepatic / Renal / Cardiac / Neuro / Hemato
    Values multiplied by doseMode:
      normal:1.0 / high:1.5 / elderly:1.25 (capped at 100)
    Bar color by adjusted value:
      ≤30 → toxicity-low (gradient green)
      ≤60 → toxicity-moderate (gradient amber)
      >60  → toxicity-high (gradient red)

  2. RadarChart (pure SVG):
    200×200px viewBox, maxWidth:260px
    5 axes: hepatic, renal, cardiac, neuro, hemato
    Starts from top, clockwise (angle = 2π·i/5 − π/2)
    4 concentric rings at 25/50/75/100%:
      stroke:rgba(255,255,255,0.06), strokeWidth:1
    Axis lines: rgba(255,255,255,0.08)
    Axis labels: 8.5px, rgba(255,255,255,0.45), dominant-baseline:middle
    Drug1 polygon: fill:#6366f1 opacity:0.18, stroke:#818cf8 strokeWidth:2
      filter:drop-shadow(0 0 6px #818cf8)
    Drug2 polygon: fill:#06b6d4 opacity:0.18, stroke:#22d3ee
    Vertex dots: r:3, fill:stroke-color, glow filter
    All animate from origin via progress float (0→1), 1.2s cubic-bezier
    Legend: Drug1 dot #818cf8 / Drug2 dot #22d3ee

  3. OrganToxicityAnatomy:
    SVG/HTML anatomical body diagram
    Organ hotspots clickable (highlights organs with elevated toxicity)

---

TAB: Alternatives
  2–3 .alt-card blocks:
    bg:--bg-hover, border:1px solid --border, radius:10px, padding:1rem 1.25rem
    hover: border-color:--success (transition 0.2s)
    
    Alt drug name (.alt-name): --success color, weight:600, 1rem
    Risk badge (.alt-risk): 0.78rem, padding:0.2rem 0.5rem, radius:4px
    Rationale text: --text-muted, 0.9rem

    "Quick-Swap ⇄" button:
      onClick → handleSwap(altName) — fetches drug, sets as Drug2, re-runs analysis
```

### 4.8 User Mode (Patient)
```
Aastha chat rendered inline:
  <AasthaChat inline={true} forceOpen={true} />
  max-width:800px, centered
  Same chat UI as floating panel but embedded in page flow
```

---

## 5. Screen: `/onboarding`

### 5.1 Structure
```
Multi-step form with URL param ?step=N
Step 0: Role selection (entry point for new users)
Steps 1–N: Profile fields
```

### 5.2 Step 0 — Role Selection
```
Two option cards:
  Patient / User:       casual health assistant mode
  Pharmacologist / Pro: full clinical DDI + ADME access

Card selected state: --accent-primary border highlight
user_role stored: 'user' | 'pharmacologist'
```

### 5.3 Profile Form Fields
```
display_name    text input
age             number input
gender          select: Male / Female / Other
blood_group     select: A+/A-/B+/B-/AB+/AB-/O+/O-

underlying_diseases — tag input + quick-add chips:
  Presets: Diabetes, Hypertension, Asthma, Heart Disease, COPD,
           Thyroid, Kidney Disease, Liver Disease, Epilepsy, Arthritis

allergies          — tag input (free text)
current_medications — tag input (free text)
medical_history    — textarea
emergency_contact  — text input

Female-only:
  last_menstruation_date — date input
  Menstruation Details modal (MenstruationDetailsForm)

consent_accepted — checkbox (required)
```

### 5.4 Tag Input Pattern
```
Text field + "Add" button
Tags display as pills: text + × remove button
Chip: bg:--bg-hover, border:--border, radius:999px, padding:0.25rem 0.625rem
      color:--text-main, 0.8rem
× button: color:--text-muted, hover:--danger
```

### 5.5 Navigation
```
Back / Next buttons between steps
Progress indicator: numeric step badges
Save: btn-primary + loading spinner
Redirect to / on save (or back to profile if editing)
```

---

## 6. Screen: `/history`

### 6.1 Layout
```
CinematicBackground component (simpler WebGL, no parallax)
page-container, max-width:1100px

Tab row (.tabs-container):
  Pharmacologist: "DDI Checks" tab + "Prescription Scans" tab
  Patient (user): "Prescription Scans" tab only (default)
```

### 6.2 DDI Checks Tab
```
Each record:
  .card (bg:--bg-card, border --border)
  Header: "{Drug1} + {Drug2}" (weight:700) + timestamp (Clock icon, 0.8rem, --text-muted)
  Score badge (severity-appropriate color)
  Affected organs list (comma-separated)
  Executive summary snippet

  Action row:
    "Re-check" (Microscope icon, btn-outline):
      Stores {drug1, drug2, report} in sessionStorage 'history_report'
      Navigates to /
    "Delete" (Trash2 icon, btn-outline --danger color):
      Opens CustomDialog confirm modal
      On confirm: DELETE /api/history?id=<id>
    Expand icon (Maximize2): toggles inline full report view

Expanded view:
  Full report JSON rendered inline
  X button to collapse
  Same report structure as main page report (minus RadialGauge)
```

### 6.3 Prescription Scans Tab
```
Each record:
  Prescription image thumbnail (if available)
    Click → full-screen modal
  Detected drug names as tag chips
  Timestamp

Image modal:
  Fixed overlay (rgba(0,0,0,0.9)), z-index:200
  Centered: full image + drug names below
  X close button (top-right)
```

### 6.4 Empty / Error States
```
Empty: AlertCircle icon + "No records found" text, centered
Error: red-bordered card with error message
Loading: spinner centered
```

---

## 7. Screen: `/health-tips`

### 7.1 Data
```
Source: /api/tips (cached) or /api/tips/generate (Gemini AI, uses user profile)
Schema from TIPS_SYSTEM_PROMPT:
  randomTips[5]       – general tips
  dietPlan[5]         – nutrition cards
  dietRestrictions[4] – warning cards
  medicalTips[4]      – medication safety cards
```

### 7.2 Card Layout
```
4 sections displayed as card grids
Each tip card:
  Priority dot: 1=green / 2=amber / 3=red
  Category badge chip: nutrition/exercise/medication/lifestyle/hydration/sleep/monitoring/safety/general
  Title: weight:600, --text-main
  Content: --text-muted, 0.9rem, line-height:1.6
```

---

## 8. Screen: `/skincare`

### 8.1 Layout
```
Full-page, 42.6kB bundle (largest feature page)
Split: conversation area + optional sidebar
```

### 8.2 Chat Interface
```
Based on DERMA_SYSTEM_PROMPT
Conversation history as chat bubbles (same pattern as Aastha)
Input: textarea + send button

Response structure shown per turn:
  answer: main text (in assistant bubble)
  safetyWarning: amber-bordered warning card if present
    border:--warning, bg:rgba(245,158,11,0.08)
  recommendedProducts: tag list of OTC ingredient suggestions
    Each: chip style, bg:rgba(16,185,129,0.1), color:--success

Profile cross-reference: reads current_medications + underlying_diseases
  (medications like Doxycycline trigger photosensitivity warning in safetyWarning)
```

---

## 9. Screen: `/cycle-tracker`

### 9.1 Visibility
```
Nav link shown only when userGender === 'female'
```

### 9.2 Layout
```
page-container
Calendar or log view (menstrual cycle)
MenstruationDetailsForm for detailed input
APIs: /api/cycle/analyze + /api/cycle/predict-patterns
Pattern predictions displayed as cards
```

---

## 10. Screen: `/reminders`

### 10.1 Layout
```
page-container
CRUD list of medication reminders
GlobalReminder component handles push notifications
```

### 10.2 Reminder Card
```
Medication name + dose
Scheduled time (Bell icon)
Toggle active/inactive
Delete button (contained within card using flex-wrap:wrap on action row)
```

---

## 11. Screen: `/profile`

### 11.1 Profile Header Card
```
.card with bg: linear-gradient(to right, rgba(99,102,241,0.1), transparent)
flex row, gap:1.5rem, align-items:center

Avatar: 80×80px circle, border:2px solid --accent-primary
Name (h2) + email (--text-muted)
Role badge chip
"Edit Profile" → /onboarding button
```

### 11.2 Info Sections
```
Grid of .card sections, each with Lucide icon header:

  User info:      display_name, age, gender, blood_group (Droplets icon)
  Medical:        underlying_diseases (AlertTriangle for allergies section)
  Medications:    current_medications list (Pill icon)
  Cycle (female): last_menstruation_date (Calendar icon)
  Emergency:      emergency_contact (Phone icon, ShieldAlert)
  History text:   medical_history (FileText icon)

Voice Language section (Mic icon):
  Dropdown of supported STT/TTS languages (from lib/voice.ts LANGUAGES)
  Save button → PUT /api/user/language
  isLoadingLang spinner state

Danger zone (bottom of page):
  "Delete Account" — red-bordered card
  CustomDialog confirm before deletion
```

---

## 12. Screen: `/feedback`
```
page-container
Star rating input (1–5)
Text area for feedback
Submit → POST /api/feedback
Success state + reset
```

---

## 13. Screen: `/admin/feedbacks`
```
Access guard: session email must === 'pharmaddichecker.app@gmail.com'
Otherwise: redirects to /

page-container
Table/list of all feedback entries via GET /api/admin/feedbacks:
  user email | star rating | feedback text | timestamp
Sorted by newest first
```

---

## 14. Auth / Error Pages

### `/auth/error`
```
1kB, minimal page
NextAuth error display
"Return to Home" button
```

---

## 15. Aastha AI Chat (`src/components/AasthaChat.tsx`)

### 15.1 Trigger Button
```
position:fixed, bottom:2rem, right:2rem, z-index:100
56×56px circle (.aastha-trigger-btn)
bg: linear-gradient(135deg, --accent-primary, --accent-hover)
shadow: 0 8px 24px --accent-glow
hover: scale(1.08) translateY(-2px), shadow:0 12px 28px rgba(99,102,241,0.3)
Icon: Bot or MessageCircle (Lucide)
```

### 15.2 Panel (.aastha-panel)
```
Desktop: position:fixed
  bottom: calc(2rem + 64px + 10px)
  right: 2rem
  width: 380px, height: 600px, max-height: calc(100vh - 120px)

Mobile (≤600px): bottom sheet
  top:auto, right:0, width:100%
  height: calc(var(--vv-height, 100vh) * 0.9)
  border-radius: 24px 24px 0 0
  box-shadow: 0 -8px 40px rgba(0,0,0,0.5)

bg:--bg-card, border:1px solid --border, radius:16px
shadow: 0 16px 40px rgba(0,0,0,0.4), z-index:100
Entry animation: slideUpFade 0.3s cubic-bezier(0.16,1,0.3,1)
```

### 15.3 Panel Header (.aastha-header)
```
padding:1rem 1.25rem, border-bottom:1px solid --border
bg:rgba(19,19,22,0.95)
flex row: left info + right controls

Left:
  Name: "Aastha" — weight:600, 1.1rem, white
  Online status dot (green)
  Voice language badge (.aastha-voice-lang-badge):
    color:rgba(0,200,255,0.8), bg:rgba(0,200,255,0.1)
    border:1px solid rgba(0,200,255,0.2), radius:6px, 0.7rem
  Subtitle: 0.75rem, --text-muted ("Pharmacology AI Assistant")

Right:
  Change language button (.aastha-voice-change-lang): 28×28px, radius:8px
  Close button (.aastha-close): hover:bg --bg-hover
```

### 15.4 Messages Area (.aastha-messages)
```
flex:1, overflow-y:auto, padding:1rem, flex-direction:column, gap:1rem

Message bubbles (.aastha-message):
  max-width:85%, padding:0.75rem 1rem, radius:8px
  font-size:0.9rem, line-height:1.5, word-wrap:break-word

  .assistant: bg:--bg-hover, border:1px solid --border, align-self:flex-start
    border-bottom-left-radius:4px

  .user: bg:--accent-soft, border:1px solid --accent-glow, color:white, align-self:flex-end
    border-bottom-right-radius:4px

Thinking indicator (.aastha-thinking):
  "Aastha is thinking..." dots animation
  opacity pulse 0.5↔1, 1.5s infinite

Confidence badge (on assistant messages): color by confidence level
```

### 15.5 Quick Chips (.aastha-chips)
```
flex-wrap:wrap, gap:6px, padding:0 1rem 0.75rem
Shown as contextual suggestion shortcuts

.aastha-chip:
  bg:--bg-hover, border:1px solid --border
  color:--text-main, padding:6px 12px, radius:20px, 0.8rem
  hover: bg:--border, border-color:--text-muted
```

### 15.6 Input Area (.aastha-input-area)
```
padding:1rem, border-top:1px solid --border, bg:--bg-card
flex row, gap:8px

Text input (.aastha-input):
  flex:1, bg:--bg-input, border:--border, color:white
  padding:10px 12px, radius:8px, 0.9rem
  focus: border-color:--accent-primary

Voice button (.aastha-voice-btn):
  36×36px, radius:10px
  border:1.5px solid rgba(0,200,255,0.3), bg:rgba(0,200,255,0.08)
  color:rgba(0,200,255,0.85)
  hover: bg:rgba(0,200,255,0.18), border:rgba(0,200,255,0.6)
    shadow:0 0 12px rgba(0,200,255,0.25), scale(1.06)
  Recording state: glow + scale animation

Send button (.aastha-send-btn):
  40px width, bg:--accent-primary, radius:8px, white color
  hover: bg:--accent-hover
  disabled: opacity:0.5, cursor:not-allowed
```

### 15.7 Language Selection Screen
```
Shown when changing voice language
.aastha-lang-select: centered flex column, padding:1.25rem
.aastha-lang-grid: 2 columns, max-width:280px, gap:0.5rem
  Language cards: native script name + ISO code
  Selected: --accent-primary highlight
```

---

## 16. Modal Components

### CustomDialog
```
Fixed overlay: rgba(0,0,0,0.7), z-index:1000
Centered panel: bg:--bg-card, border:--border, radius:14px, shadow
Title: weight:700, --text-main
Message: --text-muted
Buttons:
  type='alert':   OK → btn-primary
  type='confirm': Cancel (btn-outline) + Confirm (btn-primary or --danger color)
```

### MedCheck Modal (Header Prescription Scanner)
```
Full-screen overlay
Contains PrescriptionScanner component
Dispatches 'pharma-check-interaction' CustomEvent with {drug1, drug2}
→ main page listens and auto-runs analysis
```

### FoodCheck Modal (Header Food Check)
```
Slide-in panel or overlay
FoodCheck component
Drug-food interaction checker
```

---

## 17. Print Mode

### 17.1 Trigger
```
JS: document.body.classList.add('is-printing') + setTimeout(window.print, 50)
Cleanup: afterprint event removes class
```

### 17.2 Layout
```
@media print + body.is-printing:
  Hide: header, canvas, .print-hide, .tabs-container, .drug-search-box,
        .btn, nav, footer, .aastha-chat-wrapper, .report-header-actions

  Show: .print-summary-container (PrintSummary component)

PrintSummary output:
  White background, black text (#111), Arial 11pt
  Bar fills forced: drug1 #6366f1, drug2 #06b6d4 (print-color-adjust:exact)
  No shadows, no backdrop-filter, no animation
  Sections: drug pair, severity, executive summary, mechanisms, alternatives
```

---

## 18. PWA Configuration

```
manifest.json: public/manifest.json (already exists)
icon: public/icon-512.jpg
apple-touch-icon: same
apple-mobile-web-app-capable: true
apple-mobile-web-app-status-bar-style: black-translucent
theme-color: #020617

Install flow:
  PWAInstallButton in header (desktop only)
  Shown only when 'beforeinstallprompt' fires
  onClick → prompt.prompt()
```

---

## 19. SEO Layer

```
layout.tsx (Static Metadata API):
  title: "Pharma DDI Checker | AI-Powered Drug Interaction Analysis"
  description: "Check drug-drug interactions with AI-powered analysis..."
  keywords: DDI, Drug-Drug Interaction, Pharmacology, Healthcare AI, Medication Safety, ADME...
  metadataBase: https://pharma-ddi-checker-1.onrender.com

  openGraph:
    type: website
    image: /assets/images/DDI_checks.png (1200×630)
    siteName: "Pharma DDI Checker"

  twitter:
    card: summary_large_image
    image: /assets/images/DDI_checks.png

sitemap.xml (/src/app/sitemap.ts):
  /welcome     priority:1.0 changeFreq:monthly
  /            priority:0.9 changeFreq:daily
  /health-tips priority:0.8 changeFreq:daily
  /skincare    priority:0.8 changeFreq:weekly
  /cycle-tracker priority:0.7 changeFreq:weekly
  /history     priority:0.6 changeFreq:weekly
  /reminders   priority:0.6 changeFreq:daily

robots.txt (/src/app/robots.ts):
  Allow: /
  Disallow: /api/, /admin/
  Sitemap: https://pharma-ddi-checker-1.onrender.com/sitemap.xml

humans.txt: public/humans.txt (developer credit file)
```

---

## 20. Asset Inventory

```
public/
  icon-512.jpg                   PWA icon + favicon + OG fallback
  manifest.json                  PWA manifest
  humans.txt                     Developer credit
  assets/
    images/
      DDI_checks.png             Feature screenshot: main DDI dashboard (OG image)
      Priscription_scan.png      Feature screenshot: prescription OCR
      Health_tips.png            Feature screenshot: health tips page
      Skincare_ai.png            Feature screenshot: skincare AI chat
      History.png                Feature screenshot: history log
    3d_components/
      3DLogoSpin.glb             3D logo model (not active in main branch)
```

---

## 21. Technical Architecture

```
Framework:    Next.js 14.2.35 (App Router)
Auth:         NextAuth.js — Google OAuth provider
Database:     Neon (PostgreSQL) — users, profiles, history, reminders, feedbacks
AI:           Google Gemini (gemini-2.0-flash) — DDI analysis, Aastha, OCR, tips, skincare, cycle
Deployment:   Render.com (render.yaml)

Route types (from build output):
  ƒ Dynamic:  /, /welcome, /history, /health-tips, /skincare, /reminders,
              /profile, /onboarding, /cycle-tracker, /feedback, /admin/feedbacks,
              /auth/error, /legal/*
  ○ Static:  /robots.txt, /sitemap.xml

AI Provider pools (NEVER cross-contaminate):
  DDI pool:  /api/analyze (buildAnalysisPrompt)
  OCR pool:  /api/prescription (vision model)
  Chat pool: /api/ai/aastha (buildAasthaPrompt)
  Tips pool: /api/tips/generate (TIPS_SYSTEM_PROMPT)
  Derma pool:/api/derma/chat (DERMA_SYSTEM_PROMPT)
  Ask pool:  /api/ask (ASK_SYSTEM_PROMPT)
  Cycle pool:/api/cycle/analyze

Session cache:
  localStorage key: 'pharma_ddi_session_{email}'
  Stores: {drug1, drug2, report}
  Restored on authenticated page load
  Cleared on: reset, account switch, user change drug
```

---

## 22. Critical Constraints

> Hard rules derived from user decisions and codebase architecture.

1. **No Tailwind CSS** — Vanilla CSS only. All classes are custom-defined in globals.css.

2. **No cross-contamination of AI pools** — DDI → DDI pool. OCR → OCR pool. Never share providers between feature types.

3. **No new feature addition** — Existing UI and features must not be redesigned or extended without explicit instruction.

4. **CinematicVisualLayer is untouchable** — Never wrap its parent in CSS `filter`, `backdrop-filter`, `perspective`, or `transform`. These force a new compositing layer, destroying WebGL performance.

5. **Aastha knowledge boundary** — Post-analysis: answers from report context only for DDI questions. Pre-analysis: general pharmacology allowed. Emergency guardrail: redirect to emergency services.

6. **Admin identity** — `pharmaddichecker.app@gmail.com` only. Not configurable via UI.

7. **Session state guard** — Always show loading state while `sessionStatus === 'loading'`. Never flash unauthenticated UI for authenticated users.

8. **Severity vocabulary** — Always use exact enum values from prompts.ts: `minor`, `moderate`, `major`, `contraindicated`. Never invent new levels.

9. **Do not prescribe** — AI responses must never prescribe medications, alter dosages, or make patient-specific treatment decisions.

10. **Evidence boundary** — "DO NOT interpret absence of an interaction record as proof of safety."
