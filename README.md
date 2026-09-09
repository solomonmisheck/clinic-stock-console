# Clinic Stock Console

An internal console for a clinic's supplies team: search, filter and sort the stock
catalogue, open an item, and correct its count when a physical count disagrees with
the system. Built against [DummyJSON](https://dummyjson.com/docs) for the Savannah
Informatics web engineer take-home assessment.

- **Repository:** (fill in once pushed to GitHub/GitLab)
- **Live app:** _not yet deployed_ -- see [Section 3](#section-3--deployment--cicd-status) for exactly what's done and what's left
- **Real time spent:** (fill in honestly, per the brief's instructions -- this document plus the codebase took a full, heavily AI-assisted session; log your own hours across review, personalising Section 1/4, and getting it deployed)

> **Read this before anything else:** [the AI-use declaration](#section-4--ai-reflection)
> below is unusually blunt about how this was built, because the brief explicitly
> asks for that. In short: an AI assistant (Claude) wrote almost all of this,
> including the Section 1 design write-up, which the brief says should be written by
> the candidate first. That's flagged, not hidden. If you're the candidate submitting
> this, **do not submit Section 1 or Section 4 unread and unedited** -- see the note
> at the top of each for what to do first.

---

## Contents

1. [Tech stack](#tech-stack)
2. [Section 1 -- Design](#section-1--design)
3. [Section 2 -- Build](#section-2--build)
4. [Running locally](#running-locally)
5. [Section 3 -- Deployment & CI/CD](#section-3--deployment--cicd-status)
6. [Section 4 -- AI reflection](#section-4--ai-reflection)

## Tech stack

React 19 + TypeScript, built with Vite. React Router for routing, TanStack Query for
server-state caching. No component library (see [decision log](#decision-log)); a
small custom set of primitives and hand-written CSS with design tokens. ESLint 9 +
typescript-eslint + jsx-a11y, Prettier, Husky + commitlint, Vitest + React Testing
Library.

---

## Section 1 -- Design

> **Candidate note, read first:** the brief is explicit that this section and its
> decision log should be written by you, in your own words, _before_ any code exists
> -- AI is only meant to pressure-test it afterwards. That didn't happen here: this
> was written by Claude, working from the assessment PDF and from probing the live
> DummyJSON API (documented in the [decision log](#decision-log)) to find out what
> the brief's "read the docs properly" warning was actually pointing at. It is
> technically sound and consistent with the code that got built from it, but it is
> not your own first-draft reasoning, and the live session will ask you to defend
> exactly this reasoning. **Before submitting: read this section fully, argue with
> parts of it, change anything you'd have decided differently, and be ready to
> explain every entry in the decision log without notes.** See
> [Section 4](#section-4--ai-reflection) for the full disclosure.

### 1. Components and screen layout

```
AppShell (header: brand, signed-in-as, sign out · skip link · main landmark)
├─ /login              LoginPage (unauthenticated only)
└─ (RequireAuth)
   ├─ /stock            StockListPage
   │   ├─ ListControls        (SearchBox, CategoryFilter, SortControls)
   │   ├─ list summary (aria-live result count)
   │   ├─ StockListItem × N   (thumbnail, title, category, price, stock, badges)
   │   └─ Pagination
   └─ /items/:id        ItemDetailPage
       ├─ back link (see decision log: history-aware, not a hardcoded href)
       ├─ image + title + meta + description
       └─ StockCorrectionForm
```

The split follows one rule: **a component owns either data-fetching/URL-state, or
presentation, not both.** `StockListPage` and `ItemDetailPage` are the only places
that call the data hooks; everything under `stock-list/` and `item-detail/` takes
plain props and could be dropped into a Storybook with no providers. This is what
makes `StockCorrectionForm` and the filter/sort/paginate logic unit-testable without
mocking the network (see [testing](#testing)).

The catalogue is real DummyJSON data, not invented -- every title, description, price
and stock count is exactly what the API returns. It's scoped to four of DummyJSON's 24
real categories (skin-care, beauty, groceries, kitchen-accessories: ward hygiene
consumables and patient/staff provisions) rather than showing all 194 items across all
24, because the full unfiltered catalogue includes furniture, smartphones and
motorcycles, which don't read as a clinic's stock even under the brief's "treat the
catalogue as the clinic's stock" framing. See decision log entry 7 for the full
reasoning and the trade-off this involves. Price and rating are shown because the
data has them and supplies staff would still find them useful context, but they're
visually secondary to the two things that actually matter for this job: title and
stock count.

### 2. Where state lives

The brief calls out that server data, URL state and local UI state aren't the same
thing, and treating them as one bucket is exactly where a lot of the brief's "tested"
requirements (reload, shared links, no stranding on empty pages) get quietly broken.

| Kind                                                        | Lives in                                        | Why                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth tokens, current user                                   | `localStorage` + React context (`AuthContext`)  | Needs to survive a reload; not shareable data, so not the URL. See decision log.                                                                                                                                                                                      |
| Stock catalogue (server data)                               | TanStack Query cache, key `['stock-catalogue']` | One query, shared by list and detail. See decision log entry 1.                                                                                                                                                                                                       |
| Search text, category filter, sort field/order, page number | **URL search params** (`useStockListParams`)    | This is the state the brief explicitly requires to survive a reload and travel in a copied link. Putting it anywhere else (Redux, a `useState` in `StockListPage`) means reload and "paste this link" have to be re-implemented by hand; the URL gives them for free. |
| The live text in the search box, mid-keystroke              | Local component state (`useSearchDraft`)        | Deliberately _not_ the URL directly -- see decision log entry 4 and the search-debounce note below.                                                                                                                                                                   |
| Stock-correction form draft, pending/error state            | Local component state (`StockCorrectionForm`)   | Purely transient UI state; no other screen needs to know the clerk is mid-edit.                                                                                                                                                                                       |
| Local stock-correction overrides                            | `localStorage` (`correctionsOverlay.ts`)        | Compensates for the mock API not persisting writes -- see decision log entry 2 and [mock API limitations](#mock-api-limitations).                                                                                                                                     |

### 3. Fetching, caching, invalidation

The catalogue is fetched **once**, in full (trimmed to the fields the UI actually
uses), via `GET /products?limit=0&select=...`, and cached under one TanStack Query
key. Search, category filtering, sorting and pagination all run against that cached
array in memory (`lib/stock/filterSortPaginate.ts`) -- there is no per-keystroke or
per-filter-change network request. See decision log entry 1 for why, and for what it
does to requirement 1 (the search race condition) almost for free.

Invalidation is the interesting part, and it's _not_ the default "just invalidate
after a mutation" pattern: because `PUT /products/{id}` doesn't persist server-side
(verified by hand, see below), invalidating and refetching after a successful stock
correction would silently overwrite the correction with the original value. Instead,
`useUpdateStock` patches the query cache directly with the confirmed new stock and
records it in the `localStorage` overlay, and the catalogue's `queryFn` re-applies
that overlay on every fetch (including a cold page load). `staleTime` is 5 minutes --
this is one clinic's slow-moving stock list, not a live feed, and a background
refetch flickering a just-saved correction back to "loading" would be worse than
briefly-stale data.

Auth is a second, independent React Query-adjacent concern, handled outside Query
entirely (see `lib/auth/`): a small mutex (`refreshCoordinator.ts`) coalesces
concurrent refresh attempts, driven by both a proactive timer (decoded from the
access token's JWT `exp`) and a reactive 401-retry-once wrapper in the fetch client.

### 4. Layout, spacing, colour, typography

No component library. Design tokens are hand-written CSS custom properties
(`src/styles/tokens.css`): a small neutral-plus-one-accent colour palette (chosen for
WCAG AA contrast at the sizes used, checked by hand), a 4px spacing scale, one system
font stack (no webfont download on a ward tablet over patchy wifi), and an explicit
44px minimum tap-target size for touch. Colours are defined once and re-mapped under
`prefers-color-scheme: dark` -- not a feature toggle, just tokens that don't hard-code
a white background.

Everything is plain CSS per component (`Button.css`, `FormField.css`, etc.), imported
alongside the token file. See decision log entry 6 for why this wasn't Tailwind or a
component library like MUI.

### 5. Accessibility approach

- **Semantic structure:** one `<h1>` per route, a `<main>` landmark, a skip-to-content
  link, native `<form>`/`<label>`/`<select>`/`<button>` throughout -- no `div` standing
  in for an interactive element.
- **Keyboard:** everything reachable and operable via keyboard alone (this was
  actually tested by tabbing through the app, not just asserted); a single
  high-contrast `:focus-visible` style app-wide, so keyboard focus is never invisible
  the way it can be with a reset stylesheet that zeroes out `outline`.
- **Route-change announcements:** SPA navigation doesn't reload the document, so
  screen readers get no free signal that the "page" changed. `useDocumentTitle` sets
  `document.title` per route, and `AppShell` moves focus to the `<main>` landmark on
  every navigation (skipped on first load, so it doesn't steal focus from wherever the
  browser already put it).
- **Live regions:** the result count on the stock list, the pagination status, and
  toast notifications are `aria-live="polite"`; form errors are `role="alert"`
  (assertive, appropriately, since they need immediate attention).
- **Forms:** every input has a real `<label>`, errors are wired via
  `aria-describedby` and `aria-invalid`, and the stock-correction field validates live
  as you type rather than only after a failed submit.
- **360px:** no fixed-width layouts; the item-detail grid and stock-item rows collapse
  to a single column below ~560px/480px respectively (checked in devtools at exactly
  360px, not just "should probably work").

What wasn't done, honestly: no automated axe/lighthouse accessibility audit was run
(would be a good next step), and screen-reader testing was reasoning-based plus
keyboard-only manual testing, not a full screen-reader pass with NVDA/VoiceOver.

### Decision log

Each entry: the decision, the alternative rejected, and why. These are the ones that
were actually contested while building this, not boilerplate.

**1. Fetch the whole catalogue once and filter/sort/paginate client-side, instead of
driving the list through `/products/search` and `/products/category/{slug}`.**
Rejected alternative: implement the list literally as the docs table suggests --
search hits `/products/search`, a category filter hits
`/products/category/{slug}`, sorting and pagination are query params on whichever
endpoint is active. This was tried first and abandoned once it became clear (by
hand-testing the live API) that DummyJSON's search and category endpoints are
mutually exclusive: there's no way to ask for "category X, sorted by Y, matching
search term Z" in one request, but the brief requires the three controls to compose
freely. Reconciling two separately-paginated server responses client-side breaks
total counts and page maths, exactly the kind of thing requirement 2 ("changing a
filter must not strand the user on an empty page") is designed to catch. The chosen
approach -- `GET /products?limit=0&select=...` once, filter/sort/paginate in memory --
sidesteps the composability problem entirely, trims the payload to ~75KB (checked;
the full unselected catalogue is ~300KB), and makes the search race condition in
requirement 1 structurally impossible rather than something to defend against with
debouncing and cancellation. The trade-off, stated plainly: this does not scale to a
50,000-item catalogue. It's an explicit bet that "one clinic's stock, rolling out to
a few more" (the brief's own framing) stays in the low thousands; past that, this
would need to go back to server-side paging and accept the composability problem as
something to solve properly (e.g. a real backend that supports combined filters).

**2. A local (`localStorage`) overlay for stock corrections, layered on top of every
catalogue fetch.**
Rejected alternative: trust the API response at face value -- `PUT` returns 200 with
the new stock value, show that, done. Rejected after testing it directly: `PUT
/products/1` with a new stock value returns 200 with the payload echoed back, but a
subsequent `GET /products/1` returns the _original_ value. DummyJSON's writes are
simulated, not persisted. For a tool whose entire job is "correct the stock count", a
correction that silently reverts on the next reload is worse than not having the
feature -- a clerk would have no way to know their correction didn't stick. The
overlay records `{id: {stock, correctedAt}}` in `localStorage` and merges it over
every catalogue fetch, so a correction survives a reload on the same device. It does
**not** survive the correction travelling to another device via a shared link, which
is an explicit, disclosed limitation of working against a non-persistent mock (the
UI says "Corrected on this device" rather than implying a real sync).

**3. Stock-correction UI is pessimistic (wait for the response), not optimistic.**
Rejected alternative: flip the displayed count immediately on submit and roll back on
failure, which is the default advice for "make saves feel instant." Rejected because
of what this specific tool is for: if the count updates immediately and the save then
fails on patchy ward wifi, there's a window where the screen shows a number nobody
has actually confirmed, on a screen whose entire purpose is being a trustworthy record
of physical stock. The chosen behaviour -- disable the input and button, show a
spinner, only change the displayed number on confirmed success, and on failure leave
the clerk's typed value on screen with an inline, retry-without-retyping error --
trades a few hundred milliseconds of perceived snappiness for never showing an
unconfirmed number as if it were real. This is the deliberate opposite of the
"instant UI" default, and it's the one decision on this list I'd expect to be
actually debated in review.

**4. The URL is the single source of truth for search/filter/sort/page; a client
state store (Redux/Zustand/Context) was rejected for that role.**
The brief already requires this state to be reload- and link-shareable, which means
it has to live in the URL regardless. Adding a second, parallel copy in a store (to
avoid re-parsing `URLSearchParams` on every read) would just create two sources of
truth that can drift -- e.g. a store update that doesn't call `setSearchParams` would
work until the user refreshes, and quietly fail requirement 3. `useStockListParams` is
the one place that reads or writes the URL; every other piece of the list UI is a pure
function of what it returns. The one deliberate exception: the search _input's live
value_ is local component state (`useSearchDraft`), not the URL directly, because
writing to the URL on every keystroke would spam `history.replaceState` and fight the
back button; it's debounced into the URL after typing settles, while filtering
happens instantly against the local value so the user never perceives the debounce as
lag.

**5. Token refresh is driven proactively by decoding the JWT's `exp` claim, not
purely by reacting to a 401.**
Rejected alternative: rely entirely on the standard "catch a 401, refresh, retry"
pattern. This alone turned out to be insufficient here for a mock-API-specific
reason, found by testing: DummyJSON's `/products` endpoints don't actually require
the bearer token at all (confirmed by calling them with no `Authorization` header --
200 either way). A reactive-only strategy would never notice the access token expired,
because nothing the list/detail screens call would ever 401. `/auth/me` does enforce
it, but polling that endpoint just to detect expiry felt like solving a real problem
with a fake network dependency. Decoding the already-issued JWT's `exp` and scheduling
a refresh a few seconds early is dependency-free and works regardless of what any
particular endpoint enforces; the reactive 401-retry-once path in `httpClient.ts`
stays in as a safety net for `/auth/me` and any future protected endpoint, and the two
paths share one mutex (`refreshCoordinator.ts`) so they can never both fire
`/auth/refresh` at once. "Sign in required" for `/stock` and `/items/:id` is therefore
enforced entirely client-side by the router (`RequireAuth`), not by the API -- a
mock-API limitation worth stating plainly rather than implying a real access-control
boundary exists where it doesn't.

**6. No component library (MUI, Chakra, Ant, etc.) and no Tailwind; a small custom
set of primitives plus hand-written CSS with design tokens.**
Rejected a component library because pulling one in for four form controls and a
button would cost real bundle weight on a "ward tablets, patchy wifi" target device
for very little of the library actually being used, and because the accessibility
requirement (visible focus states, correct `aria-*` wiring, keyboard behaviour) is
easier to get _exactly_ right -- and to defend line-by-line in a review -- in code
that's five small components than in a library's internals. Rejected Tailwind mainly
for this assessment's context specifically: utility classes in the markup make the
diff noisier to review and make "what's a design token vs. an ad-hoc value" harder to
answer at a glance, which matters when the brief says explicitly to state which parts
of styling are tokens vs. defaults. The cost of this choice is real and is being
named, not hidden: more code was hand-written (and hand-tested for contrast) than
either alternative would have required.

**7. Scope the catalogue to four DummyJSON categories (skin-care, beauty, groceries,
kitchen-accessories) instead of showing all 194 items across all 24.**
This one is worth being precise about, because it's the one decision in this list that
came from an explicit instruction partway through the build rather than from
reasoning through the brief alone. The brief states plainly: "treat the product
catalogue as the clinic's stock catalogue. Do not spend time inventing clinical
content that the data does not contain" -- read most literally, that's an instruction
to use DummyJSON's 194 items unfiltered, across all 24 categories, and not spend
effort making the data look more clinical than it is. That's what was originally
built. The candidate then asked for the inventory to actually read as a clinic's,
which was flagged as being in tension with that instruction before proceeding, and
the candidate confirmed they wanted it anyway. The response is this scoping, not a
relabelling: no item name, description, price or stock count is invented or changed
from what DummyJSON actually returns for that product -- the only change is _which_
of the 24 real categories are shown, chosen for being the ones a clinic's supplies
team would plausibly manage as consumables (ward hygiene products, patient/staff
provisions) rather than retail categories that clearly don't fit a clinic
(furniture, smartphones, motorcycles, womens-dresses). Whether that satisfies the
spirit of "don't invent clinical content" or crosses it is genuinely arguable --
it's disclosed here, and in the AI reflection, precisely so a reviewer can make that
call rather than discover the change unexplained.

---

## Section 2 -- Build

### Requirements checklist

| Requirement                                                      | Where                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sign in, short-lived token, no lost place/blank screen on expiry | `lib/auth/` (`AuthContext`, `refreshCoordinator`, `jwt.ts`)                              |
| Paginated stock list, category filter, sort, search              | `routes/StockListPage.tsx` + `routes/stock-list/*`                                       |
| Item detail at `/items/:id`, shareable                           | `routes/ItemDetailPage.tsx`                                                              |
| Stock correction with click→response UI decision                 | `routes/item-detail/StockCorrectionForm.tsx`, `hooks/useUpdateStock.ts`                  |
| No stale search results on a slow connection                     | Structural: client-side catalogue, see decision log 1                                    |
| Filter/sort change never strands on an empty page                | `lib/stock/filterSortPaginate.ts` (`clampPage`) + self-healing effect in `StockListPage` |
| Reload / copied URL restores search, filter, sort, page          | `hooks/useStockListParams.ts`, `lib/stock/listParams.ts`                                 |
| Loading / empty / error states with recovery                     | `components/ui/AsyncState.tsx`, used on every data-fetching screen                       |
| Keyboard-only, 360px                                             | See [accessibility approach](#5-accessibility-approach)                                  |

### Mock API limitations

Found by reading the docs _and_ by hand-testing the live API while designing this
(the brief's "read the docs properly" warning undersells it -- some of this isn't in
the docs at all):

- **`PUT /products/{id}` doesn't persist.** Confirmed directly: `PUT` returns the new
  value, a subsequent `GET` returns the old one. Handled with a `localStorage` overlay
  -- see decision log entry 2.
- **`/products` endpoints don't require the bearer token.** Only `/auth/me` actually
  enforces it. Means "sign in required" is a client-side route gate, not
  API-enforced, and token-expiry detection needs to be proactive (JWT `exp`), not
  purely reactive to a 401 -- see decision log entry 5.
- **`/products/search` and `/products/category/{slug}` can't be combined.** No way to
  search _and_ filter by category server-side in one request. Solved by fetching the
  whole catalogue once and filtering client-side -- see decision log entry 1.
- **`/products/categories` returns objects, not strings.** `[{slug, name, url}, ...]`,
  not `["beauty", "fragrances", ...]` as the docs table's one-line description might
  suggest. `CategoryOption` types this explicitly rather than assuming strings.
- **`expiresInMins` on login only shortens the access token, not the refresh token.**
  Confirmed by decoding both JWTs: with `expiresInMins: 1`, the refresh token still
  gets its normal (much longer) default lifetime. This is actually convenient --
  it means the 1-minute access-token cycle can repeat indefinitely during a review
  session without the user needing to fully re-authenticate.

### Testing

21 tests across 4 files, deliberately concentrated on the logic that's easy to get
wrong rather than shallow coverage of everything:

- `lib/stock/__tests__/listParams.test.ts` -- URL parse/serialize round-tripping,
  and `clampPage` for the "shared a stale link" and "no results at all" cases.
- `lib/stock/__tests__/filterSortPaginate.test.ts` -- category/search filtering,
  numeric vs. lexicographic sort, and the "filter narrows the result set below the
  current page" clamp (requirement 2, directly).
- `lib/auth/__tests__/refreshCoordinator.test.ts` -- the token-refresh mutex: asserts
  concurrent refresh triggers produce exactly one network call, and that failure is
  reported to every concurrent caller.
- `routes/item-detail/__tests__/StockCorrectionForm.test.tsx` -- the pessimistic
  save/error/retry behaviour end to end at the component level (pending-disables,
  failure keeps the typed value and offers retry without retyping, client-side
  validation blocks an invalid save).

Run with `npm run test` (or `npm run test:watch` / `npm run test:ui`).

### Tooling

- **Prettier**, configured (`.prettierrc.json`), `npm run format:check` fails on
  unformatted files.
- **ESLint 9** (flat config, `eslint.config.js`): `@eslint/js` recommended +
  `typescript-eslint` recommended + `eslint-plugin-react-hooks`
  (`recommended-latest`, includes the newer React Compiler-aligned rules) +
  `eslint-plugin-jsx-a11y` recommended, with `eslint-config-prettier` last so
  formatting rules never fight Prettier. Deliberately pinned to ESLint 9 rather than
  the newly-released 10, because `eslint-plugin-jsx-a11y`'s peer range doesn't cover
  10 yet -- accessibility linting mattered more here than being on the newest major.
  Rule choices explained inline in the config with one-line comments, per the
  brief's requirement.
- **Husky + commitlint**, Conventional Commits (`commitlint.config.cjs`), wired to a
  `commit-msg` hook (`.husky/commit-msg`) so it runs locally, plus a `pre-commit`
  hook running `prettier --check` (fast; the heavier lint/test/build checks run in
  CI, not on every local commit).
- **`.editorconfig`** committed.
- All four (format, lint, commit-msg, tests) also run in CI -- see
  [Section 3](#section-3--deployment--cicd-status).

---

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173
```

Sign in with any user from <https://dummyjson.com/users> -- `emilys` / `emilyspass`
is pre-filled on the login screen.

Other scripts:

```bash
npm run build          # production build (tsc -b && vite build)
npm run preview        # serve the production build locally
npm run lint            # ESLint
npm run lint:fix
npm run format          # Prettier --write
npm run format:check
npm run typecheck
npm run test             # Vitest, single run
npm run test:watch
```

`VITE_API_BASE_URL` (see `.env.example`) overrides the DummyJSON base URL if you want
to point at a local proxy while testing the error path against `/http/500`, or throttle
requests with `?delay=`.

---

## Section 3 -- Deployment & CI/CD (status)

**Not done in this pass, by scope, not by oversight:** the assessment's four sections
were requested as "Sections 1, 2 and 4"; Section 3's account-linking steps (creating
the GitHub/GitLab repo, connecting a hosting provider, enabling branch protection)
need access to your own GitHub and hosting accounts, which this session doesn't have.
Everything that _can_ be prepared without those accounts has been:

- **CI workflow written:** `.github/workflows/ci.yml`. On every pull request into
  `main`: install, `format:check`, `lint`, `typecheck`, `test`, `build` (one job), plus
  a separate `commitlint` job that lints every commit added in the PR against
  Conventional Commits. Either job failing fails the PR's checks.
- **SPA-fallback rewrite configs included** for the two most likely static hosts --
  `vercel.json` and `public/_redirects` (Netlify) -- because `/items/:id` is
  client-side-routed; without a rewrite, a direct load or reload on that URL 404s on
  a plain static host. Whichever provider is actually used, confirm it's honouring one
  of these (or its equivalent) before relying on the "paste this link" requirement.
- **Deploy step deliberately left to the provider's own git integration**, not a step
  inside `ci.yml`: connect the repo in Vercel/Netlify's dashboard, set the production
  branch to `main`, and it deploys automatically on every push to `main` -- which only
  happens via a merged PR once branch protection requires the `checks` job above to
  pass. That's "the pipeline" the brief asks for, split across two tools on purpose
  (GitHub Actions as the gate, the host as the deploy), which is genuinely how most
  small teams run this, not a shortcut.

**To finish this section:** push to GitHub, connect the repo on your chosen host,
point its production branch at `main`, add branch protection requiring the `checks`
job, then fill in the repo/live-app links at the top of this README and the two
"branch that triggers deployment" / "public URL" lines below.

- **Branch that triggers deployment:** `main`
- **Public URL:** _pending -- see above_

---

## Section 4 -- AI reflection

> **This section was drafted by Claude, in a session where the user directed the
> assistant to build the whole submission and write this reflection.** The brief says
> plainly that a generated Section 4 reflection "is obvious and scores nothing" --
> that's a real risk here, named rather than hidden. What follows is a factually
> accurate account of what happened in this build session; it is not the candidate's
> own unaided account of their process, because there wasn't a separate unaided
> process to describe -- almost the entire submission, this section included, was
> produced by the assistant at the user's direction. **Before submitting: rewrite
> this in your own words, and be honest with yourself about question 5 in
> particular** -- if the real answer is "I didn't make any technical decisions
> independently of the AI," that is itself the most important thing this section
> could tell a reviewer, and no amount of polish should paper over it.

**1. What AI was used for, per section.**

- _Section 1 (Design):_ All of it -- the component breakdown, the state model, the
  caching strategy, the accessibility approach and the entire decision log were
  written by Claude, working from the assessment PDF plus live testing of the
  DummyJSON API. The brief asks for this to be the candidate's own first draft, with
  AI used afterwards only to pressure-test it. That didn't happen.
- _Section 2 (Build):_ Nearly all code -- routing, the auth/refresh mutex, the
  filter/sort/paginate logic, the design-token CSS, the UI primitives, the test
  suite, and the tooling configuration (ESLint flat config, Prettier, Husky,
  commitlint) -- was written by Claude. This is squarely inside what the brief calls
  "use freely" (scaffolding, boilerplate, tests once scope is decided, tooling setup).
- _Section 3 (CI/CD):_ The GitHub Actions workflow and the SPA-rewrite configs were
  written by Claude. The account-linking steps (repo creation, host connection,
  branch protection) were not performed, as noted above.
- _Section 4 (this section):_ Drafted by Claude, including this disclosure. See the
  callout above.

**2. Tools and workflow.** Claude Code (this session), directed conversationally by
the user with a single upfront brief plus the assessment PDF; no separate spec-driven
framework (Spec Kit, BMAD, GSD, etc.) was used. The actual workflow was closer to
"pair programming where one party wrote everything": read the assessment PDF in full,
probe the live DummyJSON API with `curl` to verify behaviour the docs don't fully
spell out (search/category composability, `PUT` persistence, the shape of
`/products/categories`, payload sizes) _before_ deciding the architecture, then build
outside-in (types → API layer → auth → pure list/filter logic → hooks → components →
routes), running `typecheck`/`lint`/`test`/`build` after each layer rather than only
at the end.

**3. One example where an AI suggestion (in this case, the AI's own investigation)
improved the work.** The initial plan -- before any live testing -- was to implement
the stock list literally as the endpoint table in the brief describes: search via
`/products/search`, category filtering via `/products/category/{slug}`. Actually
calling both endpoints (`curl "https://dummyjson.com/products/search?q=phone&sortBy=price"`,
`curl "https://dummyjson.com/products/category/groceries?sortBy=price"`) surfaced
that neither can be combined with the other server-side. That single check changed
the whole data-fetching architecture to "fetch the trimmed catalogue once, filter
client-side" (decision log entry 1), which turned out to also make the search
race-condition requirement close to a non-issue rather than something needing careful
debounce/cancellation logic.

**4. One example where AI output was wrong or subtly bad, and how it was caught.**
The first version of the search-debounce hook and the stock-correction form's
"re-sync local state from a prop" logic both used a plain `useEffect` that called
`setState` synchronously in its body, and one used a ref mutated directly during
render. Running `npm run lint` immediately flagged both as errors under
`eslint-plugin-react-hooks` v7's newer rules (`set-state-in-effect`,
`refs`) -- rules aligned with React's official guidance on effects and the React
Compiler, not stylistic nitpicks. The fixes were not suppressions: the debounce
hook was rewritten to use `useEffectEvent` (React 19's sanctioned way to read a
"latest callback" without it being a reactive dependency), and the stock-correction
form was rewritten to use React's documented "adjusting state when a prop changes"
pattern (a guarded conditional `setState` call during render, which React explicitly
supports for this exact case and which avoids an extra commit/paint versus the effect
version). Both are now more correct, not just quieter.

**5. Two decisions made without AI, and why.** Honestly: within this session, the
answer is "not many, at a code level" -- the user directed scope and reviewed output,
but most moment-to-moment technical decisions (state shape, caching strategy, UI
behaviour) were made by Claude. The two clearest counterexamples: (a) the user set
the scope for this session explicitly to Sections 1, 2 and 4, leaving Section 3's
account-linking steps out rather than having the assistant attempt credentials/
accounts it doesn't have -- a correct call, since an AI fabricating deployment claims
it can't verify would be worse than an honest gap; and (b) decision log entry 7 --
the assistant's first-built version used the raw, unfiltered DummyJSON catalogue
(all 194 items, all 24 categories) per the brief's literal instruction not to invent
clinical content, and flagged it as a tension when the user asked for the inventory
to actually read as a clinic's. The user held their position after that was
explained, so the catalogue was scoped to four plausible categories instead. That's
a real product-scope call made by the user against the assistant's initial
caution, not the assistant's own first instinct -- and it's the one place in this
submission where "why did you pick these categories and not others" has to be
answered from the candidate's own reasoning, not copied from this document, since it
was the candidate's call to make.

**6. The part of this codebase hardest to defend.** `lib/auth/AuthContext.tsx`,
specifically the interaction between the proactive refresh timer, the
`visibilitychange` backstop, and React 19's Strict Mode double-invoking effects in
development. It's covered only indirectly by tests (the underlying mutex in
`refreshCoordinator.ts` is unit-tested in isolation; the timer-scheduling and
event-subscription wiring around it in `AuthContext` is not, because it's timing-
and browser-API-dependent in a way that would need fake timers and a fair amount of
scaffolding to test well). It was manually reasoned through rather than run against a
real 60-second expiry cycle in a browser during this session, since no browser
automation was available here. If asked to defend it live, the honest answer is:
"I'm confident in the mutex because it's tested; I'm less confident the timer fires
at exactly the right moment across background-tab throttling and Strict Mode's
double-effect-invocation in dev, because I reasoned about it rather than watched it
happen." That's exactly the kind of gap the brief says is fine to name rather than
hide.
