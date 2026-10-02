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

## Phase 2: catalogue

### Product list: `GET /api/products`
- Response: `{ data, page, pageSize, total }`. Each item has `id, name, category, subcategory, priceCents, salePriceCents, stock, inStock, hasVariants, featured, imageCount, rating { average, count }, createdAt`. Prices are integer cents.
- Parameters: `q, category, subcategory, minPrice, maxPrice, inStock, rating, featured, sort, page, pageSize`. Unknown parameters are ignored. An empty value (`q=`) counts as not sent.
- **Search (`q`)**: the text is trimmed, then matched as a case-insensitive substring of the product name only (not category or description). Case folding is for ASCII letters. `%` and `_` have no special meaning. At most 100 characters.
- **Category**: repeat the parameter (`category=Home&category=Toys`) or comma separate it. Names match ignoring case, and several categories mean "any of these". An unknown category is a 400, not an empty list. `subcategory` (one value, matched ignoring case) narrows further; subcategory names repeat across categories ("Accessories" is in Electronics and Clothing), so combine it with `category`.
- **Price**: `minPrice` and `maxPrice` are in dollars (`10` or `10.50`, at most 2 decimals), both inclusive, and apply to the price a customer pays: the sale price when there is one, otherwise the regular price. `minPrice` above `maxPrice` is a 400. Prices in responses are cents.
- **Out of stock**: a product is out of stock when its `stock` is 0. For products with variants `stock` is the sum of the variant stock, so a product whose variants are all at 0 (product 18) is out of stock, while a product with at least one variant in stock counts as in stock. `inStock=true` hides out-of-stock products; `inStock=false` is the same as not sending it.
- **Rating**: a product's rating is the average of its review ratings, rounded half up to one decimal (3.96 becomes 4.0). `rating=N` (1 to 5) keeps products whose rounded average is at least N, so the number a card shows is the number the filter uses. Products with no reviews never match a rating filter.
- **Sort**: `price_asc`, `price_desc` (by the price paid, ties by ID), `rating` (highest first; ties go to the product with more reviews, then the lower ID; unrated products last), `newest` (by created date, newest first, ties by higher ID). With no `sort` the order is product ID ascending.
- **Paging**: `page` starts at 1, `pageSize` defaults to 12 and is at most 50. A page past the end returns 200 with an empty `data`, the real `total` and the requested `page`.
- `featured=true` returns only the 8 featured products (1, 2, 13, 22, 27, 31, 33, 52). The home page uses it.
- Bad values return 400 `VALIDATION_ERROR` with every problem in `fieldErrors` (keyed by parameter name): non-numeric or out-of-range numbers, a repeated single-value parameter, an unknown `sort`, `category` or `subcategory`, or `inStock`/`featured` other than `true`/`false`.

### Other catalogue endpoints
- `GET /api/products/suggest?q=`: up to 5 matches, `{ data: [{ id, name, category }], page: 1, pageSize: 5, total }` where `total` is the full match count. Names that start with the text come first, then other substring matches, each group by ID. With fewer than 2 characters after trimming (or no `q`) it returns 200 with an empty list, not an error. Over 100 characters is a 400. Products that share a name appear twice, told apart by category.
- `GET /api/products/{id}`: the list fields plus `description`, `specs [{ label, value }]`, `variants [{ id, size, colour, stock }]` (empty when there are none) and `ratingDistribution { "1".."5" }`. An ID that is not a positive whole number is a 400; an unknown product is a 404.
- `GET /api/products/{id}/reviews`: 5 per page by default (`pageSize` up to 50), `sort` is `newest` (default), `highest` or `lowest`. Ties are broken by newest, then higher ID, so paging is stable. A product with no reviews returns an empty list; an unknown product is a 404.
- `GET /api/categories`: `{ data: [{ name, productCount, subcategories: [{ name, productCount }] }] }`. Categories are in the fixed order Electronics, Clothing, Home, Sports, Books, Toys; subcategories are alphabetical.
- `GET /api/promotions`: always `{ bannerText: "Free standard shipping on orders of $100 or more.", flashSaleLabel: "Flash sale: extra savings on selected items" }`.

### Wishlist API (login required, 401 otherwise)
- `GET /api/wishlist` returns the user's items in wishlist order, in the list shape with the product fields plus `position` and `addedAt`. The list is not paged, so `pageSize` equals the item count.
- `POST /api/wishlist` with `{ "productId": 5 }` appends the product and returns 201 `{ productId }`. Adding a product that is already there changes nothing and returns 200. A non-integer `productId` is a 400; an unknown product is a 404.
- `DELETE /api/wishlist/{productId}` returns 204 and renumbers the remaining items 1 to n. A product that is not on the wishlist is a 404. Each user sees only their own list. Reordering comes with the drag-and-drop work in a later phase.

### Header, search and navigation
- The search box suggests after 2 characters and a 300 ms pause in typing, showing up to 5 suggestions in a list. ArrowDown/ArrowUp move through them (wrapping), Enter on a highlighted one opens that product, Enter with none highlighted (or the Search button) goes to `/products?q=<text>`, Escape closes the list. A failed suggestion request shows a message with a Retry button inside the list.
- On `/products` the box shows the `q` from the URL.
- Desktop (768px and wider): the category bar shows All products and the six categories. Hovering or tabbing to a category opens a panel of its subcategories; Escape closes it. A category link goes to `/products?category=<name>`, a subcategory to `/products?category=<name>&subcategory=<name>`.
- Under 768px: a Menu (hamburger) button opens a drawer with the same links; each category has a + button that expands its subcategories. Following a link closes the drawer.
- Header account links: logged out shows Log in and Register; logged in shows Wishlist, My account and Log out.

