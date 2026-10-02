// One-off generator for the JSON files in server/seed.
// The generated JSON is committed and is the source of truth at runtime.
// Re-running this script rewrites the files (password hashes get new salts).
// Usage: node server/scripts/generate-seed.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const write = (name, data) =>
  writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n', 'utf8');

// Small deterministic PRNG so the generated data is reproducible.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261002);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---------------------------------------------------------------- users
const users = [
  { id: 1, name: 'Casey Customer', email: 'customer1@shoplab.test', password: 'Test@1234', role: 'customer', locked: 0 },
  { id: 2, name: 'Sam Shopper', email: 'customer2@shoplab.test', password: 'Test@1234', role: 'customer', locked: 0 },
  { id: 3, name: 'Lee Locked', email: 'locked@shoplab.test', password: 'Test@1234', role: 'customer', locked: 1 },
  { id: 4, name: 'Alex Admin', email: 'admin@shoplab.test', password: 'Admin@1234', role: 'admin', locked: 0 },
].map(({ password, ...u }) => ({
  ...u,
  passwordHash: bcrypt.hashSync(password, 10),
  createdAt: '2026-01-05T09:00:00.000Z',
}));
write('users.json', users);

// ------------------------------------------------------------- products
const C = { E: 'Electronics', C: 'Clothing', H: 'Home', S: 'Sports', B: 'Books', T: 'Toys' };

