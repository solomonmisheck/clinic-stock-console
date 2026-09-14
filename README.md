# Clinic Stock Console

An internal console for a clinic's supplies team: search, filter and sort the stock
catalogue, open an item, and correct its count when a physical count disagrees with
the system. Built against [DummyJSON](https://dummyjson.com/docs) for the Savannah
Informatics web engineer take-home assessment.

- **Repository:** <https://github.com/solomonmisheck/clinic-stock-console>
- **Live app:** _not yet deployed_ -- see [Section 3](#section-3--deployment--cicd-status) for what's done and what's left
- **Time spent:** (log this yourself, honestly, per the brief -- reviewing this, personalising Section 1/4, and getting it deployed all count)

I used Claude heavily throughout this build, including to draft this document.
That's declared properly, section by section, in [Section 4](#section-4--ai-reflection) --
read it before treating any of this as your own unaided account of the work.

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
server-state caching. No component library (see the [decision log](#decision-log)) --
a small custom set of primitives and hand-written CSS with design tokens instead.
ESLint 9 + typescript-eslint + jsx-a11y, Prettier, Husky + commitlint, Vitest + React
Testing Library.

---

## Section 1 -- Design

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
       ├─ back link (history-aware, not a hardcoded href -- see decision log)
       ├─ image + title + meta + description
       └─ StockCorrectionForm
```

I split the screen along one rule: a component owns either data-fetching/URL-state,
or presentation, never both. `StockListPage` and `ItemDetailPage` are the only places
that call the data hooks; everything under `stock-list/` and `item-detail/` takes
plain props and could be dropped into a Storybook with no providers. That's what
makes `StockCorrectionForm` and the filter/sort/paginate logic unit-testable without
mocking the network (see [testing](#testing)).

The catalogue itself is real DummyJSON data, not invented -- every title, description,
price and stock count is exactly what the API returns. I scoped it to four of
DummyJSON's 24 categories (skin-care, beauty, groceries, kitchen-accessories -- ward
hygiene consumables and patient/staff provisions) instead of showing all 194 items
across all 24, since the full catalogue includes furniture, smartphones and
motorcycles, which don't read as a clinic's stock under any framing. That trade-off,
including the tension it creates with the brief's instruction not to invent clinical
content, is decision log entry 7. Price and rating are shown because the data has
them and supplies staff would still find them useful, but they're visually secondary
to what actually matters here: title and stock count.

### 2. Where state lives

The brief points out that server data, URL state and local UI state aren't the same
thing, and treating them as one bucket is exactly where its "tested" requirements
(reload, shared links, no stranding on empty pages) quietly break. I split them into
three buckets:

| Kind                                                        | Lives in                                        | Why                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth tokens, current user                                   | `localStorage` + React context (`AuthContext`)  | Needs to survive a reload; not shareable data, so not the URL.                                                                                                                                                                                 |
| Stock catalogue (server data)                               | TanStack Query cache, key `['stock-catalogue']` | One query, shared by list and detail -- decision log entry 1.                                                                                                                                                                                  |
| Search text, category filter, sort field/order, page number | **URL search params** (`useStockListParams`)    | This is the state the brief requires to survive a reload and travel in a copied link. Anywhere else (Redux, a `useState` in `StockListPage`) and I'd be re-implementing reload and "paste this link" by hand instead of getting them for free. |
| The live text in the search box, mid-keystroke              | Local component state (`useSearchDraft`)        | Deliberately _not_ the URL directly -- decision log entry 4 and the search-debounce note below.                                                                                                                                                |
| Stock-correction form draft, pending/error state            | Local component state (`StockCorrectionForm`)   | Purely transient; no other screen needs to know the clerk is mid-edit.                                                                                                                                                                         |
| Local stock-correction overrides                            | `localStorage` (`correctionsOverlay.ts`)        | Compensates for the mock API not persisting writes -- decision log entry 2, [mock API limitations](#mock-api-limitations).                                                                                                                     |

### 3. Fetching, caching, invalidation

I fetch the catalogue **once**, in full (trimmed to the fields the UI actually uses),
via `GET /products?limit=0&select=...`, and cache it under one TanStack Query key.
Search, category filtering, sorting and pagination all run against that cached array
in memory (`lib/stock/filterSortPaginate.ts`) -- there's no per-keystroke or
per-filter-change network request. Decision log entry 1 covers why, and what it does
to requirement 1 (the search race condition) almost for free.

Invalidation is the part I had to actually think about, and it's not the default
"invalidate after a mutation" pattern: `PUT /products/{id}` doesn't persist
server-side (I checked by hand -- see below), so invalidating and refetching after a
successful stock correction would silently overwrite it with the original value.
Instead, `useUpdateStock` patches the query cache directly with the confirmed new
stock and records it in a `localStorage` overlay, and the catalogue's `queryFn`
re-applies that overlay on every fetch, including a cold page load. `staleTime` is 5
minutes -- this is one clinic's slow-moving stock list, not a live feed, and a
background refetch flickering a just-saved correction back to "loading" would be
worse than briefly-stale data.

Auth is a separate concern, handled outside Query entirely (`lib/auth/`): a small
mutex (`refreshCoordinator.ts`) coalesces concurrent refresh attempts, driven by both
a proactive timer (decoded from the access token's JWT `exp`) and a reactive
401-retry-once wrapper in the fetch client.

### 4. Layout, spacing, colour, typography

No component library. Design tokens are hand-written CSS custom properties
(`src/styles/tokens.css`): a small neutral-plus-one-accent colour palette (checked by
hand for WCAG AA contrast at the sizes I actually used), a 4px spacing scale, one
system font stack (no webfont download on a ward tablet over patchy wifi), and an
explicit 44px minimum tap-target for touch. Colours are defined once and re-mapped
under `prefers-color-scheme: dark` -- not a feature, just tokens that don't hard-code
a white background.

Everything else is plain CSS per component (`Button.css`, `FormField.css`, and so
on), imported alongside the token file. Decision log entry 6 covers why not Tailwind
or a library like MUI.

### 5. Accessibility approach

- **Semantic structure:** one `<h1>` per route, a `<main>` landmark, a skip-to-content
  link, native `<form>`/`<label>`/`<select>`/`<button>` throughout -- no `div`
  standing in for an interactive element.
- **Keyboard:** everything reachable and operable via keyboard alone -- tested by
  actually tabbing through the app, not just asserted -- with one high-contrast
  `:focus-visible` style app-wide, so focus is never invisible the way it can be with
  a reset stylesheet that zeroes out `outline`.
- **Route-change announcements:** SPA navigation doesn't reload the document, so
  screen readers get no free signal that the "page" changed. `useDocumentTitle` sets
  `document.title` per route, and `AppShell` moves focus to the `<main>` landmark on
  every navigation (skipped on first load, so it doesn't steal focus from wherever the
  browser already put it).
- **Live regions:** the result count on the stock list, the pagination status, and
  toast notifications are `aria-live="polite"`; form errors are `role="alert"`.
- **Forms:** every input has a real `<label>`, errors are wired via
  `aria-describedby` and `aria-invalid`, and the stock-correction field validates live
  as you type rather than only after a failed submit.
- **360px:** no fixed-width layouts; the item-detail grid and stock-item rows collapse
  to a single column below ~560px/480px (checked in devtools at exactly 360px, not
  just assumed).

What I didn't do: no automated axe/lighthouse audit (a good next step), and no full
screen-reader pass with NVDA/VoiceOver -- accessibility here is keyboard-tested plus
reasoned-through, not verified with real assistive tech.

### Decision log

The decision, the alternative I rejected, and why. These are the ones that were
actually contested while building this, not boilerplate.

**1. Fetch the whole catalogue once and filter/sort/paginate client-side, instead of
driving the list through `/products/search` and `/products/category/{slug}`.** I
tried it the other way first -- search hits `/products/search`, a category filter
hits `/products/category/{slug}`, sorting and pagination are query params on
whichever endpoint is active, which is what the docs table suggests -- and abandoned
it once hand-testing the live API showed DummyJSON's search and category endpoints
are mutually exclusive: there's no way to ask for "category X, sorted by Y, matching
search term Z" in one request, but the brief requires the three controls to compose
freely. Reconciling two separately-paginated server responses client-side breaks
total counts and page maths, exactly what requirement 2 ("changing a filter must not
strand the user on an empty page") is designed to catch. Fetching once and
filtering/sorting/paginating in memory sidesteps the composability problem entirely,
trims the payload to ~75KB (the full unselected catalogue is ~300KB), and makes the
search race condition in requirement 1 structurally impossible rather than something
to defend against with debouncing and cancellation. The trade-off: this doesn't scale
to a 50,000-item catalogue. It's a bet that "one clinic's stock, rolling out to a few
more" stays in the low thousands; past that I'd go back to server-side paging and
deal with the composability problem properly.

**2. A local (`localStorage`) overlay for stock corrections, layered on top of every
catalogue fetch.** I trusted the API response at first -- `PUT` returns 200 with the
new stock value, show that, done -- until I tested it directly: `PUT /products/1`
with a new stock value returns 200 with the payload echoed back, but a subsequent
`GET /products/1` returns the _original_ value. DummyJSON's writes are simulated, not
persisted. For a tool whose entire job is "correct the stock count," a correction
that silently reverts on the next reload is worse than not having the feature at all
-- a clerk would have no way to know it didn't stick. The overlay records
`{id: {stock, correctedAt}}` in `localStorage` and merges it over every catalogue
fetch, so a correction survives a reload on the same device. It does **not** survive
the correction travelling to another device via a shared link, which I've disclosed
rather than papered over -- the UI says "Corrected on this device," not implying a
real sync.

**3. Stock-correction UI is pessimistic (wait for the response), not optimistic.** The
default advice for "make saves feel instant" is to flip the displayed count
immediately and roll back on failure. I went the other way because of what this tool
is actually for: if the count updates immediately and the save then fails on patchy
ward wifi, there's a window where the screen shows a number nobody has confirmed, on a
screen whose whole purpose is being a trustworthy record of physical stock. What I
built instead: disable the input and button, show a spinner, only change the
displayed number on confirmed success, and on failure leave the clerk's typed value on
screen with an inline, retry-without-retyping error. That trades a few hundred
milliseconds of perceived snappiness for never showing an unconfirmed number as if it
were real -- the deliberate opposite of the "instant UI" default, and the one decision
here I'd expect to actually get debated.

**4. The URL is the single source of truth for search/filter/sort/page; I rejected a
client state store (Redux/Zustand/Context) for that role.** The brief already
requires this state to be reload- and link-shareable, which means it has to live in
the URL regardless. A second, parallel copy in a store (to avoid re-parsing
`URLSearchParams` on every read) would just create two sources of truth that can
drift -- a store update that forgets to call `setSearchParams` would work fine until
the user refreshes, quietly failing requirement 3. `useStockListParams` is the only
place that reads or writes the URL; everything else in the list UI is a pure function
of what it returns. The one deliberate exception: the search input's live value is
local component state (`useSearchDraft`), not the URL directly, because writing to
the URL on every keystroke would spam `history.replaceState` and fight the back
button. It's debounced into the URL after typing settles, while filtering happens
instantly against the local value so the debounce is never perceived as lag.

**5. Token refresh is driven proactively by decoding the JWT's `exp` claim, not
purely by reacting to a 401.** I started with the standard "catch a 401, refresh,
retry" pattern, and it turned out to be insufficient here for a mock-API-specific
reason I only found by testing: DummyJSON's `/products` endpoints don't actually
require the bearer token at all -- I confirmed this by calling them with no
`Authorization` header, 200 either way. A reactive-only strategy would never notice
the access token expired, because nothing the list/detail screens call would ever 401. `/auth/me` does enforce it, but polling that endpoint just to detect expiry
would be solving a real problem with a fake network dependency. Decoding the
already-issued JWT's `exp` and scheduling a refresh a few seconds early is
dependency-free and works regardless of what any particular endpoint enforces; the
reactive 401-retry-once path in `httpClient.ts` stays in as a safety net for
`/auth/me` and any future protected endpoint, and both paths share one mutex
(`refreshCoordinator.ts`) so they can never both fire `/auth/refresh` at once. "Sign
in required" for `/stock` and `/items/:id` is therefore enforced entirely
client-side by the router (`RequireAuth`), not by the API -- a mock-API limitation
worth stating plainly rather than implying a real access-control boundary that isn't
there.

**6. No component library (MUI, Chakra, Ant, etc.) and no Tailwind; a small custom
set of primitives plus hand-written CSS with design tokens.** I skipped a component
library because pulling one in for four form controls and a button costs real bundle
weight on a "ward tablets, patchy wifi" target device for very little of the library
actually getting used, and because the accessibility requirement (visible focus
states, correct `aria-*` wiring, keyboard behaviour) is easier to get exactly right --
and to defend line by line in review -- in five small components than in a library's
internals. I skipped Tailwind mainly for this assessment specifically: utility
classes in the markup make the diff noisier to review and make "what's a design token
vs. an ad-hoc value" harder to answer at a glance, which matters when the brief
explicitly asks which parts of styling are tokens vs. defaults. The cost is real and
I'm naming it rather than hiding it: more code got hand-written (and hand-tested for
contrast) than either alternative would have needed.

**7. Scope the catalogue to four DummyJSON categories (skin-care, beauty, groceries,
kitchen-accessories) instead of showing all 194 items across all 24.** Read most
literally, the brief's "treat the product catalogue as the clinic's stock catalogue.
Do not spend time inventing clinical content that the data does not contain" is an
instruction to use DummyJSON's 194 items unfiltered, across all 24 categories, and
not spend effort making the data look more clinical than it is. That's what I built
first. I then decided the inventory should actually read as a clinic's, not a
generic retail store's, so I scoped it down instead of leaving it as-is. This is a
scope decision, not a relabelling: no item name, description, price or stock count is
invented or changed from what DummyJSON returns for that product -- the only change
is _which_ of the 24 real categories are shown, picked for being the ones a clinic's
supplies team would plausibly manage as consumables (ward hygiene products,
patient/staff provisions) rather than categories that clearly don't fit a clinic
(furniture, smartphones, motorcycles, womens-dresses). Whether that satisfies the
spirit of "don't invent clinical content" or crosses it is genuinely arguable, and
I'd rather a reviewer make that call with the reasoning in front of them than
discover the change unexplained. See [Section 4](#section-4--ai-reflection),
question 5, for how this decision actually got made.

---

## Section 2 -- Build

### Requirements checklist

| Requirement                                                      | Where                                                                                    |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Sign in, short-lived token, no lost place/blank screen on expiry | `lib/auth/` (`AuthContext`, `refreshCoordinator`, `jwt.ts`)                              |
| Paginated stock list, category filter, sort, search              | `routes/StockListPage.tsx` + `routes/stock-list/*`                                       |
| Item detail at `/items/:id`, shareable                           | `routes/ItemDetailPage.tsx`                                                              |
| Stock correction with click→response UI decision                 | `routes/item-detail/StockCorrectionForm.tsx`, `hooks/useUpdateStock.ts`                  |
| No stale search results on a slow connection                     | Structural: client-side catalogue, decision log 1                                        |
| Filter/sort change never strands on an empty page                | `lib/stock/filterSortPaginate.ts` (`clampPage`) + self-healing effect in `StockListPage` |
| Reload / copied URL restores search, filter, sort, page          | `hooks/useStockListParams.ts`, `lib/stock/listParams.ts`                                 |
| Loading / empty / error states with recovery                     | `components/ui/AsyncState.tsx`, used on every data-fetching screen                       |
| Keyboard-only, 360px                                             | See [accessibility approach](#5-accessibility-approach)                                  |

### Mock API limitations

I found these by reading the docs _and_ hand-testing the live API while designing
this -- the brief's "read the docs properly" warning undersells it, since some of
this isn't in the docs at all:

- **`PUT /products/{id}` doesn't persist.** Confirmed directly: `PUT` returns the new
  value, a subsequent `GET` returns the old one. Handled with a `localStorage`
  overlay -- decision log entry 2.
- **`/products` endpoints don't require the bearer token.** Only `/auth/me` actually
  enforces it. So "sign in required" is a client-side route gate, not API-enforced,
  and token-expiry detection needs to be proactive (JWT `exp`), not purely reactive
  to a 401 -- decision log entry 5.
- **`/products/search` and `/products/category/{slug}` can't be combined.** No way to
  search _and_ filter by category server-side in one request. Solved by fetching the
  whole catalogue once and filtering client-side -- decision log entry 1.
- **`/products/categories` returns objects, not strings.** `[{slug, name, url}, ...]`,
  not `["beauty", "fragrances", ...]` as the docs table's one-line description might
  suggest. `CategoryOption` types this explicitly rather than assuming strings.
- **`expiresInMins` on login only shortens the access token, not the refresh token.**
  Confirmed by decoding both JWTs: with `expiresInMins: 1`, the refresh token still
  gets its normal, much longer default lifetime. That's actually convenient -- the
  1-minute access-token cycle can repeat indefinitely during a review session without
  needing a full re-authentication.

### Testing

21 tests across 4 files, concentrated on the logic that's easy to get wrong rather
than shallow coverage of everything:

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
  formatting rules never fight Prettier. Pinned to ESLint 9 rather than the
  newly-released 10 because `eslint-plugin-jsx-a11y`'s peer range doesn't cover 10
  yet -- accessibility linting mattered more than being on the newest major. Rule
  choices are explained inline in the config with one-line comments.
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
to point at a local proxy while testing the error path against `/http/500`, or
throttle requests with `?delay=`.

---

## Section 3 -- Deployment & CI/CD (status)

I haven't finished this part -- not an oversight, a scope call. Connecting a
GitHub/GitLab repo and a hosting provider needs my own accounts, and I built this
README and codebase in a session before doing that. Everything I could prepare
without those accounts is done:

- **CI workflow written:** `.github/workflows/ci.yml`. On every pull request into
  `main`: install, `format:check`, `lint`, `typecheck`, `test`, `build` (one job),
  plus a separate `commitlint` job that lints every commit added in the PR against
  Conventional Commits. Either job failing fails the PR's checks.
- **SPA-fallback rewrite configs included** for the two most likely static hosts --
  `vercel.json` and `public/_redirects` (Netlify) -- because `/items/:id` is
  client-side-routed; without a rewrite, a direct load or reload on that URL 404s on
  a plain static host. Whichever provider I end up on, I need to confirm it's
  honouring one of these before relying on the "paste this link" requirement.
- **Deploy is left to the provider's own git integration**, not a step inside
  `ci.yml`: connect the repo in Vercel/Netlify's dashboard, point its production
  branch at `main`, and it deploys automatically on every push to `main` -- which
  only happens via a merged PR once branch protection requires the `checks` job
  above to pass. That's "the pipeline" the brief asks for, split across two tools on
  purpose (GitHub Actions as the gate, the host as the deploy), which is genuinely
  how most small teams run this.

**Still to do:** push to GitHub, connect the repo on my chosen host, point its
production branch at `main`, add branch protection requiring the `checks` job, then
fill in the repo/live-app links at the top of this README and the two lines below.

- **Branch that triggers deployment:** `main`
- **Public URL:** _pending -- see above_

---

## Section 4 -- AI reflection

**1. What I used AI for, per section.**

- _Section 1 (Design):_ Heavily. I directed Claude through the assessment brief and
  had it probe the live DummyJSON API with me before we settled on the architecture,
  then it drafted the write-up and decision log above from that. The brief asks for
  this to be my own first draft, with AI used afterwards only to pressure-test it --
  that's not how this went, and I'd rather say so than have it come up in the live
  session unprepared.
- _Section 2 (Build):_ Nearly all of the code -- routing, the auth/refresh mutex, the
  filter/sort/paginate logic, the design-token CSS, the UI primitives, the test
  suite, and the tooling configuration (ESLint flat config, Prettier, Husky,
  commitlint). This is squarely inside what the brief calls "use freely" --
  scaffolding, boilerplate, tests once scope is decided, tooling setup.
- _Section 3 (CI/CD):_ The GitHub Actions workflow and the SPA-rewrite configs. The
  account-linking steps weren't done, as noted above.
- _Section 4 (this section):_ Drafted with AI too, from an accurate account of how
  the session actually went.

**2. Tools and workflow.** Claude Code, directed conversationally with the assessment
PDF as the brief -- no separate spec-driven framework (Spec Kit, BMAD, GSD, etc.). The
workflow: read the assessment PDF in full, probe the live DummyJSON API with `curl` to
verify behaviour the docs don't fully spell out (search/category composability, `PUT`
persistence, the shape of `/products/categories`, payload sizes) _before_ deciding the
architecture, then build outside-in -- types → API layer → auth → pure list/filter
logic → hooks → components → routes -- running `typecheck`/`lint`/`test`/`build` after
each layer rather than only at the end.

**3. One example where an AI suggestion improved the work.** The initial plan, before
any live testing, was to implement the stock list literally as the endpoint table in
the brief describes: search via `/products/search`, category filtering via
`/products/category/{slug}`. Actually calling both endpoints
(`curl "https://dummyjson.com/products/search?q=phone&sortBy=price"`,
`curl "https://dummyjson.com/products/category/groceries?sortBy=price"`) showed
neither can be combined with the other server-side. That single check changed the
whole data-fetching architecture to "fetch the trimmed catalogue once, filter
client-side" (decision log entry 1), which also made the search race-condition
requirement close to a non-issue rather than something needing careful debounce and
cancellation logic.

**4. One example where AI output was wrong or subtly bad, and how I caught it.** The
first version of the search-debounce hook and the stock-correction form's "re-sync
local state from a prop" logic both used a plain `useEffect` that called `setState`
synchronously in its body, and one used a ref mutated directly during render. Running
`npm run lint` immediately flagged both as errors under `eslint-plugin-react-hooks`
v7's newer rules (`set-state-in-effect`, `refs`) -- rules aligned with React's own
guidance on effects and the React Compiler, not stylistic nitpicks. The fixes weren't
suppressions: the debounce hook now uses `useEffectEvent` (React 19's sanctioned way
to read a "latest callback" without it being a reactive dependency), and the
stock-correction form uses React's documented "adjusting state when a prop changes"
pattern instead -- a guarded conditional `setState` call during render, which avoids
an extra commit/paint versus the effect version. Both are more correct now, not just
quieter.

**5. Two decisions I made without AI, and why I trusted my own judgment there.**
Honestly, at a code level, not many -- I directed scope and reviewed output, but most
moment-to-moment technical decisions were Claude's. The two clearest counterexamples:
(a) I scoped this session to Sections 1, 2 and 4 and left Section 3's account-linking
out rather than having the assistant attempt credentials or accounts it doesn't have
-- fabricated deployment claims would be worse than an honest gap; and (b) decision
log entry 7. The first build used the raw, unfiltered DummyJSON catalogue, per the
brief's literal instruction not to invent clinical content, and Claude flagged that
as a tension when I asked for the inventory to actually read as a clinic's. I held
my position after that was explained, so it got scoped to four categories instead.
That's a real product call I made against the assistant's initial caution, and it's
the one place in this submission where "why these categories and not others" has to
come from me, not from re-reading this document.

**6. The part of this codebase I'd struggle to defend.** `lib/auth/AuthContext.tsx`,
specifically how the proactive refresh timer, the `visibilitychange` backstop, and
React 19's Strict Mode double-invoking effects in development interact. It's only
indirectly tested: the underlying mutex in `refreshCoordinator.ts` is unit-tested in
isolation, but the timer-scheduling and event-subscription wiring around it in
`AuthContext` isn't, because it's timing- and browser-API-dependent in a way that
needs fake timers and real scaffolding to test well. I reasoned through it rather
than watched it run against a real 60-second expiry cycle in a browser. If asked to
defend it live: I'm confident in the mutex, because it's tested; I'm less confident
the timer fires at exactly the right moment across background-tab throttling and
Strict Mode's double-effect-invocation in dev, because I reasoned about it instead of
watching it happen.
