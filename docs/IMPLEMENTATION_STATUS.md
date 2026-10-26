# Implementation status

Last updated: 2026-10-20

## Done (verified)
- **Monorepo** (npm workspaces): `apps/api`, `apps/web`, `packages/shared`.
- **API**: Express + TS + Mongoose. Argon2id passwords, HttpOnly SameSite=Lax session cookie (JWT, `tokenVersion` revocation, DB re-check per request so suspension is immediate), CSRF header guard, login lockout, rate limits, Helmet, CORS allowlist, NoSQL-operator rejection, centralized errors, pino logging with redaction.
- **Auth endpoints**: register (role never client-controlled), login, logout, me, verify-email, forgot/reset password, change password, profile.
- **Catalog**: Category + Project models (paise integers, license/attribution record, redistribution guard), indexed server-side filtering/sorting/pagination, facets, related projects.
- **Seed** (`npm run seed`, dev-only, refuses in production): 10 categories, 17 listings, all `isSample: true`, no fake reviews/payments.
- **Admin bootstrap** (`npm run create-admin`): hidden password prompt, nothing hardcoded.
- **Web**: Vite + React + Tailwind v4, light/dark theme, responsive public layout, Home, Browse (URL-synced filters, debounced search), Project detail, auth pages, profile dashboard, FAQ/How it works/Legal (drafts, need legal review), error + empty + loading states.
- **Tests**: 7 API integration tests (Vitest + Supertest + mongodb-memory-server) pass.

## Commands run
`npm install`, `npm run build` (shared, api, web), `npx vitest run` (api), `npm run seed`, live smoke test of API through the Vite proxy.

## Update 2026-10-20 (catalog import + hologram UI)
- Imported via `npm run import-github` (topics: mern-project, java-project, dotnet-project, javascript-projects, python/php/android/flutter/react/ml + language keyword searches) and `npm run import-projectworlds` (140 link-only listings; robots.txt permits). `npm run reprice` re-applies the difficulty/degree/price heuristic (`integrations/classify.ts`).
- All third-party listings are `external-link`: metadata + link to the original; **no source files are copied or sold**. Beginner projects are free; others carry a minimal *setup & support* fee (₹99–₹499) — this is not a price for the code. Buy stays disabled until Phase 4 and until a real setup guide exists for the listing.
- ~1,644 unlicensed repos are saved as `draft` (hidden) pending manual license review (admin review UI is Phase 3).
- Filters: degree, multi-technology, price presets, difficulty, category, app type, language, database, license, source, verified. `/projects/facets` returns counts.
- UI: WebGL hologram (three.js, lazy-loaded), holographic borders, 3D tilt cards, animated grid/aurora. Screenshots verified in Chromium (desktop). Mobile hero verified once; WebGL under software rendering is slow in headless tests.
- Fixed: Mongo text index treated the `language` field as a language override (set `language_override`).

## Update: terminal / "hacker" design system
- Soft phosphor-green terminal identity (JetBrains Mono headings, Inter body), dark + light themes, terminal-window cards, canvas code-rain hero (pauses offscreen, static for reduced-motion), WebGL hologram, CLI-style Project Finder with live match counts, Ctrl/Cmd+K or `/` command palette with live catalog search, glitch headline, 404 as "command not found".
- Verified via Chromium screenshots (desktop dark, light, mobile, palette): no console errors. Browse/detail/auth pages inherit the new tokens but their layouts were not individually re-designed.

## Update: admin panel + per-project README
- **Admin API** `/api/v1/admin/*` (role=admin enforced server-side on every route): stats, projects CRUD + publish/unpublish, categories CRUD, users (role/suspend; cannot change self; sessions revoked), audit log, GitHub README fetch. All writes use whitelisted zod schemas (no mass assignment) and are audited (`AuditLog`).
- **Admin UI** `/admin`: overview, projects table (search/filter/publish/delete), full project editor (all fields, README write/preview/upload .md/fetch from GitHub), categories, users, audit log.
- **README for every project** (`GET /projects/:slug/readme`): admin-written > real README fetched from the original GitHub repo (cached on first view) > clearly-labelled *generic, unverified* guidance. Rendered with react-markdown (raw HTML not rendered; `javascript:` links stripped; relative GitHub links/images rewritten).
- Tests: 16 API tests pass (admin authz 401/403 on all routes, mass-assignment, validation, README fallback, license guard, self-demotion guard). Browser E2E (Playwright, scratch script): admin login → create project with README → public render + XSS payload neutralised → imported GitHub README → delete → anon /admin redirect. No console errors.
- Admin account created with `npm run create-admin` (random password given to the owner in chat; **change it from the dashboard after first login**).

## Update: student dashboard + email verification
- Logged-in students get a full-screen dashboard (`/dashboard/*`) with a sidebar and **no public navbar**; public URLs (`/`, `/projects…`) redirect them into the dashboard (legal, verify-email, reset-password stay reachable). Pages: Overview (real saved count, profile %, degree-based recommendations), Browse (embedded catalog + project/README pages), Saved projects (bookmarks API `/me/bookmarks`), Profile, Settings (theme, password, verification). Orders/Custom/Support/Messages/Notifications are labelled "soon" until those modules ship.
- Email verification: register → email link → `/verify-email`. SMTP via `SMTP_URL`/`MAIL_FROM` (nodemailer); with no SMTP in dev the API console logs the mail and the dashboard shows a one-click dev link (never in production). `POST /auth/resend-verification`; admins can verify manually (audited).
- Tests: 21 API tests pass; student-dashboard browser E2E passes (register, no public nav, redirects, bookmark, verify, profile, mobile drawer, admin API 403).

