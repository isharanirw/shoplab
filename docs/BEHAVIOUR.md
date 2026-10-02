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
- The terms checkbox on the register form is plain text; the static `/terms` page now exists (Phase 3) and checkout links to it.

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
- Order number format is `SL-YYYYMMDD-NNNN` with the date in UTC. The seeded orders use their ID as `NNNN` (0001 to 0003, or up to 0050 in `many-orders`); orders placed through checkout use a per-day sequence (see Phase 3).
- Seeded order totals follow the section 5.3 pricing rules, in integer cents with half-up rounding.
- Postal code rules are stored per country: 5 digits for Sweden and the US, 6 digits for India. Each country has 4 regions.
- Carts live in the `carts` and `cart_items` tables (Phase 3). Every user, including customer1, starts with an empty cart; reset empties all carts.

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
- `DELETE /api/wishlist/{productId}` returns 204 and renumbers the remaining items 1 to n. A product that is not on the wishlist is a 404. Each user sees only their own list. Reordering is `PUT /api/wishlist/order` (see Phase 4).

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
- **Add to cart** is real as of Phase 3 (see Phase 3 below). After a successful add the card, detail page or quick view says "Added N × name to your cart." with a View cart link; a refused add (for example over the stock) shows the reason. The enabled and disabled rules are unchanged: out-of-stock products are disabled, and the button is disabled on the detail page and quick view until every required option is chosen.
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
- Login required (redirects to `/login?next=/wishlist`). Lists the user's products in wishlist order. Reorder, Move to cart and Remove are described under Phase 4. An empty list shows a message and a Browse products link.

## Phase 3: cart, coupons, checkout, orders

### Pricing (integer cents)
- Subtotal = sum of unit price x quantity, where the unit price is the sale price when the product is on sale.
- Discount = at most one coupon, applied to the subtotal. Percent discounts are rounded half up to a whole cent (10% of $10.05 is 100.5 cents, so 101). A fixed discount is never more than the subtotal.
- Shipping: Standard $5.00, free when the subtotal after discount is $100.00 or more. Express $15.00, never free (not even with FREESHIP). An empty cart has no shipping.
- Tax = 10% of (subtotal - discount), rounded half up (a taxable amount of $94.95 gives $9.50). Shipping is not taxed.
- Total = subtotal - discount + shipping + tax. Worked example: 2 x $30.00 + 1 x $45.50 = $105.50, SAVE10 takes $10.55 off, shipping $5.00, tax $9.50, total $109.45. In the seed catalogue the same numbers come from 2 x product 15 (sale price $12.25) and 3 x product 23 ($27.00).
- The cart page shows totals with **Standard** shipping because the method is chosen at checkout. `POST /api/checkout/quote` and the checkout summary use the chosen method. The country does not change any price (tax is a flat 10%, shipping is the same everywhere), but it must be Sweden, the US or India (`SE`, `US`, `IN`).

### Coupons
- Codes are matched ignoring case and surrounding spaces. `SAVE10`: 10% off the subtotal. `FREESHIP`: free Standard shipping when the subtotal is $30.00 or more. `MIN100`: $20.00 off when the subtotal is $100.00 or more. `ONCE5`: $5.00 off, once per account. `EXPIRED20`: always rejected as expired.
- Minimums are checked on the subtotal before the discount. `ONCE5` has no minimum.
- Only one coupon can be attached to a cart. Applying a second one returns 409 and asks you to remove the first. Applying the same code again is also a 409.
- Applying a coupon is rejected with 400 (`fieldErrors.code` and the message say why) when the code is unknown, the cart is empty, or the coupon is expired, already used by this account, or below its minimum subtotal (checked in that order).
- **FREESHIP in the totals**: it has no money discount, so the Discount line stays $0.00 (labelled with the code) and the Shipping line shows $0.00 and says "free". It only affects Standard shipping; with Express the coupon stays attached and changes nothing.
- **When the cart drops below a coupon's minimum** (or the coupon stops qualifying for any other reason) the coupon stays attached but contributes nothing. The cart response sets `coupon.applied: false` with a `reason` and `message`, and the cart page shows "Not applied right now". If the cart grows again the coupon applies again. Nothing is removed automatically; the shopper can remove it. The same rule is used by the quote and by order placement, so an order never carries a discount the cart does not show.
- `ONCE5` is consumed when an order is placed with it, not when it is applied. "Used" means the account has any order carrying that code, including one cancelled later (cancelling does not give the coupon back). Applying it, removing it and applying it again before ordering is fine. Another account can still use it.

