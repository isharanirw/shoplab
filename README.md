# ShopLab

ShopLab is a deliberately realistic demo online store. It exists as a system under test: a place to practise UI, API and CI test automation against an application you fully control. It has a React front end, a REST API, resettable data and (in later phases) switchable defects and adjustable latency and failures.

Live site: https://shoplab-ffm2.onrender.com

> **Demo site. No real payments or personal data.** Everything you enter can be wiped at any time.

## Status

Phases 1 to 5 are complete. Phase 5 added the admin panel (products, orders, users), the remaining API endpoints, `docs/openapi.yaml` and Swagger UI at `/api/docs`. Phases 1 to 4: foundation (scaffold, database and seed data, authentication, health check, reset endpoint, CI), the catalogue (listing, search, filters, detail page, quick view, wishlist basics), cart and checkout (cart, coupons, pricing, four-step checkout with a payment iframe, orders and confirmation) and account and engagement (address book, order history with cancel, reviews with image upload, wishlist drag and drop, contact form). Later phases add the testability layer (defect flags, chaos mode) and polish.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Home: hero banner, flash-sale countdown, category links, featured products |
| `/products` | Listing: search (`q`), `category`, `subcategory`, `minPrice`, `maxPrice`, `inStock=true`, `rating`, `sort`, `page` all live in the query string |
| `/products/:id` | Product detail with gallery, options, quantity, and Description / Specs / Reviews tabs |
| `/wishlist` | The logged-in user's wishlist: reorder by drag and drop or Move up / Move down, Move to cart, Remove (login required) |
| `/login`, `/register` | Accounts (Phase 1) |
| `/account` | Profile (edit name) and address book (add, edit, delete, default) (login required) |
| `/account/orders` | Order history: sort by date or total, status filter, 5 per page, all in the query string (login required) |
| `/account/orders/:id` | One order, with Cancel order while it is Processing (login required, own orders only) |
| `/contact` | Contact form (topic, message, consent); linked from the footer |
| `/cart` | Cart (guests use localStorage and it merges into the server cart on login) |
| `/checkout` | Four-step checkout: address, delivery, payment, review (login required) |
| `/orders/:id/confirmation` | Confirmation page after placing an order (login required, own orders only) |
| `/payment-frame` | The card form that checkout embeds in an `<iframe>` (same origin) |
| `/terms` | Static terms and conditions (checkout links to it in a new tab) |
| `/admin` | Admin overview (admins only: logged out goes to `/login?next=/admin`, a customer sees a 403 page) |
| `/admin/products` | Searchable, paginated product table (`q`, `active`, `page` in the query string); delete with a confirm modal |
| `/admin/products/new`, `/admin/products/:id/edit` | Product form: name, category, subcategory, description, price, sale price, stock, image upload, active |
| `/admin/orders` | All orders, newest first, status filter and a status dropdown per order |
| `/admin/users` | All users with a lock / unlock switch |
| `/api/docs` | Swagger UI for the whole API (bundled, no external requests); the raw spec is at `/api/docs/openapi.yaml` and in `docs/openapi.yaml` |

## API endpoints

