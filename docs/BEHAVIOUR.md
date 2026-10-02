# Behaviour notes

Where the requirements are silent or ambiguous, ShopLab does the simplest deterministic thing. This file records those choices. It is updated each phase.

## Phase 1: accounts, sessions, test endpoints

### Accounts and passwords
- Emails are trimmed and lowercased before they are stored or compared. `Customer1@ShopLab.test` and `customer1@shoplab.test` are the same account.
- Name: 2 to 60 characters after trimming. Email: a basic `x@y.zz` shape, at most 254 characters.
- Password rules: at least 8 characters, one uppercase letter, one digit, one symbol (any character that is not a letter or digit; a space counts). The first failing rule is reported, in the order length, uppercase, digit, symbol.
- Registration needs `name`, `email`, `password`, `confirmPassword` and `acceptTerms: true`. A password mismatch is reported on `confirmPassword`. All problems come back together in `fieldErrors`.
- Registering an email that is already used returns 409 `CONFLICT` with `fieldErrors.email`.
- A successful registration returns 201, logs the user in (cookie set, token returned) and the client goes to `/account`.
- New accounts are always role `customer`, start with no orders, addresses or wishlist items.

### Login and sessions
- `POST /api/auth/login` takes `email`, `password` and an optional `rememberMe` boolean.
- Success returns 200 with `{ token, user, expiresAt }` and sets an httpOnly, SameSite=Lax cookie named `shoplab_session`. The cookie is `Secure` when the request arrived over HTTPS.
- The token and the cookie hold the same value. Send either `Authorization: Bearer <token>` or the cookie. If both are sent, the bearer token is used.
- Session length: 1 hour by default, 7 days with `rememberMe: true`. The cookie lifetime matches. The clock starts at login and is not extended by activity.
- Wrong password and unknown email return the same 401 `INVALID_CREDENTIALS` message: "Invalid email or password."
- The locked account returns 423 `ACCOUNT_LOCKED` only when the password is correct. A wrong password for the locked account is a normal 401, so the lock cannot be used to discover which emails exist. A locked login is not counted as a failed attempt and never creates a session.
- If an account is locked while a session exists, that session stops working (401).
- Rate limit: after 5 failed attempts within 60 seconds, the next login attempt returns 429 `RATE_LIMITED` with a `Retry-After` header, even if the password is right. The counter is per client IP plus email, so failures for one email do not affect another. Attempts that are blocked do not extend the window. A successful login clears that key's counter. Only 401 failures count (not 400 validation errors or 423).
- `POST /api/auth/logout` needs a session, returns 204 and deletes it. Without a session it returns 401.
- `GET /api/auth/me` returns `{ user: { id, name, email, role } }`, or 401.

### Client behaviour
- Protected pages (`/account` now) redirect to `/login?next=<path>` and return there after login. Only same-site relative paths are followed; anything else falls back to `/account`.
- A logged-in user who opens `/login` or `/register` is sent on to `next` or `/account`.
- Wrong credentials, the locked account and the rate limit each show a message in an alert region above the login form.
- Register validates each field when it loses focus, validates everything again on submit, and shows server-side `fieldErrors` under the matching fields.
- The terms checkbox on the register form is plain text for now; the `/terms` page arrives with checkout.

### Error shape and status codes
- All API errors are `{ "error": { "code", "message", "fieldErrors"? } }`.
- Codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `INVALID_CREDENTIALS` 401, `PAYMENT_DECLINED` 402, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `ACCOUNT_LOCKED` 423, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500.
- Malformed JSON bodies return 400 `VALIDATION_ERROR`. Unknown `/api/*` paths return 404 `NOT_FOUND` as JSON.

### Health
- `GET /api/health` returns `{ status: "ok", version, uptimeSeconds }`. `uptimeSeconds` counts from process start. The version comes from the root `package.json`.

### Seed data
- IDs are fixed: users 1 to 4 (customer1, customer2, locked, admin), products 1 to 60, coupons keyed by code.
- Product stock: products with variants have `stock` equal to the sum of their variant stock. Sold out: products 7, 18, 29, 46, 53, 58. Low stock (1 to 3): 5, 14, 26, 38, 47, 55. On sale: 2, 8, 13, 15, 17, 22, 27, 33, 36, 39, 52, 57. Variants: 9, 11, 12, 13, 17, 18, 19, 20, 22, 30, 31, 33, 34, 54 (some are colour only). Very long names: 10, 25, 44. Same name in two categories: "Smart Lamp" (4 Electronics, 23 Home). No reviews: 60. 25 or more reviews: product 1 (28).
- Product 18 has variants that are all out of stock, so it counts as sold out.
- Seeded reviews have no linked user (`user_id` is null) and a display name only.
- Customer1 has 3 orders (Delivered, Shipped with SAVE10, Processing with express shipping), 2 wishlist items (products 36 and 21, in that order) and 2 addresses (Home in Sweden is the default, Work in the US).
- Order number format is `SL-YYYYMMDD-NNNN`, where `NNNN` is the order's numeric ID padded to 4 digits and the date is the order date in UTC.
- Seeded order totals follow the section 5.3 pricing rules, in integer cents with half-up rounding.
- Postal code rules are stored per country: 5 digits for Sweden and the US, 6 digits for India. Each country has 4 regions.
- Cart tables are not created yet; they arrive with the cart phase. Customer2's "empty cart" is therefore implicit for now.

### Reset and scenarios
- `POST /api/test/reset` deletes every row (including all sessions, so every logged-in user is logged out) and reloads the seed. It also clears the login attempt counters. It returns 204. The body is optional.
- `{"scenario": "default"}` is the standard seed.
- `empty-store`: the four accounts, coupons and countries only. No products, variants, reviews, orders, addresses or wishlist items.
- `low-stock`: the default seed, but every in-stock product (or variant, for products with variants) holds 1 to 3 units, chosen by ID. Sold-out items stay sold out. For products with variants the product total is the sum of its variants.
- `many-orders`: the default seed plus 47 more orders for customer1 (50 in total, IDs 1 to 50) with mixed statuses, dates and totals, for pagination and sorting.
- An unknown scenario returns 400 and changes nothing.
- Users created through `POST /api/test/users` are removed by the next reset.

### Test endpoints
- When `TEST_API_KEY` is set, every `/api/test/*` request must send `X-Test-Key`. A missing or wrong key returns 401. When it is not set the routes are open.
- `POST /api/test/users` takes `email`, `password`, optional `role` (`customer` or `admin`, default `customer`), optional `name` (default: the part of the email before `@`) and optional `locked` (boolean). The normal password rules apply. It returns 201 with the created user, or 409 if the email exists.
- `GET /api/test/state` returns the active scenario, a row count per table, the active defect flag IDs (always empty for now) and the current latency settings (neutral for now).

### Serving
- One service serves `/api` and the built client. Any GET for a path without a file extension that is not under `/api`, `/ads` or `/analytics` returns `index.html`, so direct loads of client routes work. Unknown file paths return 404.
- Every response carries `X-Robots-Tag: noindex, nofollow`, and the HTML has a `noindex` meta tag.
- Every response has an `X-Request-Id` header. An incoming `X-Request-Id` is reused if it is 1 to 64 safe characters.