### Cart API (login required, 401 otherwise)
- `GET /api/cart` returns `{ items, itemCount, coupon, totals }`. Each item has `id, productId, variantId, name, category, imageCount, variantLabel, unitPriceCents, regularPriceCents, onSale, quantity, lineTotalCents, stock, maxQuantity, inStock`. `itemCount` is the sum of the quantities (the header badge). `coupon` is null or `{ code, description, applied, reason, message }`. `totals` has `subtotalCents, discountCents, shippingMethod, shippingCents, taxCents, totalCents`. Every cart endpoint below returns this same cart.
- `POST /api/cart/items` takes `productId`, `variantId` (required for products that have variants, not allowed for products that do not) and `quantity`. It returns 201 for a new line and 200 when it merged into the existing line for the same product and variant.
- **Quantity rules**: a whole number from 1 to 10, otherwise 400. A line can never hold more than the stock of the product (or of the variant when there are variants) or more than 10: when adding would take a line past either limit the answer is 409 with the reason ("Only 3 in stock. You already have 3 in your cart."), not a silent cap. An unknown or inactive product is 404, a wrong variant is 400.
- `PATCH /api/cart/items/{itemId}` takes `{ quantity }` with the same rules (400 outside 1 to 10, 409 over the stock). `DELETE /api/cart/items/{itemId}` removes a line. A line that belongs to someone else, or does not exist, is 404.
- `DELETE /api/cart` clears the lines and the coupon. `POST /api/cart/coupon` takes `{ code }`; `DELETE /api/cart/coupon` removes it (200 even when there was none).
- `POST /api/cart/merge` takes `{ items: [{ productId, variantId?, quantity }] }` (up to 100 lines, each quantity 1 to 10) and is what the client calls right after login (see below). It returns `{ cart, adjustments }`.
- A cart is stored on the server and survives logging out and in. A user's cart is only visible to that user. Reset clears every cart.
- The cart does not hold stock: a line can be above the current stock if someone else bought items meanwhile. The cart then shows "Only N in stock" or "out of stock" on that line, disables Proceed to checkout, and the order endpoint answers 409.

### Guest cart and merge on login
- A guest's cart is stored in `localStorage` under `shoplab.guestCart` as a list of `{ productId, variantId, quantity }`. Guests can browse, add, change quantities, remove and clear. The same quantity rules apply (adding past the stock or 10 shows the same message as the API). The guest cart page shows each line and the subtotal only; coupons, shipping, tax and the total need an account. Proceed to checkout sends guests to `/login?next=/checkout`.
- After a successful login (or registration) the client sends the guest lines to `POST /api/cart/merge` and clears `localStorage`. Merge rules: lines for the same product and variant add their quantities together; the result is capped at min(10, stock); a product that no longer exists, or a variant with no stock, is skipped. Existing server lines keep their position and new guest lines follow. Only lines the guest cart touched are changed. The response lists each cap or skip (`reason` is `capped`, `out_of_stock` or `unavailable`) and the cart page shows them in a dismissible notice. If the merge request fails the guest cart is kept in `localStorage`.
- Example: the server cart holds 5 of a product, the guest cart holds 10: the merged line is 10 (capped) and the notice says so.

### Cart page `/cart`
- Open to everyone. Loading shows a spinner, a failed load shows an error with Retry, an empty cart shows "Your cart is empty." with a Browse products link.
- Quantity can be typed (committed on Enter or when the box loses focus) or changed with the minus and plus buttons. A typed value above the limit is set to the limit (10 or the stock) and a note says so; a value below 1 becomes 1; text that is not a number is ignored.
- **Remove** asks with the browser's native `window.confirm()` ("Remove <name> from your cart?"). **Clear cart** opens a custom modal ("Clear your cart?", with Cancel and Clear cart buttons; Escape and Cancel close it and focus returns to the Clear cart button). The difference is deliberate.
- The coupon form shows a success message ("Coupon SAVE10 applied: 10% off the subtotal.") or the API's error text, announced politely. The message disappears when the cart's subtotal changes.
- The header shows "Cart" with a badge holding the item count; it updates as soon as a change succeeds and shows 0 for an empty cart.