Lists return `{ data, page, pageSize, total }`; errors use the shape described below. Full rules (what search matches, what "in stock" and "rating" mean, sort order, paging past the end) are in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md).

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/products` | Public | List with `q`, `category` (repeatable), `subcategory`, `minPrice`, `maxPrice` (dollars), `inStock`, `rating`, `featured`, `sort` (`price_asc`, `price_desc`, `rating`, `newest`), `page`, `pageSize` (default 12, max 50) |
| `GET /api/products/suggest?q=` | Public | Up to 5 name suggestions; empty list for fewer than 2 characters |
| `GET /api/products/{id}` | Public | Detail with variants, stock per variant and a rating summary |
| `GET /api/products/{id}/reviews` | Public | Reviews, 5 per page, `sort` = `newest`, `highest` or `lowest` |
| `GET /api/products/{id}/review-eligibility` | Public | `{ eligible, reason }` for the caller (`login_required`, `not_purchased`, `already_reviewed`) |
| `POST /api/products/{id}/reviews` | User | Multipart: `rating`, `title`, `body` (20+ characters), optional `image` (PNG or JPEG, 2 MB). 201; 400 validation or bad image; 403 not a buyer; 409 already reviewed; 413 image too large |
| `GET /api/categories` | Public | Categories with subcategories and product counts |
| `GET /api/promotions` | Public | Home banner text (fixed value) |
| `GET /api/wishlist` | User | The user's wishlist |
| `POST /api/wishlist` | User | Add `{"productId": 5}` (201, or 200 if already there) |
| `DELETE /api/wishlist/{productId}` | User | Remove an item (204, or 404 if it was not there) |
| `PUT /api/wishlist/order` | User | Save the order: `{"productIds": [..]}` must list exactly the wishlist items (400 otherwise); returns the list |
| `GET /api/cart` | User | The cart: items, coupon status, `itemCount` and totals (Standard shipping) |
| `POST /api/cart/items` | User | Add `{productId, variantId?, quantity}` (201 new line, 200 merged; 400 bad quantity or variant, 409 over stock) |
| `PATCH /api/cart/items/{itemId}` | User | Set `{quantity}` (1 to 10, within stock) |
| `DELETE /api/cart/items/{itemId}` | User | Remove a line |
| `DELETE /api/cart` | User | Clear the cart and its coupon |
| `POST /api/cart/coupon`, `DELETE /api/cart/coupon` | User | Apply `{code}` or remove the coupon (one at a time) |
| `POST /api/cart/merge` | User | Merge guest lines into the cart (used after login) |
| `POST /api/checkout/quote` | User | Totals preview for `{shippingMethod, country}` |
| `POST /api/orders` | User | Place an order (201; 400 validation; 402 declined card; 409 not enough stock) |
| `GET /api/orders` | User | Own orders: `status`, `sort` (`date_desc`, `date_asc`, `total_desc`, `total_asc`), `page`, `pageSize` (default 5); rows are summaries |
| `GET /api/orders/{id}` | User | One of your own orders (404 for anyone else's) |
| `POST /api/orders/{id}/cancel` | User | Cancel while Processing and restore stock (200; 409 in any other status; 404 for anyone else's) |
| `GET /api/countries` | Public | Sweden, United States, India with regions and postal rules |
| `GET /api/addresses`, `GET /api/addresses/{id}` | User | Saved addresses, default first / one address |
| `POST /api/addresses` | User | Add an address (201). The first one becomes the default; `isDefault: true` moves the default |
| `PATCH /api/addresses/{id}` | User | Change fields (validated as a whole); 400 when unsetting the only default |
| `DELETE /api/addresses/{id}` | User | Delete (204); deleting the default promotes the earliest remaining address |
| `PATCH /api/auth/me` | User | Change the display name `{"name"}` |
| `POST /api/contact` | Public | `{topic, message, consent}`; stored in the database, no email is sent (201) |
| `GET /api/geo` | Public | Detected shipping country: always Sweden unless `?country=US` (or SE, IN) overrides it; 400 for an unknown code |
| `GET /api/admin/products`, `GET /api/admin/products/{id}` | Admin | All products incl. inactive: `q`, `active`, `page`, `pageSize` (default 10) / one product |
| `POST /api/admin/products` | Admin | Create (201). JSON, or multipart with an `image`. IDs continue from 61. 400 with `fieldErrors`; 413 image over 2 MB |
| `PATCH /api/admin/products/{id}` | Admin | Change any fields (`active: false` hides it from the store; `removeImage: true` drops the image) |
| `DELETE /api/admin/products/{id}` | Admin | Hard delete (204). Order history keeps its own copy of the lines |
| `GET /api/admin/orders` | Admin | Every order, newest first: `status`, `page`, `pageSize` |
| `PATCH /api/admin/orders/{id}/status` | Admin | `{"status"}`. Forward only (Processing, Shipped, Delivered) or Cancelled from Processing or Shipped (returns stock); 409 otherwise |
| `GET /api/admin/users` | Admin | Users: `q`, `page`, `pageSize` |
| `PATCH /api/admin/users/{id}/lock` | Admin | `{"locked": true}`. Ends the user's sessions; 409 when locking yourself |

Every `/api/admin/*` route is 401 without a login and 403 for a customer. The full, machine-readable description of every endpoint (parameters, bodies, schemas, status codes) is [docs/openapi.yaml](docs/openapi.yaml); run the app and open `/api/docs` for Swagger UI with a Try it out button. A test (`server/src/openapi.contract.test.ts`) keeps the file in step with the real responses.

## Cart, coupons and test cards

Prices are integer cents: subtotal, minus at most one coupon, plus shipping (Standard $5.00, free from $100.00 after discount; Express $15.00, never free), plus 10% tax on subtotal minus discount (shipping is not taxed). Rounding is half up at the discount and tax steps. Example: 2 x $30.00 + 1 x $45.50 = $105.50, SAVE10 -$10.55, shipping $5.00, tax $9.50, total $109.45 (in the seed data: 2 x product 15 and 3 x product 23).

| Coupon | Rule |
| --- | --- |
| `SAVE10` | 10% off the subtotal |
| `FREESHIP` | Free Standard shipping when the subtotal is $30.00 or more |
| `MIN100` | $20.00 off when the subtotal is $100.00 or more |
| `ONCE5` | $5.00 off, once per account (used up when an order is placed) |
| `EXPIRED20` | Always rejected as expired |

| Test card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Payment is declined (402) when the order is placed |
| anything else | Rejected as invalid inside the payment frame |

Use any future expiry (MM/YY) and any 3 digit code. No real payment is processed, and the card number never reaches the server (only a token such as `tok_ok_4242`). Postal codes are 5 digits for Sweden and the US and 6 digits for India. Order numbers look like `SL-YYYYMMDD-NNNN`. Rules for merging the guest cart, delivery dates and every error case are in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md).

## Run it locally

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
npm run build
npm start
```

Then open http://localhost:3000. For development with hot reload, run `npm run dev` (API on port 3000, Vite on http://localhost:5173).

Other scripts: `npm run seed`, `npm run lint`, `npm run typecheck`, `npm test`. Copy `.env.example` to `.env` to change the port, database path, uploads directory or test key.

Review images are saved in `uploads/` (git-ignored, served at `/uploads/reviews/...`); product images uploaded in the admin panel go to `uploads/products/...`. `POST /api/test/reset` deletes both kinds together with the reviews and products people added, so the data matches the seed again. On the free Render tier the disk is ephemeral anyway.

## Demo accounts

All accounts and passwords are demo values, recreated identically on every boot and every reset.

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Customer | customer1@shoplab.test | Test@1234 | 3 past orders (Delivered, Shipped, Processing), 2 wishlist items, 2 saved addresses. Can review products 3, 6, 1, 11, 41, 40 and 56 |
| Customer | customer2@shoplab.test | Test@1234 | No orders, empty cart, no addresses |
| Customer (locked) | locked@shoplab.test | Test@1234 | Login is refused with an "account locked" message |
| Admin | admin@shoplab.test | Admin@1234 | Full access to the admin panel |

New accounts can be registered with any unused email. Passwords need at least 8 characters, one uppercase letter, one digit and one symbol.

## Test endpoints

These help automated tests set up and tear down data. When the `TEST_API_KEY` environment variable is set (it is on the public deployment), send the same value in an `X-Test-Key` header. Locally the key is optional.

| Endpoint | What it does |
| --- | --- |
| `GET /api/health` | `{ status, version, uptimeSeconds }`. Poll this to wake a sleeping free-tier host. |
| `POST /api/test/reset` | Restores the seed data and returns 204. Optional body `{"scenario": "default" \| "empty-store" \| "low-stock" \| "many-orders"}`. |
| `POST /api/test/users` | Creates a user: `{"email", "password", "role"?, "name"?, "locked"?}`. Returns 201. |
| `GET /api/test/state` | Row counts per table, active scenario, active defect flags and latency settings. |

```bash
curl -X POST http://localhost:3000/api/test/reset \
  -H "Content-Type: application/json" -H "X-Test-Key: $TEST_API_KEY" \
  -d '{"scenario": "low-stock"}'
```

A typical test setup: reset, create a throwaway admin with `POST /api/test/users` (`{"email": "qa-admin@shoplab.test", "password": "Qa@12345", "role": "admin"}`), log in with `POST /api/auth/login` to get a `token`, then call `/api/admin/*` with `Authorization: Bearer <token>`. Another reset removes the extra user, uploaded images and any admin changes. `X-Test-Key` is only for `/api/test/*`; the admin API uses the normal login.

The API uses one error shape, `{"error": {"code", "message", "fieldErrors"}}`, and accepts either the httpOnly session cookie or `Authorization: Bearer <token>` (the token is returned by `POST /api/auth/login`). Behaviour details are in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md); technical decisions are in [docs/DECISIONS.md](docs/DECISIONS.md).

## How it was built

ShopLab was built with AI assistance (Claude). All testing is done separately by the project owner, in separate repositories, as in a real team.
