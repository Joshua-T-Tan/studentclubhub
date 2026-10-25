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
  Awesome, no jQuery. **No emoji in the UI** — icons are inline SVG from `scripts/icons.js` (`svgIcon(name, size)`). Two deliberate
  exceptions (see next bullet): the Supabase Auth OTP `fetch` and the Google
  Fonts stylesheet (Space Grotesk + Inter, MP31) — both degrade gracefully to
  system fonts / an error toast if offline, so the rest of the app still runs
  from `file://` or any static host.
- **Persistence: Supabase REST + `localStorage`.** Every account is a **Supabase
  Auth user** — either "Continue with Google" (OAuth + PKCE: `sbSignInWithGoogle` /
  `sbFinishOAuthRedirect`; a Gmail that already has an account is linked to it) or
  email + password (email proven by a 6-digit code). The session's
  access token (`sbSession`, supabase.js) is sent on every `sbRest` call, and
  **row-level security decides who may write what**. The browser keeps only a
  profile cache + saves/preferences in `localStorage` — never passwords. Shared data lives in Supabase (project
  `xadmwmwagxeiidmeqspa`) via plain `fetch` (`sbRest()` in business.js, no SDK):
  `clubs` (one JSONB blob per club), `club_members` (**the source of truth for
  rosters/roles/counts** — never trust a blob's `roster`), `club_chat`,
  `club_reviews`, `businesses`, `biz_reviews` (a DB trigger keeps
  `businesses.rating/review_count` in sync), `partner_agreements`, `profiles`
  (name + `private` flag, readable from other browsers), `site_reviews`,
  `reports`, `contact_messages`. Schema changes go in `supabase/*.sql`.
- **One deliberate network exception: email OTP.** `scripts/supabase.js` calls
  Supabase Auth (`/auth/v1/otp` + `/auth/v1/verify`) via plain `fetch` to email
  and verify the 6-digit sign-up / 2FA code — no SDK, no CDN. The publishable key
  is public by design. Only the code round-trips; accounts still live in
  `localStorage`. This means auth needs a network connection (it no longer works
  fully offline); everything else still does. Do not "restore" the on-screen demo
  code — it was intentionally removed.
- **Scripts load as plain classic scripts** (not ES modules), in a fixed order
  (`schools, qr, supabase, icons → auth → directory → modal → reviews → profile → profile-types → pages →
  hero-motion → business → messages → partnerships → editors`) so they share one
  global scope. Files loaded before business.js must not call `sbRest` at load
  time — defer to `DOMContentLoaded`.
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
| `scripts/profile-types.js` | "Show me as" in Settings → Profile: Student / Business owner / Community member. Each type keeps its own saved headline, bio and two details; only the displayed version goes to the public `profiles` row (all versions are kept privately in the auth user's metadata). No sign-up questionnaire. Loaded after profile.js. |
| `scripts/schools.js` | Pre-populated LA-County high-school directory + district mapping (data + option builders). Loaded first. |
| `scripts/qr.js` | Self-contained offline QR-code generator (byte mode, EC level L, v1–5) for the Share Club modal. Loaded first. |
| `scripts/supabase.js` | Minimal Supabase Auth email-OTP client (`sbSendOtp`/`sbVerifyOtp`) via plain `fetch`. Holds the public project URL + publishable key. Loaded before auth.js. |
| `styles/theme.css` | The active "Paper" theme (red/yellow, graph paper, ink borders, hard shadows, Roboto). Loaded LAST; token-only re-skin. Remove its `<link>` to revert. |
| `scripts/icons.js` | The drawn icon set (`svgIcon(name, size)`, line icons in one ink style) + doodles for blank banners: school supplies for clubs/About Us (`banner`, `page`, `card1-3`) and storefront items for businesses (`bizBanner`, `bizcard1-3`, via `cardDoodles(id, 'biz')`). Loaded before auth.js. |
| `scripts/reviews.js` | Club reviews (members only, one per member) + homepage website reviews (static seeds + `site_reviews` table) and the shared review composer. Loaded right after modal.js. |
| `scripts/business.js` | Local-business directory: `sbRest()`, cards, business page, deal visibility (`dealVisibleToPublic` / `dealVisibleTo` / owner status chip), reviews (one per member), hours (Pacific time, overnight spans), registration (login required), `#biz=<id>` links. |
| `scripts/messages.js` | "Reach Out" popup (public contact email + partnership request form), profiles table sync, Partnership Requests inbox + FAB badge. |
| `scripts/partnerships.js` | Partnership lifecycle (pending → launched/declined/deleted, launched → ended; every transition is status-guarded), the "Partnership" tag and deal boxes. Requests are addressed to the club/business id, not a person. |
| `scripts/editors.js` | Per-section owner editors (gear/pencil popups) for clubs and businesses, incl. the President-only danger zone (hand off & leave, delete club) and Delete business. |
| `scripts/admin.js` | Admin page (emails in the server's `admins` table): tabs for Reports (resolve/dismiss/reopen), Messages from the Contact Us box (mark handled, reply by email), Verification (approve/reject, remove seals) and private Invite codes; summary counts + a to-do badge on the header's Admin button. Loaded last. |
| `scripts/hero-motion.js` | Canvas animation behind the homepage hero (10-second seamless loop). Loaded after pages.js. |

- **Maximum 1,000 lines per file module.** If a module approaches the limit,
  extract a new module rather than growing past it.
- **Component extraction:** reusable UI (Club Card, Badge, Modal shell, Header
  Nav, Avatar) must be shared JS rendering functions — never copy-pasted markup.

## 3. Design & Palette Standards

**Active look: the "Paper" theme** (`styles/theme.css`, designed by williki6).
It is loaded **last** and re-skins `main.css` / `pages.css` / `components.css`
purely through tokens + a few overrides — it never changes layout. Removing its
`<link>` in `index.html` reverts to the original cerulean look. New components
should use the tokens below (not hard-coded colors) so both themes work; if a
component needs paper-specific styling, add it to the coverage section at the
bottom of `theme.css`.

White graph-paper ground, **red** as the single accent, **yellow sticky-note**
tags/cards, square-edged boxes with a solid ink border and a hard offset shadow
(cut-out paper on a bulletin board). Light + dark variants are both defined.

| Token | Light | Use |
|-------|-------|-----|
| `--brand` | `#d62828` | Red — primary buttons, links, focus, active states |
| `--brand-dark` | `#a91d1d` | Red hover / accent text |
| `--brand-50` | `#fdecec` | Pale red tint — soft fills |
| `--note` | `#ffd84d` | Yellow sticky note — stat cards, tags, icon tiles |
| `--note-soft` | `#fff4c2` | Pale yellow — request cards, notices |
| `--ink` / `--navy` | `#1a1a1a` | Text, box borders (`--line`), hard shadows (`--box-ink`) |
| `--muted` | `#555555` | Secondary text |
| `--ground` / `--bg` | `#ffffff` | Page ground (with a faint 28px graph-paper grid) |
| `--card` | `#ffffff` | Card / surface background |
| `--star` | `#f5b301` | Gold — Save star only |

Shadows are hard offsets, not blurs: `--shadow-sm/md/lg` = `4/6/8px` solid ink.
Borders use `--edge` (`1.5px solid var(--line)`).

Typography: **Roboto** (400/500/700/900) for both headings and body, loaded from
Google Fonts with a system-font fallback stack (`--font-head` / `--font-body`).

**Blank banners:** a club/business with no uploaded images gets a white "sheet of paper" banner (`.is-paper`) with yellow tape and school doodles, set off from the page by a heavy ink rule. About Us page banners use the same paper + doodles.

**Logo:** a pinned yellow sticky note with a red "hub" mark (`schLogo` / `LOGO_SVG_INNER` in pages.js; same art in `styles/logo.svg`, the browser-tab icon).

**Homepage hero:** an animated canvas (`scripts/hero-motion.js`, `#heroMotion`) —
a seamless 10-second loop of local businesses and school clubs wired together
like circuit traces. Canvas only; no files or network.

**Modals:** translucent scrim behind an opaque card. Clicking the scrim
dismisses the modal; `Esc` also closes. (Applies to the auth, contact, review,
transfer, report, and confirm overlays — the Club Detail is a full page, not an
overlay, so it never closes on an outside click.)

**Border-radii (consistent, near-square):** `--r-sm: 3px` (chips/inputs),
`--r: 4px` (cards/buttons), `--r-lg: 6px` (modal cards), `--r-pill: 4px`
(pills render as small square tags).

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
  In attributes use `escAttr`; for a string argument inside an inline handler
  (`onclick="fn('…')"`) use `jsArg` — `escAttr` alone is NOT safe there.
- Identify people by `memberId`, never by display name (names aren't unique).
- A failed save must be visible: surface it with `toast`, don't swallow it.
- Private clubs are **unlisted**: hidden from Browse / Top Clubs / stats for
  non-members (`isListedFor`), still reachable by direct link.
- Guard DOM lookups (`el && ...`) so a missing element never throws.
- One responsibility per function; name functions for what they render/do.
- Keep `localStorage` keys namespaced with the `sch_` prefix.

## 6. Security Posture

Schema + policies: `supabase/security_2026_10.sql` (and later `supabase/*.sql`).

- **Real accounts + row-level security.** Reads are public (it's a directory);
  writes need a signed-in user and are checked in the database, not the browser:
  Presidents manage their club (roles, bans, hand-off, delete via `delete_club`),
  officers edit club content, owners edit their business, authors edit their own
  reviews/chat, only business owners write owner replies. `my_member_id()` maps
  the session to a member ID through `profiles.user_id`.
- **Club saves are field-level** (`save_club` RPC merges only the top-level keys
  an editor changed — `sbSaveClub` diffs against `_clubBase`), so simultaneous
  edits to different parts of a page don't overwrite each other. Two people
  editing the *same* field is still last-writer-wins.
- **Verified seal is admin-granted.** Owners send a request
  (`verification_requests`); an admin approves it on the Admin page. Triggers
  ignore any other attempt to set `verified`.
- **Invite codes are private** (`invite_codes` table, admin-only); the site can
  only ask `check_invite_code`. Never put codes in the JS.
- **Rollout switch:** `app_settings.legacy_writes` = `'on'` lets old anonymous
  writes through (transition only). It must be `'off'` in production.
- **Known limits:** 2FA (email code at login) is enforced by the site, not the
  server. Listings still go live immediately (`status:'verified'` TEMP).
  Accounts made before server logins upgrade on their next login via an emailed
  code, so working auth email (SMTP) is required.