### Delivery dates
- The preferred delivery date runs from tomorrow to 14 days ahead, counted from today's UTC date (so on Friday 2 Oct 2026 the range is 3 Oct to 16 Oct). Standard delivery cannot be on a Saturday or Sunday (UTC); Express can. The server checks the same rule (400 `fieldErrors.deliveryDate`).
- The calendar is a grid with Monday first. Days that cannot be chosen stay in the grid, are marked `aria-disabled` and are announced with the reason ("unavailable, Standard delivery is not available on weekends"); clicking or selecting one does nothing. Keys: arrows move by day and week, Home and End go to Monday and Sunday of that week, PageUp and PageDown change the month (with Shift, the year, within the two months shown), Enter and Space select. Switching from Express to Standard clears a weekend date and says why.

### Countries and addresses
- `GET /api/countries` (public) returns `{ data, page, pageSize, total }` with Sweden, the US and India (sorted by name), each with `code, name, postalPattern, postalHint` and 4 `regions`. The postal rule is 5 digits for Sweden and the US and 6 digits for India (spaces are not allowed inside).
- `GET /api/addresses` (login required) lists the user's saved addresses, default first, in the list shape. The address book (add, edit, delete, default) is described under Phase 4; checkout reads the same data.
- A new address at checkout has first name, last name, street, country, region, postal code and phone; there is no city field (it is stored as empty). The region must belong to the chosen country. Phone: digits, spaces, `+`, `-` and parentheses, 7 to 15 digits. A new checkout address is stored on the order only, not in the address book.

### Payment frame and test cards
- Step 3 embeds `/payment-frame` (a same-origin page without the site header) in an `<iframe title="Card payment details">`. The frame validates the form (name, card number, expiry MM/YY not in the past, 3 digit CVC) and posts a message to the parent with `postMessage`, targeted at the page's own origin. The parent accepts a message only if it came from that iframe and that origin.
- Cards: `4242 4242 4242 4242` is accepted and succeeds. `4000 0000 0000 0002` is accepted by the frame but **declined** when the order is placed (402). Any other number is invalid inside the frame ("This card number is invalid.") and no token is sent.
- The message is `{ source: "shoplab-payment-frame", type: "card-accepted", token, last4 }`, or `{ source, type: "card-cleared" }` when the card is edited or invalid. The token is `tok_ok_4242` or `tok_declined_0002`. The full card number and CVC never leave the frame and are never sent to the server. `POST /api/orders` takes the token as `paymentToken`; any other value is a 400.

### Checkout `/checkout`
- Login required (`/login?next=/checkout`). Four steps with Back and Next; each step validates before moving on: 1 Shipping address (a saved address or a new one, per-field validation on blur and on Next), 2 Delivery (method and date), 3 Payment (a card must have been accepted by the frame), 4 Review (the terms must be ticked). The progress list marks the current step with `aria-current="step"` and focus moves to the step heading when the step changes. The payment frame stays mounted while you move back and forth so the card form keeps its content.
- The default choice is the user's default saved address; a user with none starts on the new-address form. The summary beside the steps comes from `POST /api/checkout/quote` and updates when the shipping method changes.
- "Terms and conditions" on the review step is a link with `target="_blank"` and `rel="noopener noreferrer"` to the static `/terms` page.
- **Place order** shows a spinner ("Placing your order") for a fixed **1.5 seconds** (`PLACE_ORDER_SPINNER_MS` in `client/src/pages/CheckoutPage.tsx`) whether the request succeeds or fails.
- Success goes to `/orders/:id/confirmation` (replacing the checkout page in history). A declined card (402) keeps the cart and shows "Your card was declined" with a Use a different card button that returns to step 3 with an empty frame. A stock problem (409) keeps the cart, shows the message and marks each problem line in the summary ("Only 1 of Mechanical Keyboard left, but you have 2 in your cart.") with a link back to the cart. A 400 from the server jumps back to the step it belongs to.