// [id, category, subcategory, name, priceCents, salePriceCents|null, stock, featured]
const rows = [
  [1, C.E, 'Audio', 'Wireless Noise-Cancelling Headphones', 19900, null, 24, 1],
  [2, C.E, 'Audio', 'Bluetooth Speaker Mini', 4999, 3999, 40, 1],
  [3, C.E, 'Accessories', 'USB-C Fast Charger 65W', 2900, null, 60, 0],
  [4, C.E, 'Smart Home', 'Smart Lamp', 3450, null, 18, 0],
  [5, C.E, 'Computers', 'Mechanical Keyboard', 8900, null, 2, 0],
  [6, C.E, 'Computers', 'Wireless Mouse', 2499, null, 55, 0],
  [7, C.E, 'Cameras', '4K Action Camera', 24900, null, 0, 0],
  [8, C.E, 'Accessories', 'Portable Power Bank 20000mAh', 4500, 3600, 32, 0],
  [9, C.E, 'Accessories', 'Smartphone Case', 1500, null, 0, 0],
  [10, C.E, 'Computers', "Ultra-Wide Curved Gaming Monitor 34-inch 144Hz with Adjustable Stand, HDR Support and Built-In Speakers (Limited Collector's Edition)", 49900, null, 6, 0],

  [11, C.C, 'Tops', 'Classic Cotton T-Shirt', 1900, null, 0, 0],
  [12, C.C, 'Bottoms', 'Slim Fit Jeans', 5900, null, 0, 0],
  [13, C.C, 'Tops', 'Hooded Sweatshirt', 4900, 3900, 0, 1],
  [14, C.C, 'Accessories', 'Leather Belt', 2200, null, 3, 0],
  [15, C.C, 'Accessories', 'Wool Winter Scarf', 1750, 1225, 28, 0],
  [16, C.C, 'Accessories', 'Running Socks 6-Pack', 1200, null, 90, 0],
  [17, C.C, 'Dresses', 'Summer Dress', 4500, 3600, 0, 0],
  [18, C.C, 'Outerwear', 'Denim Jacket', 7900, null, 0, 0],
  [19, C.C, 'Tops', 'Formal Oxford Shirt', 5400, null, 0, 0],
  [20, C.C, 'Sleepwear', 'Cotton Pyjama Set', 3500, null, 0, 0],

  [21, C.H, 'Kitchen', 'Ceramic Dinner Plate Set', 4800, null, 20, 0],
  [22, C.H, 'Kitchen', 'Stainless Steel Water Bottle', 1800, 1440, 0, 1],
  [23, C.H, 'Lighting', 'Smart Lamp', 2700, null, 35, 0],
  [24, C.H, 'Bedroom', 'Memory Foam Pillow', 3200, null, 44, 0],
  [25, C.H, 'Bedroom', 'Handwoven Organic Cotton Throw Blanket with Hand-Knotted Fringe, Extra Large Size, Machine Washable, Available in Multiple Seasonal Colours', 6400, null, 12, 0],
  [26, C.H, 'Decor', 'Scented Candle Set', 1400, null, 1, 0],
  [27, C.H, 'Appliances', 'Robot Vacuum Cleaner', 32900, 27900, 9, 1],
  [28, C.H, 'Kitchen', 'Bamboo Cutting Board', 2100, null, 38, 0],
  [29, C.H, 'Kitchen', 'Cast Iron Skillet 12-inch', 3600, null, 0, 0],
  [30, C.H, 'Decor', 'Area Rug', 11900, null, 0, 0],

  [31, C.S, 'Fitness', 'Yoga Mat', 2500, null, 0, 1],
  [32, C.S, 'Fitness', 'Adjustable Dumbbell Set', 14900, null, 7, 0],
  [33, C.S, 'Footwear', 'Trail Running Shoes', 10900, 8900, 0, 1],
  [34, C.S, 'Cycling', 'Cycling Helmet', 5500, null, 0, 0],
  [35, C.S, 'Outdoors', 'Inflatable Camping Tent 2-Person', 13900, null, 11, 0],
  [36, C.S, 'Team Sports', 'Football Size 5', 2000, 1600, 70, 0],
  [37, C.S, 'Racquet Sports', 'Tennis Racket', 7500, null, 15, 0],
  [38, C.S, 'Fitness', 'Resistance Bands Set', 1600, null, 2, 0],
  [39, C.S, 'Outdoors', 'Hiking Backpack 40L', 8500, 6800, 22, 0],
  [40, C.S, 'Fitness', 'Jump Rope', 500, null, 120, 0],

  [41, C.B, 'Technology', 'The Pragmatic Tester', 3400, null, 30, 0],
  [42, C.B, 'Fiction', 'Mystery at Lake Harbour', 1299, null, 41, 0],
  [43, C.B, 'Non-fiction', 'A History of Northern Lights', 1800, null, 26, 0],
  [44, C.B, 'Cooking', 'The Complete Illustrated Guide to Beginner Home Cooking, Meal Planning, Budgeting and Reducing Food Waste: Second Revised Edition', 2900, null, 17, 0],
  [45, C.B, 'Technology', 'Learning TypeScript', 4200, null, 33, 0],
  [46, C.B, 'Fiction', 'The Quiet Garden', 1150, null, 0, 0],
  [47, C.B, 'Non-fiction', 'Atlas of the Seven Seas', 2600, null, 3, 0],
  [48, C.B, 'Children', "Children's Bedtime Stories", 999, null, 52, 0],
  [49, C.B, 'Non-fiction', 'Mastering Personal Finance', 1999, null, 25, 0],
  [50, C.B, 'Fiction', 'The Complete Poetry Collection', 2300, null, 14, 0],

  [51, C.T, 'Building', 'Wooden Building Blocks 100 pcs', 2700, null, 36, 0],
  [52, C.T, 'Electronic Toys', 'Remote Control Racing Car', 4400, 3500, 19, 1],
  [53, C.T, 'Puzzles', 'Jigsaw Puzzle 1000 Pieces', 1900, null, 0, 0],
  [54, C.T, 'Soft Toys', 'Plush Teddy Bear', 1600, null, 0, 0],
  [55, C.T, 'Games', 'Family Board Game', 3200, null, 3, 0],
  [56, C.T, 'Creative', 'Art and Craft Kit', 2100, null, 29, 0],
  [57, C.T, 'Building', 'Toy Train Set', 5900, 4720, 13, 0],
  [58, C.T, 'Educational', 'Science Experiment Kit', 3800, null, 0, 0],
  [59, C.T, 'Creative', 'Magnetic Drawing Board', 1300, null, 48, 0],
  [60, C.T, 'Soft Toys', 'Stuffed Dinosaur Toy', 800, null, 21, 0],
];

