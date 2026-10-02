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