### Home `/`
- The banner text comes from `/api/promotions`; a failure shows an error with Retry. Below it: the flash-sale countdown, links to the six categories, and the 8 featured products.
- **Flash-sale countdown**: it always counts down to the next 00:00:00 UTC, shown as HH:MM:SS, and updates once a second from the browser clock. At exactly midnight it restarts at 24:00:00. It does not depend on the server.

### Listing `/products`
- 12 cards per page. Filters, sort and page live in the URL (`q, category (repeated), subcategory, minPrice, maxPrice, inStock=true, rating, sort, page`); the URL is the single source of truth, so a direct load or reload restores the same view, and back/forward steps through changes. Default values are left out of the URL. Invalid values in the URL are ignored by the page, except values the API rejects (for example an unknown category), which show an error with the API message, a Retry button and a Clear all filters button.
- Any change to a filter or the sort goes back to page 1.
- Category checkboxes, the in-stock checkbox and the rating radios apply immediately. Min and max price apply when you press Enter in either box or click Apply price; a minimum above the maximum shows an inline message and nothing is requested.
- The rating radios are Any, 4, 3, 2 and 1 stars and up. The sort dropdown is Default order, Price: low to high, Price: high to low, Rating, Newest.
- The result count reads "Showing 1–12 of 60 products" (with "for “text”" when searching), or "0 products found". With no matches an empty state offers Clear all filters. A page past the end shows "No products on this page" with a Go to page 1 button.
- Pagination has Previous and Next buttons (disabled at the ends) and numbered page buttons with the current one marked `aria-current="page"`. With many pages the numbers collapse around the current page.
- While loading there is a spinner and grey placeholder cards. A failed request shows an error with Retry. On narrow screens the filters sit behind a Show filters button.

### Product card and quick view
- A card shows a generated SVG placeholder (no external images; colour from the product ID), name, category, price (sale price in red with the regular price struck through), rating, stock badge, Quick view, Add to cart and a wishlist heart.
- Stock badge: "Out of stock" at 0, "Only N left" at 1 to 3, otherwise "In stock".
- Rating on a card: five stars rounded to the nearest whole star, the one-decimal average and the review count; "No reviews yet" when there are none.
- **Add to cart is a stub.** The cart is built in Phase 3, so the client calls `addToCart()` in `client/src/lib/cart.ts`, which does nothing, and the page shows "The cart is not available yet, so nothing was added." The enabled and disabled rules are real: out-of-stock products are disabled, and the button is disabled on the detail page and quick view until every required option is chosen.
- On a card, Add to cart for a product with sizes or colours opens the quick view (there is nothing to choose on the card). Out-of-stock cards have it disabled.
- Wishlist heart: logged-in users add or remove the product (the label switches between "Add to wishlist: <name>" and "Remove from wishlist: <name>"). Logged-out users are sent to `/login?next=<current page and query>` and return there after logging in.
- Quick view is a dialog loaded from `/api/products/{id}` with the image, price, rating, description, the same option and quantity controls as the detail page, and a link to the full page. It closes with the X button, Escape or a click on the dark backdrop. Focus moves into the dialog, Tab and Shift+Tab stay inside it, the page behind is inert, and focus returns to the button that opened it.

### Detail page `/products/:id`
- Gallery: the product's 3 placeholder images as thumbnail buttons (`aria-pressed`) that swap the main image; each image has a different shape and "Image N" text.
- Options: a Size dropdown when the product has sizes and Colour radio swatches when it has colours (some products have colours only). An option is disabled and marked "(out of stock)" when no in-stock variant matches it together with what is already chosen, so an out-of-stock combination cannot be selected.
- The stock badge follows the selection: the chosen variant's stock, or the product total until a variant is chosen.
- Quantity stepper: 1 up to the smaller of 10 and the stock of the selection. The minus and plus buttons disable at the limits; typed values are clamped to the range when the box loses focus; choosing an option with less stock lowers the quantity to fit. An out-of-stock product shows 0 and everything is disabled.
- Add to cart is disabled while options are missing (with a short reason shown next to it), when the chosen variant has no stock, and when the product is out of stock.
- Tabs Description, Specs and Reviews (arrow keys, Home and End move between them). Clicking the review count on the page opens Reviews.
- Reviews: 5 per page, sort dropdown (Newest first, Highest rated, Lowest rated), pagination, and a summary with the average and a count per star. Changing the sort goes back to page 1. Product 60 has none ("There are no reviews for this product yet."); product 1 has 28 (6 pages, the last with 3).
- An unknown or non-numeric ID shows a "Product not found" page (the API answers 404 or 400) with a link to the catalogue. Other failures show an error with Retry.

### Wishlist page `/wishlist`
- Login required (redirects to `/login?next=/wishlist`). Lists the user's products as cards in wishlist order, each with a Remove button (the heart is hidden here). Removing takes the item out at once, announces it and moves focus to the heading. An empty list shows a message and a Browse products link.