// Variants: product id -> { sizes: [...]|null, colours: [...], stock: [[...]] per size x colour (row-major) }
const variantDefs = {
  9: { sizes: null, colours: ['Black', 'Blue', 'Red'], stock: [12, 8, 0] },
  11: { sizes: ['S', 'M', 'L', 'XL'], colours: ['White', 'Black'], stock: [10, 8, 12, 0, 6, 9, 4, 15] },
  12: { sizes: ['30', '32', '34', '36'], colours: ['Blue', 'Black'], stock: [5, 7, 9, 3, 0, 6, 8, 4] },
  13: { sizes: ['S', 'M', 'L', 'XL'], colours: ['Grey', 'Navy'], stock: [6, 9, 0, 3, 7, 0, 5, 8] },
  17: { sizes: ['S', 'M', 'L'], colours: ['Red', 'Blue'], stock: [4, 6, 0, 5, 0, 7] },
  18: { sizes: ['S', 'M', 'L'], colours: ['Blue'], stock: [0, 0, 0] },
  19: { sizes: ['S', 'M', 'L', 'XL'], colours: ['White', 'Light Blue'], stock: [9, 11, 6, 2, 7, 5, 0, 4] },
  20: { sizes: ['S', 'M', 'L'], colours: ['Grey', 'Navy'], stock: [8, 5, 6, 7, 0, 9] },
  22: { sizes: null, colours: ['Silver', 'Black', 'Blue'], stock: [14, 9, 0] },
  30: { sizes: ['Small', 'Large'], colours: ['Grey', 'Beige'], stock: [3, 2, 0, 4] },
  31: { sizes: null, colours: ['Purple', 'Green', 'Black'], stock: [10, 0, 12] },
  33: { sizes: ['40', '42', '44'], colours: ['Black', 'Orange'], stock: [6, 4, 8, 0, 5, 2] },
  34: { sizes: ['S', 'M', 'L'], colours: ['Black', 'White'], stock: [7, 3, 9, 0, 6, 4] },
  54: { sizes: null, colours: ['Brown', 'White'], stock: [11, 0] },
};
// Variant products with zero overall stock have every variant at zero;
// products listed above with stock 0 in `rows` are derived from the variants below.

const specsByCategory = {
  [C.E]: (id) => [
    ['Brand', 'Nordic Labs'],
    ['Warranty', id % 2 ? '2 years' : '1 year'],
    ['Power', ['USB-C', 'Rechargeable battery', 'Mains'][id % 3]],
  ],
  [C.C]: (id) => [
    ['Material', ['100% cotton', 'Cotton blend', 'Wool blend', 'Denim'][id % 4]],
    ['Care', 'Machine wash 30 C'],
    ['Fit', ['Regular', 'Slim', 'Relaxed'][id % 3]],
  ],
  [C.H]: (id) => [
    ['Material', ['Ceramic', 'Stainless steel', 'Cotton', 'Bamboo', 'Plastic'][id % 5]],
    ['Dimensions', `${20 + (id % 7) * 5} x ${15 + (id % 5) * 4} cm`],
    ['Care', 'Wipe clean'],
  ],
  [C.S]: (id) => [
    ['Material', ['Nylon', 'Rubber', 'Polyester', 'Steel'][id % 4]],
    ['Weight', `${(id % 9) + 1}.${id % 10} kg`],
    ['Use', ['Indoor', 'Outdoor', 'Indoor and outdoor'][id % 3]],
  ],
  [C.B]: (id) => [
    ['Pages', String(120 + id * 7)],
    ['Format', id % 2 ? 'Paperback' : 'Hardcover'],
    ['Language', 'English'],
  ],
  [C.T]: (id) => [
    ['Recommended age', ['3+', '5+', '8+', '12+'][id % 4]],
    ['Material', ['Wood', 'Plastic', 'Fabric', 'Cardboard'][id % 4]],
    ['Batteries', id % 2 ? 'Not required' : '2 x AA (not included)'],
  ],
};