### Orders
- `POST /api/orders` body: `shippingMethod` (`standard` or `express`), `deliveryDate` (YYYY-MM-DD), either `addressId` (one of the user's saved addresses) or `address` (`firstName, lastName, street, city?, countryCode, regionCode, postalCode, phone`), `paymentToken` and `acceptTerms: true`. Problems are reported together in `fieldErrors` (address problems are keyed `address.<field>`). An empty cart is a 400.
- Order of checks inside one transaction: request validation (400), stock for every cart line (409), then the payment token (402 when declined). Any failure changes nothing: the cart, coupon and stock are untouched and no order exists.
- **409 shape**: `error.code` is `CONFLICT` and `fieldErrors` has one entry per problem line keyed `items.<cartItemId>`, for example `{"items.1": "Only 1 of Mechanical Keyboard left, but you have 2 in your cart."}`.
- On success (201) the order has status `Processing`; stock is reduced by the quantities (for a product with variants both the variant and the product total go down); the cart and its coupon are cleared; the coupon (when it applied) is recorded on the order, which is what consumes `ONCE5`. The totals on the order are the ones the cart showed for the chosen method.
- **Order numbers** are `SL-YYYYMMDD-NNNN`: the UTC date of the order and a per-day sequence that starts at 0001 and is one more than the highest number already used for that day. The seed's own orders are in the past, so the first order of a day is 0001 after a reset, and reset deletes every order so the sequence starts again. Order IDs continue after the seed (the first order after a default reset has ID 4).
- `GET /api/orders/{id}` returns the order with its items, address (with `regionName` and `countryName`), totals and `paymentLast4`. **Someone else's order is a 404** (the same answer as a missing order, so IDs cannot be probed). A non-numeric ID is 400.
- The confirmation page `/orders/:id/confirmation` (login required) shows the order number, status, dates, items, shipping address and totals; an unknown or foreign order shows "Order not found". The order list and detail pages are described under Phase 4.

### Other pages
- `/terms` is a static page with an `h1` and six short sections. `/payment-frame` is outside the normal page layout (no header or footer) and has a visually hidden `h1`.

## Phase 4: account and engagement

### Profile name
- `PATCH /api/auth/me` (login required) with `{ "name": "..." }` changes the display name and returns `{ user }`. Same rule as registration: 2 to 60 characters after trimming (400 with `fieldErrors.name`). Only the name can be changed; email, password and role are not accepted here and other fields are ignored.

### Address book: `/api/addresses` (login required, 401 otherwise)
- `GET /api/addresses` lists the user's addresses, default first. `GET /api/addresses/{id}` returns one.
- `POST /api/addresses` (201) body: `label?`, `firstName`, `lastName`, `street`, `city?`, `countryCode`, `regionCode`, `postalCode`, `phone`, `isDefault?`. The rules are the checkout rules: names 1 to 60 characters, street 3 to 100, the region must belong to the country, the postal code must match the country (5 digits for Sweden and the US, 6 for India), phone 7 to 15 digits. Label is optional, at most 30 characters, and a blank label is stored as "Address". City is optional, at most 60. All problems come back together in `fieldErrors`.
- `PATCH /api/addresses/{id}` changes any of the same fields. The merged address is validated as a whole, so changing the country also needs a region and postal code that fit it. An empty body is a 400 (`fieldErrors.body`).
- `DELETE /api/addresses/{id}` returns 204. A user can save at most 10 addresses (the 11th is a 409).
- **Exactly one default**: a user with at least one address always has exactly one default. The first address a user adds becomes the default automatically (whatever `isDefault` says). Adding or patching with `isDefault: true` moves the default to that address and clears the old one. `isDefault: false` on the current default is a 400 (`fieldErrors.isDefault`: make another address the default instead); on a non-default address it changes nothing. **When the default is deleted** and other addresses remain, the one added earliest (lowest ID) becomes the default. When the last address is deleted there is no default, and the next one added becomes it.
- Another user's address is a 404 for GET, PATCH and DELETE. Orders store their own copy of the address, so editing or deleting an address never changes an old order.
- The list shape is `{ data, page: 1, pageSize: n, total: n }` (not paged).

### Account page `/account`
- Profile section: edit name (validated on blur and on submit, server message shown under the field) and a read-only email. Address book section: one card per address with a "Default address" radio (choosing it saves at once), Edit and Delete. Add and Edit open the form below the list; field rules and messages match checkout, and the region list follows the country. Delete opens a confirm modal (Keep it is focused first, Escape cancels) and says when the default will move. A status line announces each result and focus returns to the Add address button. Links to Order history and Wishlist sit under the heading.

### Order history: `GET /api/orders` (login required)
- Own orders only, in the list shape. Query: `status` (`Processing`, `Shipped`, `Delivered`, `Cancelled`, exact spelling), `sort` (`date_desc` default, `date_asc`, `total_desc`, `total_asc`), `page` (default 1), `pageSize` (default 5, max 50). Bad values are a 400 with a message per parameter. Ties fall back to newest first, then highest ID, so paging is stable. A page past the end is 200 with an empty `data` list and the requested `page`.
- Each row is `{ id, number, status, createdAt, deliveryDate, itemCount, totalCents }`; `GET /api/orders/{id}` still returns the full order.
- The default seed gives customer1 three orders (Delivered, Shipped, Processing). Use `POST /api/test/reset` with scenario `many-orders` for 50 orders (several pages, every status).

### Cancel: `POST /api/orders/{id}/cancel` (login required)
- Only a **Processing** order can be cancelled: 200 with the updated order (status `Cancelled`). Shipped, Delivered or already Cancelled is a 409 `CONFLICT` and nothing changes. Someone else's order, or an unknown one, is a 404 (as for `GET /api/orders/{id}`); a non-numeric ID is a 400.
- Cancelling gives the stock back in one transaction: product stock goes up by the quantities, and for a line with a variant the variant stock goes up too (mirroring what placing the order took). A cancelled order still counts as having used its coupon (`ONCE5` is not given back).
- Nothing else is refunded or notified (there is no real payment).

### Order pages
- `/account/orders` (login required): a table with columns Order (link to the detail page), Date, Items, Status and Total. The Date and Total column headers are buttons that sort (the first click on a column sorts descending, the next click flips it; `aria-sort` follows). A Status dropdown filters ("All statuses" by default). Five rows per page with Previous, Next and page numbers. Sort, filter and page live in the URL (`?status=Shipped&sort=total_asc&page=2`), defaults are left out, changing sort or filter goes back to page 1, and a pasted URL restores the view (after login too). A page number past the end shows "There are no orders on page N" with a link to page 1. No orders at all shows a message with a Browse products link; a filter with no match says so and offers "Show all orders". Loading shows a spinner and a failure shows an error with Retry. On narrow screens the Items column is hidden.
- `/account/orders/:id` (the detail route): number, status, dates, payment, items (each with a link to the product and a "Write a review" link that opens its Reviews tab), shipping address and totals. A **Cancel order** button appears only while the status is Processing; it opens a confirm modal ("Keep order" is focused first). After cancelling the page shows the new status and a confirmation message. Other statuses show a short note instead of the button. An unknown or foreign ID shows "Order not found".

### Reviews: `POST /api/products/{id}/reviews` (login required)
- **Who can post**: a customer who has an order containing the product that is **not Cancelled** (Processing, Shipped and Delivered all count). Not a buyer is a 403 `FORBIDDEN`. A cancelled order stops counting.
- **One review per user per product**: a second review is a 409 `CONFLICT`.
- The body is `multipart/form-data` with text fields `rating` (1 to 5), `title` (3 to 100 characters), `body` (20 to 2000 characters) and an optional file field `image`. Any other content type is a 400. Problems are reported together in `fieldErrors` (`rating`, `title`, `body`, `image`). Success is 201 with the review (`id, authorName, rating, title, body, imagePath, createdAt`); the author name is the user's name at the time.
- **Order of checks**: login (401), unknown product (404), body size (413), not a buyer (403), already reviewed (409), image too large (413), then field and image content problems (400).
- **Image**: PNG or JPEG only, at most 2 MB (2 097 152 bytes; exactly 2 MB is accepted). The file type is decided by its **first bytes** (the PNG signature or the JPEG start marker); the file name and the declared MIME type are ignored, so a text file named `.png` is a 400 on `fieldErrors.image`. An empty file is a 400. **Too large is a 413** `PAYLOAD_TOO_LARGE` (with `fieldErrors.image`), whether it is caught by the whole body exceeding 2 MB plus 64 KB of form overhead or by the image part itself. More than one `image` part is a 400. An empty file part (an untouched file input) counts as no image.
- **Storage**: valid images are written under the uploads directory (`uploads/reviews/<uuid>.png|jpg`, git-ignored, `UPLOADS_DIR` overrides it) and served at `/uploads/reviews/<name>` (with `X-Content-Type-Options: nosniff`). `imagePath` in the review list is that URL path. Nothing is written when validation fails.
- **Reset**: `POST /api/test/reset` deletes every uploaded file and (as part of the normal reseed) every user-written review, so the data matches the seed again. Uploads are also cleared at server start, because the database is recreated then.
- `GET /api/products/{id}/review-eligibility` returns `{ eligible, reason }` and is always 200 for a real product (404 otherwise): `reason` is `login_required` (logged out), `not_purchased`, `already_reviewed` or `null`.
- A new review is the newest, so it is first under the default "Newest first" sort, and the product's average, count and star distribution include it at once (they are computed from the reviews table).

### Reviews tab
- Under the "Customer reviews" heading, above the summary: logged-out visitors see "Log in to write a review. Only customers who have bought this product can review it." with a link to `/login?next=/products/{id}#reviews`; a logged-in non-buyer sees "Only customers who have bought this product can review it..." (no form); someone who already reviewed sees "You have already reviewed this product." Buyers see the form: rating radios 1 to 5, Title, Review (with a live character count), and an optional Photo file input (`.png`, `.jpg`, `.jpeg`).
- Client checks (shown inline, per field, on blur and on submit) use the same messages as the API. A chosen photo shows a preview and its file name and size; "Remove photo" clears it. A file over 2 MB or with a non-PNG/JPG name or type is refused in the browser, but a file that only claims to be a PNG is sent and the server's answer is shown under the Photo field.
- After a successful post the form is replaced by a thank-you message, the list switches to "Newest first" page 1 (the new review is first, with its photo) and the rating summary refreshes. A link ending in `#reviews` opens the Reviews tab.

### Wishlist: reorder and Move to cart
- `PUT /api/wishlist/order` (login required) body `{ "productIds": [21, 36] }` saves the order and returns the updated list (positions 1 to n). The array must contain **exactly** the products on the user's wishlist, each once: a missing product, a product that is not theirs, a duplicate, a non-integer or a non-array is a 400 with `fieldErrors.productIds` naming the offenders. Nothing changes on a 400. Products that were saved but are no longer sold are not shown and keep their place after the visible ones.
- The page shows an ordered list. **Drag and drop** uses the native HTML5 events (`dragstart`, `dragover`, `drop`, `dragend`) on each row: dropping a row onto another puts it at that row's position. Each row also has **Move up** and **Move down** buttons (disabled at the ends; focus stays on the same item's button, or the other one when it is disabled). Each move is announced in a live region ("Moved Football Size 5 to position 2 of 8.") and saved at once; saves are sent one after another so the last move wins, and a failure shows an error and reloads the saved order. Touch devices use the buttons.
- **Move to cart** adds one unit through the normal cart API (`POST /api/cart/items`, or the guest cart logic) and then **removes the item from the wishlist** (it moves, it is not copied). It is for products without options that are in stock. A product with sizes or colours shows **Choose options**, a link to its page, because a variant must be chosen. An out-of-stock product shows a disabled Move to cart with "Out of stock". If adding fails (for example the cart already holds the maximum) the item stays on the wishlist and the error is shown; if the add worked but the removal failed the message says so. A success message links to the cart.
- Remove still works as before. Heart buttons are hidden on this page.

