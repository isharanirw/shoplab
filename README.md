# ShopLab

ShopLab is a deliberately realistic demo online store. It exists as a system under test: a place to practise UI, API and CI test automation against an application you fully control. It has a React front end, a REST API, resettable data and (in later phases) switchable defects and adjustable latency and failures.

Live site: https://shoplab-ffm2.onrender.com

> **Demo site. No real payments or personal data.** Everything you enter can be wiped at any time.

## Status

Phase 1 (foundation) and Phase 2 (catalogue) are complete. Phase 1 covers the scaffold, database and seed data, authentication, health check, reset endpoint and CI. Phase 2 adds the product listing with search, filters, sorting and pagination, the product detail page, quick view, and a basic wishlist. The cart is not built yet: "Add to cart" buttons follow the real enabled/disabled rules but do nothing. Later phases add the cart and checkout, account features, admin, and the testability layer.

## Routes

| Route | What it shows |
| --- | --- |
| `/` | Home: hero banner, flash-sale countdown, category links, featured products |
| `/products` | Listing: search (`q`), `category`, `subcategory`, `minPrice`, `maxPrice`, `inStock=true`, `rating`, `sort`, `page` all live in the query string |
| `/products/:id` | Product detail with gallery, options, quantity, and Description / Specs / Reviews tabs |
| `/wishlist` | The logged-in user's wishlist (login required) |
| `/login`, `/register`, `/account` | Accounts (Phase 1) |

## API endpoints

Lists return `{ data, page, pageSize, total }`; errors use the shape described below. Full rules (what search matches, what "in stock" and "rating" mean, sort order, paging past the end) are in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md).

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `GET /api/products` | Public | List with `q`, `category` (repeatable), `subcategory`, `minPrice`, `maxPrice` (dollars), `inStock`, `rating`, `featured`, `sort` (`price_asc`, `price_desc`, `rating`, `newest`), `page`, `pageSize` (default 12, max 50) |
| `GET /api/products/suggest?q=` | Public | Up to 5 name suggestions; empty list for fewer than 2 characters |
| `GET /api/products/{id}` | Public | Detail with variants, stock per variant and a rating summary |
| `GET /api/products/{id}/reviews` | Public | Reviews, 5 per page, `sort` = `newest`, `highest` or `lowest` |
| `GET /api/categories` | Public | Categories with subcategories and product counts |
| `GET /api/promotions` | Public | Home banner text (fixed value) |
| `GET /api/wishlist` | User | The user's wishlist |
| `POST /api/wishlist` | User | Add `{"productId": 5}` (201, or 200 if already there) |
| `DELETE /api/wishlist/{productId}` | User | Remove an item (204, or 404 if it was not there) |

## Run it locally

Requires Node 22 (see `.nvmrc`).

```bash
npm ci
npm run build
npm start
```

Then open http://localhost:3000. For development with hot reload, run `npm run dev` (API on port 3000, Vite on http://localhost:5173).

Other scripts: `npm run seed`, `npm run lint`, `npm run typecheck`, `npm test`. Copy `.env.example` to `.env` to change the port, database path or test key.

## Demo accounts

All accounts and passwords are demo values, recreated identically on every boot and every reset.

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| Customer | customer1@shoplab.test | Test@1234 | 3 past orders, 2 wishlist items, 2 saved addresses |
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

The API uses one error shape, `{"error": {"code", "message", "fieldErrors"}}`, and accepts either the httpOnly session cookie or `Authorization: Bearer <token>` (the token is returned by `POST /api/auth/login`). Behaviour details are in [docs/BEHAVIOUR.md](docs/BEHAVIOUR.md); technical decisions are in [docs/DECISIONS.md](docs/DECISIONS.md).

## How it was built

ShopLab was built with AI assistance (Claude). All testing is done separately by the project owner, in separate repositories, as in a real team.