const descByCategory = {
  [C.E]: 'A dependable piece of everyday tech, tested for comfort and reliability.',
  [C.C]: 'Made from soft, durable fabric and designed to last through many washes.',
  [C.H]: 'A practical addition to any room, built with quality materials.',
  [C.S]: 'Built for training and the outdoors, with a focus on durability.',
  [C.B]: 'A well-regarded read that works for a quiet evening or a long journey.',
  [C.T]: 'A fun and safe pick that keeps young minds and hands busy.',
};

const products = [];
const variants = [];
let variantId = 1;
for (const [id, category, subcategory, name, priceCents, salePriceCents, stockIn, featured] of rows) {
  let stock = stockIn;
  const def = variantDefs[id];
  if (def) {
    const sizes = def.sizes ?? [null];
    let i = 0;
    stock = 0;
    for (const size of sizes) {
      for (const colour of def.colours) {
        const vStock = def.stock[i++];
        stock += vStock;
        variants.push({ id: variantId++, productId: id, size, colour, stock: vStock });
      }
    }
  }
  const month = String(1 + ((id * 7) % 9)).padStart(2, '0');
  const day = String(1 + ((id * 11) % 27)).padStart(2, '0');
  products.push({
    id,
    name,
    category,
    subcategory,
    description: `${name.length > 60 ? 'This product' : name}: ${descByCategory[category]}`,
    specs: specsByCategory[category](id).map(([label, value]) => ({ label, value })),
    priceCents,
    salePriceCents,
    stock,
    featured,
    active: 1,
    imageCount: 3,
    createdAt: `2026-${month}-${day}T08:00:00.000Z`,
  });
}
write('products.json', products);
write('variants.json', variants);

// -------------------------------------------------------------- reviews
const authors = ['Maria L.', 'John P.', 'Anika S.', 'Tomas R.', 'Priya K.', 'Erik B.', 'Sofia M.', 'David W.', 'Linnea H.', 'Rahul D.', 'Chloe T.', 'Omar F.'];
const reviewTitles = {
  5: ['Excellent', 'Love it', 'Exactly what I wanted', 'Great value'],
  4: ['Very good', 'Solid choice', 'Happy with it', 'Good quality'],
  3: ['It is okay', 'Average', 'Does the job', 'Mixed feelings'],
  2: ['Disappointing', 'Not great', 'Could be better'],
  1: ['Poor', 'Would not buy again'],
};
const reviewBodies = {
  5: ['Arrived quickly and works perfectly. I would happily recommend it to friends.', 'Better than I expected for the price. Build quality feels solid.'],
  4: ['Good overall, only a few small things that could be improved.', 'Does what it promises and the finish is nice.'],
  3: ['Decent for the price but nothing special. It does the job.', 'Some parts are good and some are less impressive.'],
  2: ['Did not match the description as closely as I hoped.', 'Quality is below what I expected, though support was polite.'],
  1: ['Stopped meeting my needs after a short time. Not recommended.', 'Very disappointed with the quality.'],
};
const reviews = [];
let reviewId = 1;
for (const p of products) {
  if (p.id === 60) continue; // the one product with no reviews
  const count = p.id === 1 ? 28 : 1 + Math.floor(rand() * 8);
  for (let i = 0; i < count; i++) {
    const r = rand();
    const rating = r < 0.45 ? 5 : r < 0.75 ? 4 : r < 0.9 ? 3 : r < 0.96 ? 2 : 1;
    const day = 1 + Math.floor(rand() * 27);
    const month = 1 + Math.floor(rand() * 9);
    reviews.push({
      id: reviewId++,
      productId: p.id,
      userId: null,
      authorName: pick(authors),
      rating,
      title: pick(reviewTitles[rating]),
      body: pick(reviewBodies[rating]),
      imagePath: null,
      createdAt: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    });
  }
}
write('reviews.json', reviews);

