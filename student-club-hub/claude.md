# Student Club Hub — Project Rules (`claude.md`)

Student Club Hub is a **local High School Club Directory MVP**. It helps students
discover clubs at their school, favorite the ones they like, join them, and
contact club leaders. It is **not** a fundraising or payment platform — all
monetary features have been intentionally removed and must not be reintroduced.

---

## 1. Tech Stack Constraints

- **Pure Vanilla only.** HTML5, CSS3, and JavaScript (ES6+). No frameworks, no
  build step, no bundler, no transpiler.
- **No external dependencies / no CDNs.** No Tailwind, no Bootstrap, no Font
  Awesome, no jQuery, no Google Fonts fetch. Icons are Unicode/emoji or inline
  SVG. The app must run fully offline from `file://` or any static host.
- **Persistence is `localStorage` only.** No backend, no database, no network
  calls, no cookies. All state (accounts, sessions, favorites, joined clubs,
  user-created clubs) lives in `localStorage`.
- **Scripts load as plain classic scripts** (not ES modules), in a fixed order
  (`auth → directory → modal → profile`) so they share one global scope. Keep
  cross-file calls to clearly named global functions.

## 2. File Structure & Size Limits

| File | Responsibility |
|------|----------------|
| `index.html` | Clean HTML skeleton only — **strictly under 500 lines**. Markup shells + script/style includes. Repetitive UI is rendered by JS. |
| `styles/main.css` | All global styles: palette tokens, layout grids, cards, buttons, badges, modals + glassmorphism filters. |
| `scripts/auth.js` | User state, login, signup, logout, invite credentials (member IDs), session persistence, header auth area. Also hosts shared helpers (`showView`, `toast`, `escHtml`). |
| `scripts/directory.js` | Club data, club-card rendering, category filtering, search, club creation & settings. |
| `scripts/modal.js` | Full-page Club Detail view (About/Manage tabs, ranked roster, socials, chat w/ edit-delete-permissions, owner transfer/delete, member-only reviews), image lightbox, and shared overlays (contact, review, transfer, confirm). |
| `scripts/profile.js` | Public user profiles, Saved-clubs lists, and the multi-tab Account Settings interface. |
| `scripts/schools.js` | Pre-populated LA-County high-school directory + district mapping (data + option builders). Loaded first. |
| `scripts/qr.js` | Self-contained offline QR-code generator (byte mode, EC level L, v1–5) for the Share Club modal. Loaded first. |

- **Maximum 1,000 lines per file module.** If a module approaches the limit,
  extract a new module rather than growing past it.
- **Component extraction:** reusable UI (Club Card, Badge, Modal shell, Header
  Nav, Avatar) must be shared JS rendering functions — never copy-pasted markup.

## 3. Design & Palette Standards

**Brand palette** (defined once as CSS custom properties on `:root`):

| Token | Value | Use |
|-------|-------|-----|
| `--brand` | `#6366f1` | Primary indigo (buttons, links, accents) |
| `--brand-dark` | `#4f46e5` | Hover/active primary |
| `--brand-50` | `#eef2ff` | Tinted fills, chips |
| `--star` | `#fbbf24` | Favorite ★ (amber) |
| `--join` | `#10b981` | Join Club (emerald) |
| `--ink` | `#111827` | Primary text |
| `--muted` | `#6b7280` | Secondary text |
| `--line` | `#e5e7eb` | Borders/dividers |
| `--bg` | `#f8fafc` | Page background |
| `--card` | `#ffffff` | Card/surface background |

**Modals — dark glassmorphism:** overlays use a translucent dark scrim plus a
real blur — `background: rgba(17, 24, 39, 0.55); backdrop-filter: blur(8px);`.
The modal card itself is an opaque white surface. Clicking the scrim (outside
the card) dismisses the modal; `Esc` also closes. (Applies to the auth, contact,
review, transfer, and confirm overlays — the Club Detail is a full page, not an
overlay, so it never closes on an outside click.)

**Border-radii (consistent):** `--r-sm: 8px` (chips/inputs), `--r: 14px`
(cards/buttons), `--r-lg: 22px` (modal cards), `--r-pill: 999px` (pills/avatars).

**Interaction rules:**
- The top-left "Student Club Hub" logo always returns to the home directory.
- Club modal close (`✕`) and favorite (`★`) controls stay floating/sticky at the
  top of the modal while its content scrolls.

## 4. Scope Guardrails (MVP)

**Terminology:** the bookmarking action is always **"Save" / "Saved"**
(never "Favorite") across tabs, buttons, and profile lists.

**In scope:** browse/search/filter directory (by zip, school, district),
top-clubs spotlight, club profile modal + gallery lightbox, save clubs, join
club, contact leader, club + website reviews, public user profiles, multi-tab
account settings, club creation with media, owner management (edit details,
media, officer roles), club chat & announcements, accounts + invite credentials.

**Out of scope — do not add:** donations, fundraisers, campaigns, progress
bars, goal/rocket visualizers, donor leaderboards/podiums, donor activity
feeds, Stripe/payout/bank fields, shoutouts, or any money movement or pricing.

## 5. Conventions

- Escape all user-supplied strings before injecting into HTML (`escHtml`).
- Guard DOM lookups (`el && ...`) so a missing element never throws.
- One responsibility per function; name functions for what they render/do.
- Keep `localStorage` keys namespaced with the `sch_` prefix.