### Contact: `POST /api/contact`
- Public (a logged-in user's ID is stored with the message). Body `{ topic, message, consent }`: `topic` is one of `order`, `returns`, `product`, `account`, `feedback`, `other`; `message` is 10 to 1000 characters after trimming; `consent` must be `true`. Problems are a 400 with `fieldErrors` for each field. Success is 201 `{ id, message }`.
- The message is **stored** in the `contact_messages` table (visible only as a row count in `GET /api/test/state`) and is removed by reset. No email is sent and nothing is shown to admins in this phase.
- `/contact` has a Topic dropdown, a Message textarea with a live count, and a consent checkbox. Fields are validated on blur and on submit. Success replaces the form with "Message sent" (focus moves to it) and a "Send another message" button. A "Contact us" link is in the footer of every page.

## Phase 5: admin panel and API

### Access
- Admin pages live under `/admin`: `/admin` (overview), `/admin/products`, `/admin/products/new`, `/admin/products/:id/edit`, `/admin/orders`, `/admin/users`. A navigation bar (Overview, Products, Orders, Users) sits above every admin page; admins also get an "Admin" link in the header.
- A logged-out visitor is redirected to `/login?next=<path>` (for example `/login?next=%2Fadmin`) and returns there after logging in. A logged-in customer sees a friendly "403: Access denied" page at the same URL (the URL does not change).
- Every `/api/admin/*` route answers **401** `UNAUTHENTICATED` with no session and **403** `FORBIDDEN` for a customer, before anything else is checked (so an unknown ID is 401 or 403 first, not 404).
- Table state (search text, filter, page) lives in the page URL, like the order history; default values are left out. All three tables show 10 rows per page, have a loading state and an error state with Retry, and work at 375px (less important columns are hidden on narrow screens).

### Products: `/api/admin/products`
- `GET` lists **every** product, active or not, in ID order, in the list shape. Query: `q` (name contains, ignoring case), `active` (`true` or `false`), `page`, `pageSize` (default 10, max 50). A page past the end is 200 with an empty `data` and the real `total`. `GET /api/admin/products/{id}` returns one product (404 when unknown).
- Product shape: `id, name, category, subcategory, description, priceCents, salePriceCents, stock, active, featured, hasVariants, imageCount, imagePath, createdAt`.
- `POST` (201) and `PATCH` (200) accept JSON, or `multipart/form-data` when an image is attached (form values are text: whole numbers and `true`/`false` are read as such, and an empty `salePriceCents` means "no sale price"). Unknown fields are ignored. Every problem comes back together in `fieldErrors` (400).
- **Rules**: `name` 2 to 150 characters (trimmed). `category` one of Electronics, Clothing, Home, Sports, Books, Toys (matched ignoring case). `subcategory` optional, must belong to the category; when omitted the category's first subcategory alphabetically is used (and changing only the category in a PATCH moves the product to that default). `description` optional, at most 2000 characters; blank becomes "No description provided." `priceCents` a whole number from 1 to 1 000 000 ($0.01 to $10,000.00). `salePriceCents` optional (`null` or empty for none), a whole number of cents from 1, **below the price**. `stock` a whole number from 0 to 10 000, required on create. `active` boolean, default true. On PATCH, a sale price must stay below the price that will result, so lowering the price to or below an existing sale price is a 400 on `salePriceCents` unless the sale price is changed or cleared in the same request. An empty PATCH is a 400 (`fieldErrors.body`).
- **Products with variants** (for example the T-shirt, ID 11) keep their stock in the variants, so `stock` cannot be set for them (400; the form shows the field read-only).
- **IDs**: seed products are 1 to 60; a new product gets the next number from 61 and an ID is never reused after a delete. Reset restores the counter, so the first product after a reset is 61 again (in every scenario, including `empty-store`).
- **Images**: PNG or JPEG only, at most 2 MB, decided by the file's first bytes (same rules as review photos; a text file named `.png` is a 400 on `fieldErrors.image`; too large is a 413). Stored as `uploads/products/<uuid>.png|jpg` (git-ignored) and served at `/uploads/products/<name>`. The URL path is returned as `imagePath` (also on public product responses and cart lines). A product with an uploaded image shows it everywhere instead of the generated placeholder and has one gallery picture. A new file replaces the old one (the old file is deleted); `removeImage: true` removes it. Nothing is written when validation fails. Reset deletes every uploaded product and review image.
- **Inactive products** (`active: false`) are hidden from `GET /api/products` and its filters and counts, `/api/products/suggest`, `/api/categories` counts, the home page, and the wishlist (the entry stays saved but is not shown, and comes back if the product is activated again). `GET /api/products/{id}` and `/reviews` answer 404, and the product cannot be added to a cart or wishlist (404). A cart that already holds it shows the line as out of stock (stock 0), which blocks checkout until the line is removed. Admin lists and `GET /api/admin/products/{id}` still show it.
- **Delete** (`DELETE`, 204; 404 when unknown) is a **hard delete**: the product, its variants, reviews, cart lines and wishlist entries are removed, together with its image files. Order history keeps working because each order line stores its own copy of the name, price and quantity: the order still renders with the same lines and totals, but a deleted product no longer exists, so its link on the order page ends on "Product not found". The UI asks for confirmation in a modal that says this.

### Orders: `/api/admin/orders`
- `GET` lists every customer's orders, newest first (ties by higher ID), in the list shape. Query: `status` (exact spelling), `page`, `pageSize` (default 10, max 50). Each row is `{ id, number, status, createdAt, deliveryDate, itemCount, totalCents, customer: { id, name, email } }`.
- `PATCH /api/admin/orders/{id}/status` with `{ "status": "Shipped" }` returns the updated row. **Allowed moves**: Processing to Shipped or Cancelled, Shipped to Delivered or Cancelled. Delivered and Cancelled are final. Anything else is a **409** and changes nothing: skipping a step (Processing to Delivered), going back, the same status again, and any change to a Delivered or Cancelled order. An unknown or misspelt status is a 400 (`fieldErrors.status`); an unknown order is a 404.
- **Cancelling** (from Processing or Shipped) gives the stock back exactly as the customer's Cancel order button does (shared code, one transaction): product stock goes up by the quantities and variant stock too for variant lines. Cancelling again is a 409, so stock is never returned twice. A cancelled order still counts as having used its coupon.
- The customer sees the new status straight away in order history and on the order page; once an order is Shipped the customer can no longer cancel it (the normal 409).
- The UI shows all four statuses in a dropdown per order; picking one that is not allowed shows the API's message under the dropdown and the dropdown goes back to the real status.

### Users: `/api/admin/users`
- `GET` lists users in ID order (`q` matches name or email ignoring case, `page`, `pageSize`). A row is `{ id, name, email, role, locked, createdAt }`; no password data is ever returned.
- `PATCH /api/admin/users/{id}/lock` with `{ "locked": true }` (or `false`) returns the updated user. A non-boolean is a 400, an unknown user a 404. Setting the state a user already has is a 200.
- **An admin cannot lock their own account**: 409 `CONFLICT`. (Other admins can be locked.)
- **Sessions**: locking deletes all of the user's sessions at once, so their next request is a 401 and they are logged out everywhere. Unlocking does **not** bring the old sessions back; the user logs in again. A locked user gets 423 at login (only with the right password, as in Phase 1).
- The seeded `locked@shoplab.test` can be unlocked with the toggle; reset locks it again and unlocks everyone else.
- The UI uses a switch per user (`role="switch"`, labelled "Locked: <email>"); the admin's own switch is disabled.

### Geo: `GET /api/geo`
- No lookup. The answer is always `{ "countryCode": "SE", "countryName": "Sweden" }` unless `?country=<code>` is sent with one of the supported codes (SE, US, IN, any case), which is echoed back. An unknown code is a 400 (`fieldErrors.country`). The header's "Shipping to" display is not wired up yet (Phase 6).

### API documentation
- `docs/openapi.yaml` (OpenAPI 3.1) describes every endpoint, parameter, request body (including multipart), response schema, status code and security scheme (cookie session, bearer token, `X-Test-Key`). Swagger UI is at `/api/docs` and the raw file at `/api/docs/openapi.yaml`; both are served from files in the app (the UI comes from the `swagger-ui-dist` package), so nothing is fetched from another site. Try it out uses the same origin and the session cookie, so log in through the site first or use the Authorize button with a token.
- `server/src/openapi.contract.test.ts` checks that the file is valid OpenAPI, that every `$ref` resolves, and that real responses (success and error, for every endpoint group) match the documented schemas and status codes. Response schemas forbid unknown properties, so a renamed or added field fails the test until the document is updated.
- The `/api/test/flags` and `/api/test/chaos` endpoints do not exist yet (Phase 6) and are not in the document.