// -------------------------------------------------------------- coupons
write('coupons.json', [
  { code: 'SAVE10', kind: 'percent', value: 10, minSubtotalCents: 0, oncePerAccount: 0, expiresAt: null, description: '10% off the subtotal' },
  { code: 'FREESHIP', kind: 'free_shipping', value: 0, minSubtotalCents: 3000, oncePerAccount: 0, expiresAt: null, description: 'Free standard shipping on subtotals of $30 or more' },
  { code: 'MIN100', kind: 'fixed', value: 2000, minSubtotalCents: 10000, oncePerAccount: 0, expiresAt: null, description: '$20 off when the subtotal is $100 or more' },
  { code: 'ONCE5', kind: 'fixed', value: 500, minSubtotalCents: 0, oncePerAccount: 1, expiresAt: null, description: '$5 off, usable once per account' },
  { code: 'EXPIRED20', kind: 'percent', value: 20, minSubtotalCents: 0, oncePerAccount: 0, expiresAt: '2020-01-01T00:00:00.000Z', description: 'Expired' },
]);

// ------------------------------------------------------------ countries
write('countries.json', [
  {
    code: 'SE', name: 'Sweden', postalPattern: '^\\d{5}$', postalHint: '5 digits',
    regions: [['AB', 'Stockholm'], ['O', 'Vastra Gotaland'], ['M', 'Skane'], ['C', 'Uppsala']],
  },
  {
    code: 'US', name: 'United States', postalPattern: '^\\d{5}$', postalHint: '5 digits',
    regions: [['CA', 'California'], ['NY', 'New York'], ['TX', 'Texas'], ['WA', 'Washington']],
  },
  {
    code: 'IN', name: 'India', postalPattern: '^\\d{6}$', postalHint: '6 digits',
    regions: [['MH', 'Maharashtra'], ['KA', 'Karnataka'], ['DL', 'Delhi'], ['TN', 'Tamil Nadu']],
  },
].map((c) => ({ ...c, regions: c.regions.map(([code, name]) => ({ code, name })) })));

// ------------------------------------------- addresses and wishlist (customer1)
write('addresses.json', [
  { id: 1, userId: 1, label: 'Home', firstName: 'Casey', lastName: 'Customer', street: 'Sveavagen 12', city: 'Stockholm', regionCode: 'AB', countryCode: 'SE', postalCode: '11157', phone: '+46 8 123 456', isDefault: 1 },
  { id: 2, userId: 1, label: 'Work', firstName: 'Casey', lastName: 'Customer', street: '500 Pine Street', city: 'Seattle', regionCode: 'WA', countryCode: 'US', postalCode: '98101', phone: '+1 206 555 0100', isDefault: 0 },
]);
write('wishlist.json', [
  { userId: 1, productId: 36, position: 1, addedAt: '2026-09-01T10:00:00.000Z' },
  { userId: 1, productId: 21, position: 2, addedAt: '2026-09-02T10:00:00.000Z' },
]);

// --------------------------------------------------------------- orders
const productById = new Map(products.map((p) => [p.id, p]));
const variantById = new Map(variants.map((v) => [v.id, v]));
const unitPrice = (p) => p.salePriceCents ?? p.priceCents;
const roundHalfUp = (num, den) => Math.floor((2 * num + den) / (2 * den));

const address1 = {
  firstName: 'Casey', lastName: 'Customer', street: 'Sveavagen 12', city: 'Stockholm',
  regionCode: 'AB', countryCode: 'SE', postalCode: '11157', phone: '+46 8 123 456',
};

