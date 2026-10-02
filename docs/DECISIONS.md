# Decisions

One line per notable technical decision.

- One npm workspaces repo (`client`, `server`) with root scripts, so `npm ci` and `npm run build` work from a clean clone and deploy as a single service.
- Server is TypeScript compiled to CommonJS with `tsc` (`server/dist`); `tsx` is used only for `dev` and `seed`.
- Client is React 19 + Vite + React Router with CSS Modules; Vite builds to `client/dist`, which Express serves with an `index.html` fallback for client routes.
- Express 5, with hand-written validation (no schema library) to keep the dependency list short.
- `better-sqlite3` with a file database (`DB_PATH`, default `data/shoplab.sqlite`); every table is dropped and recreated on boot, then seeded.
- Seed data lives in `server/seed/*.json` with fixed IDs; `server/scripts/generate-seed.mjs` produced those files once and is kept for reference, the JSON is the source of truth.
- Reset deletes all rows and reloads the JSON inside one transaction (about 10 ms), so no table is dropped while the server runs.
- Password hashes are precomputed bcrypt (cost 10) in `users.json` so reset does not pay for hashing; `bcryptjs` (pure JS) avoids a second native build step.
- One opaque random session token is used for both the httpOnly cookie and the bearer token; only its SHA-256 is stored.
- Login rate limit is an in-memory sliding window of failures keyed by client IP plus email, so one tester's failed attempts do not lock out other accounts.
- `/api/test/*` returns 401 when `TEST_API_KEY` is set and `X-Test-Key` is missing or wrong; the key is compared in constant time.
- Render build uses `npm ci --include=dev && npm run build` because Render can set `NODE_ENV=production`, which would otherwise skip the build tools.
- Client validation rules are duplicated from the server (small and stable) instead of adding a shared package.
- Client route guard redirects to `/login?next=<path>` and only follows `next` values that are same-site relative paths.
- Request logging is one plain-text line per response with a request ID, which is also returned in `X-Request-Id`.
- A `.env` file at the repo root is loaded on start if present (`process.loadEnvFile`); real environment variables win.
- Catalogue filtering is plain SQL over `products` joined to a per-product review aggregate; there are only 60 products, so no search index or ORM is used.
- The review average is held as integer tenths rounded half up (`(20*sum + n) / (2*n)`), so the rating filter, rating sort and the number shown on cards can never disagree through floating point.
- Query-string validation lives in one pure module (`server/src/lib/catalogueQuery.ts`) that returns a typed query or throws the standard 400, so it is unit tested without HTTP.
- Price query parameters are dollars (what a person types in the URL) while response fields are integer cents; this is recorded in BEHAVIOUR.md.
- Suggestions below 2 characters return 200 with an empty list rather than 400, because it is the client's job to wait for 2 characters and an empty list is the natural answer for "no suggestions".
- Wishlist add is idempotent (201 first time, 200 after) and remove of a missing item is 404; positions are renumbered on delete so they stay 1..n for the later reorder endpoint.
- Placeholder product images are generated inline SVG components (colour from the product ID, shape from the image number), so there are no image files, uploads or external requests.
- The listing keeps all filter state in the URL (`useSearchParams`) with no duplicate component state except the two price text boxes, which commit on Enter or Apply.
- `useFetch` is a small hook (loading, success, error, retry, abort on change); every data fetch uses it so each one has the same spinner and error-with-Retry behaviour.
- The modal is a hand-written portal with a focus trap and `inert` on the app root instead of a dialog library, to keep the dependency list unchanged.
- Add to cart calls a documented no-op in `client/src/lib/cart.ts` until the cart exists in Phase 3.
- The flash-sale countdown is computed in the browser from the UTC clock (next 00:00:00 UTC) so it needs no server state and is covered by unit tests.
