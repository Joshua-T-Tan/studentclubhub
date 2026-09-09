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
  Awesome, no jQuery. Icons are Unicode/emoji or inline SVG. Two deliberate
  exceptions (see next bullet): the Supabase Auth OTP `fetch` and the Google
  Fonts stylesheet (Space Grotesk + Inter, MP31) — both degrade gracefully to
  system fonts / an error toast if offline, so the rest of the app still runs
  from `file://` or any static host.
- **Persistence is `localStorage` only.** No backend, no database, no cookies.
  All state (accounts, sessions, favorites, joined clubs, user-created clubs)
  lives in `localStorage`.
- **One deliberate network exception: email OTP.** `scripts/supabase.js` calls
  Supabase Auth (`/auth/v1/otp` + `/auth/v1/verify`) via plain `fetch` to email
  and verify the 6-digit sign-up / 2FA code — no SDK, no CDN. The publishable key
  is public by design. Only the code round-trips; accounts still live in
  `localStorage`. This means auth needs a network connection (it no longer works
  fully offline); everything else still does. Do not "restore" the on-screen demo
  code — it was intentionally removed.
- **Scripts load as plain classic scripts** (not ES modules), in a fixed order
  (`auth → directory → modal → profile → pages`) so they share one global scope.
  Keep cross-file calls to clearly named global functions.

## 2. File Structure & Size Limits

| File | Responsibility |
|------|----------------|
| `index.html` | Clean HTML skeleton only — **strictly under 500 lines**. Markup shells + script/style includes. Repetitive UI is rendered by JS. |
| `styles/main.css` | Core global styles: palette tokens, dark theme, reset, header/nav, buttons, badges, forms, directory cards, club-detail. |
| `styles/pages.css` | Page-specific layouts: homepage hero + carousel, feature (polygon) cards, testimonials, Top Clubs spotlight, and the standalone About-Us pages (Our Philosophy / How It Works / FAQ) + shop scaffolds. Loaded after main.css. |
| `styles/components.css` | Reusable overlay widgets: modal/overlay shells, auth modal, lightbox, confirm dialog, toast, share modal. Loaded after main.css. |
| `scripts/auth.js` | User state, login, signup, logout, invite credentials (member IDs), session persistence, header auth area. Also hosts shared helpers (`showView`, `toast`, `escHtml`). |
| `scripts/directory.js` | Club data, club-card rendering, category filtering, search, club creation & settings. |
| `scripts/modal.js` | Full-page Club Detail view (About/Manage tabs, ranked roster, socials, chat w/ edit-delete-permissions, owner transfer/delete, member-only reviews), image lightbox, and shared overlays (contact, review, transfer, confirm). |
| `scripts/profile.js` | Public user profiles, Saved-clubs lists, and the multi-tab Account Settings interface. |
| `scripts/pages.js` | Header dropdown nav + mobile menu, hero carousel, Contact Us overlay, the "Our Purpose"/Philosophy page, homepage FAQ accordion, and the Local-Business shop scaffold views. Loaded last. |
| `scripts/schools.js` | Pre-populated LA-County high-school directory + district mapping (data + option builders). Loaded first. |
| `scripts/qr.js` | Self-contained offline QR-code generator (byte mode, EC level L, v1–5) for the Share Club modal. Loaded first. |
| `scripts/supabase.js` | Minimal Supabase Auth email-OTP client (`sbSendOtp`/`sbVerifyOtp`) via plain `fetch`. Holds the public project URL + publishable key. Loaded before auth.js. |

- **Maximum 1,000 lines per file module.** If a module approaches the limit,
  extract a new module rather than growing past it.
- **Component extraction:** reusable UI (Club Card, Badge, Modal shell, Header
  Nav, Avatar) must be shared JS rendering functions — never copy-pasted markup.

## 3. Design & Palette Standards

**Brand palette** (defined once as CSS custom properties on `:root`):

Neutral cool palette (MP31) — one accent (cerulean); gold is reserved for the Save star only.

| Token | Value | Use |
|-------|-------|-----|
| `--navy` | `#003249` | Deep Space Blue — header, dark surfaces, display headings |
| `--brand` | `#007EA7` | Cerulean — primary actions, links |
| `--brand-dark` | `#00617f` | Deeper cerulean — hover / accent text (remapped to `#86d4dd` in dark) |
| `--brand-light` | `#80CED7` | Frosted Blue — soft accents, card backings, borders |
| `--brand-50` | `#eaf5f7` | Pale cerulean tint — chips, soft fills |
| `--grad-brand` | cerulean gradient | Primary buttons, badges, glossy panels |
| `--star` | `#f5b301` | Warm gold — Save/favorite star ONLY |

| `--join` | `#12a594` | Join success (teal-green) |
| `--ink` | `#0e2a37` | Primary text (deep teal-navy) |
| `--muted` | `#5a7581` | Secondary text |
| `--line` | `#d9e6e9` | Borders/dividers |
| `--bg` | `#f3f8f9` | Page background (cool off-white) |
| `--card` | `#ffffff` | Card/surface background |

Typography: **Space Grotesk** (display/headings) + **Inter** (body), loaded from Google Fonts with a system-font fallback stack (`--font-head` / `--font-body`).

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
Local-Business section (MP29) — a *directory* of neighborhood shops, sponsorships,
and member perks/deals (currently scaffolded "Coming soon" views). It must stay a
listing/directory only: **no payment processing, checkout, or money movement** on
the platform — perks are described, never transacted.

**Out of scope — do not add:** donations, fundraisers, campaigns, progress
bars, goal/rocket visualizers, donor leaderboards/podiums, donor activity
feeds, Stripe/payout/bank fields, shoutouts, or any money movement or pricing.

## 5. Conventions

- Escape all user-supplied strings before injecting into HTML (`escHtml`).
- Guard DOM lookups (`el && ...`) so a missing element never throws.
- One responsibility per function; name functions for what they render/do.
- Keep `localStorage` keys namespaced with the `sch_` prefix.