function buildOrder({ id, userId, status, createdAt, deliveryDate, items, couponCode, shippingMethod, address }) {
  const lines = items.map(([productId, variantIdArg, quantity]) => {
    const p = productById.get(productId);
    const v = variantIdArg ? variantById.get(variantIdArg) : null;
    return {
      productId,
      variantId: variantIdArg ?? null,
      name: p.name,
      variantLabel: v ? [v.size, v.colour].filter(Boolean).join(' / ') : null,
      unitPriceCents: unitPrice(p),
      quantity,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  let discount = 0;
  if (couponCode === 'SAVE10') discount = roundHalfUp(subtotal * 10, 100);
  if (couponCode === 'MIN100') discount = 2000;
  if (couponCode === 'ONCE5') discount = 500;
  const afterDiscount = subtotal - discount;
  let shipping;
  if (shippingMethod === 'express') shipping = 1500;
  else shipping = afterDiscount >= 10000 || couponCode === 'FREESHIP' ? 0 : 500;
  const tax = roundHalfUp(afterDiscount * 10, 100);
  const total = afterDiscount + shipping + tax;
  const datePart = createdAt.slice(0, 10).replaceAll('-', '');
  return {
    id,
    number: `SL-${datePart}-${String(id).padStart(4, '0')}`,
    userId,
    status,
    createdAt,
    deliveryDate,
    couponCode: couponCode ?? null,
    shippingMethod,
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    taxCents: tax,
    totalCents: total,
    paymentLast4: '4242',
    address,
    items: lines,
  };
}

// Variant ids: product 11 starts at variant 4 (after product 9's 3 variants).
const v11 = variants.find((v) => v.productId === 11 && v.size === 'M' && v.colour === 'White').id;

const defaultOrders = [
  buildOrder({
    id: 1, userId: 1, status: 'Delivered', createdAt: '2026-08-12T14:30:00.000Z', deliveryDate: '2026-08-17',
    items: [[3, null, 2], [6, null, 1]], couponCode: null, shippingMethod: 'standard', address: address1,
  }),
  buildOrder({
    id: 2, userId: 1, status: 'Shipped', createdAt: '2026-09-18T09:15:00.000Z', deliveryDate: '2026-09-24',
    items: [[1, null, 1], [11, v11, 2]], couponCode: 'SAVE10', shippingMethod: 'standard', address: address1,
  }),
  buildOrder({
    id: 3, userId: 1, status: 'Processing', createdAt: '2026-09-30T16:45:00.000Z', deliveryDate: '2026-10-05',
    items: [[41, null, 1], [40, null, 3], [56, null, 1]], couponCode: null, shippingMethod: 'express', address: address1,
  }),
];
write('orders.json', defaultOrders);

// "many-orders" scenario: 47 more orders for customer1 (50 in total).
const statuses = ['Delivered', 'Delivered', 'Shipped', 'Processing', 'Cancelled', 'Delivered'];
const simpleProductIds = products.filter((p) => p.stock > 3 && !variantDefs[p.id]).map((p) => p.id);
const manyOrders = [];
for (let n = 0; n < 47; n++) {
  const id = 4 + n;
  const day = 1 + (n % 28);
  const month = 1 + Math.floor(n / 6);
  const createdAt = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:${String(n % 60).padStart(2, '0')}:00.000Z`;
  const items = [
    [simpleProductIds[(n * 3) % simpleProductIds.length], null, 1 + (n % 3)],
    [simpleProductIds[(n * 5 + 1) % simpleProductIds.length], null, 1 + (n % 2)],
  ];
  if (items[0][0] === items[1][0]) items[1][0] = simpleProductIds[(n * 5 + 2) % simpleProductIds.length];
  manyOrders.push(
    buildOrder({
      id, userId: 1, status: statuses[n % statuses.length], createdAt,
      deliveryDate: createdAt.slice(0, 10),
      items, couponCode: n % 7 === 0 ? 'SAVE10' : null,
      shippingMethod: n % 5 === 0 ? 'express' : 'standard', address: address1,
    }),
  );
}
write('orders-many.json', manyOrders);

console.log(`products=${products.length} variants=${variants.length} reviews=${reviews.length} orders=${defaultOrders.length}+${manyOrders.length}`);
for (const o of defaultOrders) console.log(o.number, o.status, o.subtotalCents, o.discountCents, o.shippingCents, o.taxCents, o.totalCents);