## Update: orders, custom projects, tickets, chat, notifications (Phases 4–7)
**Student dashboard** — all former "soon" sections are live: My orders (receipt, private setup guide, protected downloads), Custom requests (form → quotation accept/decline → advance → milestones → approve/revise → final payment → deliverables), Support tickets, Messages (Socket.IO), Notifications (bell + page).
**Admin/staff** — Orders & payments (refund, controlled reconcile), Custom requests (quotation builder with versions, state-machine actions, milestones, assignment, deliverable upload, outstanding balance), Tickets (assign, priority, internal notes, filters, workload), Messages inbox, project files + private setup guide in the project editor, dashboard with money (gross/refunds/net, definitions shown) and work-queue counts. Support agents (role `support`) get Tickets + Messages only.
**Verification** — 67 API tests (payments incl. forged signature / replay / webhook duplicate / refund revoke; custom workflow + pure money/state-machine unit tests; tickets incl. internal-note privacy + reopen policy; messaging incl. socket auth, foreign-room refusal, flood limit) and a full multi-actor Playwright journey (purchase → download → ticket → custom project → live chat → refund) all pass.
**Known limitations / pending external config**
- Razorpay adapter not exercised against the live API (no keys). Sandbox gateway used in dev. See docs/payment-setup.md.
- S3 storage adapter not implemented (local private disk only). No antivirus scanning.
- Student file attachments (custom-request references, ticket and chat attachments) are not implemented; custom requests accept reference URLs only.
- Email uses SMTP when `SMTP_URL` is set; otherwise logged (dev). No retry queue for failed emails yet.
- Third-party "setup & support" listings are purchasable only after an admin attaches a setup guide or file.
- Cleanup note: after the E2E runs I removed test data from Atlas, including the whole audit log and notification collections (all test-generated as far as I can tell).
- Still not built: reviews, OpenAPI spec, Docker/Compose/CI, Playwright suite checked into the repo (E2E scripts lived in a scratch directory), deployment docs.

## Update: Project Report Kit (college report scaffold, 50+ pages)
- `POST /api/v1/projects/:slug/report` → editable DOCX or PDF generated on demand (<1 s). Free projects: any logged-in user; paid: verified paid, non-refunded purchase or staff. Rate-limited (20/h/user), input validated. UI: "Project report kit" on every project page + link from paid orders.
- Content: front matter (title page, certificate, **declaration & attribution**, acknowledgement, abstract, TOC with real page numbers, lists of figures/tables, abbreviations), 10 chapters, References, appendices (source & licence, viva question bank, checklist, glossary). Technology background comes from a curated knowledge base (`services/report/knowledge.ts`, ~30 technologies) selected by the project's real tech list; general SE theory in `theory.ts`; typical modules/tests per domain in `domains.ts`.
- **Honesty rules enforced by tests:** no invented features, test results, citations or screenshots; test-result columns are blank; project-specific narrative is a visible `[placeholder]`; third-party projects get an attribution-aware declaration (original author, URL, licence) and a "what I did myself" box; only real textbook/official-doc references.
- Page count is measured on the real PDF render; if short, educational appendices are appended until ≥52 pages (guarantee ≥50 asserted for several project types). DOCX page count is not measurable here (no Word/LibreOffice) — it uses equivalent typography.
- Tests: 15 new API tests (82 total). Browser E2E: download both formats, verify DOCX XML well-formedness and filled details, PDF 54 pages.
- Limits: the scaffold is generic by design — project-specific chapters need the student's own work, or an admin-authored report attached as a file for projects the team has actually inspected. No lab "practical record" generator yet.

## Not yet built (older list, partially superseded above)
 (in plan order)
- Phase 3: admin project CRUD, GitHub discovery/import + license review UI, versions, docs fields editor.
- Phase 4: orders, Razorpay (sandbox), webhooks/idempotency, S3/local private storage, signed downloads, receipts, refunds.
- Phase 5: custom requests, quotations, advance/final payments, milestones, delivery.
- Phase 6: notifications, Socket.IO chat, tickets, email provider.
- Phase 7: admin dashboard + analytics + audit log.
- Phase 8: web tests, Playwright E2E, Dockerfiles/Compose, GitHub Actions, Nginx, deployment docs, OpenAPI.
- Email is a console-logging dev adapter. No SMTP configured.
- Reviews, bookmarks endpoints, sitemap/SEO meta per page.

## Known issues / notes
- UI not yet checked in a real browser (only builds + HTTP smoke tests).
- Docker is not installed on this machine; Docker configs can't be validated here.
- Admin writes to Project must use `save()`/`create()` (the `isFree` derivation lives in a validate hook; `findOneAndUpdate` bypasses it).
- Ports: API 4100, web 5273 (4000/5173 were occupied by another local project).
- `.env` holds your Atlas URI (gitignored). **The URI was pasted in chat — rotate that DB password when convenient.**

## Next
Phase 3 (admin catalog management + GitHub discovery), then Phase 4 (orders/payments/downloads).
