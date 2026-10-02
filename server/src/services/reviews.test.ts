import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config';
import { openDatabase } from '../db/connection';
import type { Db } from '../db/connection';
import { seedDatabase } from '../db/seed';
import { ApiError } from '../lib/errors';
import { MAX_IMAGE_BYTES } from '../lib/imageUpload';
import { cancelOrder } from './orders';
import { getProduct, listReviews } from './catalogue';
import { postReview, reviewEligibility } from './reviews';
import { clearUploads } from './uploads';

const seedDir = loadConfig().seedDir;
let db: Db;
let uploads: string;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const user1 = { id: 1, name: 'Casey Customer' };
const fields = { rating: '4', title: 'Solid purchase', body: 'Works well and arrived quickly, would buy again.' };

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db, seedDir);
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'shoplab-uploads-'));
});

afterEach(() => {
  fs.rmSync(uploads, { recursive: true, force: true });
});

function failure(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error('Expected an ApiError');
}

const filesOnDisk = () => (fs.existsSync(path.join(uploads, 'reviews')) ? fs.readdirSync(path.join(uploads, 'reviews')) : []);

describe('review eligibility', () => {
  it('lets a buyer review a product they ordered (any status except Cancelled)', () => {
    // customer1 has products 3 and 6 on a Delivered order, 1 and 11 on a Shipped one, 41, 40 and 56 on a Processing one.
    for (const id of [3, 6, 1, 11, 41, 40, 56]) expect(reviewEligibility(db, 1, id)).toEqual({ eligible: true, reason: null });
  });

  it('refuses a user who never bought the product', () => {
    expect(reviewEligibility(db, 1, 2)).toEqual({ eligible: false, reason: 'not_purchased' });
    expect(reviewEligibility(db, 2, 3)).toEqual({ eligible: false, reason: 'not_purchased' });
  });

  it('stops counting an order once it is cancelled', () => {
    expect(reviewEligibility(db, 1, 41).eligible).toBe(true);
    cancelOrder(db, 1, 3);
    expect(reviewEligibility(db, 1, 41)).toEqual({ eligible: false, reason: 'not_purchased' });
  });

  it('allows one review per user per product', () => {
    postReview(db, uploads, user1, 3, { fields, image: null });
    expect(reviewEligibility(db, 1, 3)).toEqual({ eligible: false, reason: 'already_reviewed' });
    expect(failure(() => postReview(db, uploads, user1, 3, { fields, image: null })).status).toBe(409);
  });
});

describe('postReview', () => {
  it('stores the review, which then comes first in the newest-first list and changes the rating summary', () => {
    const before = getProduct(db, 3)!.rating;
    const review = postReview(db, uploads, user1, 3, { fields: { ...fields, rating: '1' }, image: null }, new Date('2026-12-01T10:00:00.000Z'));
    expect(review).toMatchObject({ authorName: 'Casey Customer', rating: 1, title: 'Solid purchase', imagePath: null });
    const list = listReviews(db, 3, { sort: 'newest', page: 1, pageSize: 5 })!;
    expect(list.data[0]!.id).toBe(review.id);
    expect(list.total).toBe(before.count + 1);
    expect(getProduct(db, 3)!.rating.count).toBe(before.count + 1);
    expect(getProduct(db, 3)!.rating.average).not.toBe(before.average);
  });

  it('answers 404 for an unknown product and 403 for a non-buyer, before looking at the fields', () => {
    expect(failure(() => postReview(db, uploads, user1, 999, { fields, image: null })).status).toBe(404);
    const err = failure(() => postReview(db, uploads, user1, 2, { fields: {}, image: null }));
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('reports each invalid field: rating, title and text of at least 20 characters', () => {
    const err = failure(() => postReview(db, uploads, user1, 3, { fields: { rating: '6', title: 'x', body: 'too short' }, image: null }));
    expect(err.status).toBe(400);
    expect(Object.keys(err.fieldErrors ?? {}).sort()).toEqual(['body', 'rating', 'title']);
    expect(failure(() => postReview(db, uploads, user1, 3, { fields: {}, image: null })).fieldErrors).toMatchObject({
      rating: expect.any(String),
      title: expect.any(String),
      body: expect.any(String),
    });
    // Exactly 20 characters is fine.
    expect(postReview(db, uploads, user1, 3, { fields: { ...fields, body: 'a'.repeat(20) }, image: null }).body).toHaveLength(20);
  });

  it('saves a PNG or JPG under a generated name and returns its stable URL path', () => {
    const png = postReview(db, uploads, user1, 3, { fields, image: PNG });
    const jpg = postReview(db, uploads, user1, 6, { fields, image: JPG });
    expect(png.imagePath).toMatch(/^\/uploads\/reviews\/[0-9a-f-]+\.png$/);
    expect(jpg.imagePath).toMatch(/^\/uploads\/reviews\/[0-9a-f-]+\.jpg$/);
    expect(filesOnDisk()).toHaveLength(2);
    expect(fs.readFileSync(path.join(uploads, 'reviews', path.basename(png.imagePath!))).equals(PNG)).toBe(true);
  });

  it('rejects a file by its content, not its name: text, HTML and GIF are refused with a 400 on the image field', () => {
    for (const data of [Buffer.from('plain text pretending to be a png'), Buffer.from('<script>alert(1)</script>'), Buffer.from('GIF89a......')]) {
      const err = failure(() => postReview(db, uploads, user1, 3, { fields, image: data }));
      expect(err.status).toBe(400);
      expect(err.fieldErrors).toHaveProperty('image');
    }
    expect(failure(() => postReview(db, uploads, user1, 3, { fields, image: Buffer.alloc(0) })).fieldErrors).toHaveProperty('image');
    expect(filesOnDisk()).toHaveLength(0);
  });

  it('rejects an image over 2 MB with 413 and accepts exactly 2 MB', () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    PNG.copy(big);
    const err = failure(() => postReview(db, uploads, user1, 3, { fields, image: big }));
    expect(err.status).toBe(413);
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    expect(err.fieldErrors).toHaveProperty('image');

    const exact = Buffer.alloc(MAX_IMAGE_BYTES);
    PNG.copy(exact);
    expect(postReview(db, uploads, user1, 3, { fields, image: exact }).imagePath).not.toBeNull();
  });

  it('writes nothing to disk or the database when validation fails', () => {
    const count = () => (db.prepare('SELECT COUNT(*) AS n FROM reviews').get() as { n: number }).n;
    const before = count();
    failure(() => postReview(db, uploads, user1, 3, { fields: { ...fields, title: '' }, image: PNG }));
    expect(count()).toBe(before);
    expect(filesOnDisk()).toHaveLength(0);
  });
});

describe('clearUploads', () => {
  it('removes every uploaded file, and a database reset removes the review rows', () => {
    postReview(db, uploads, user1, 3, { fields, image: PNG });
    expect(filesOnDisk()).toHaveLength(1);
    clearUploads(uploads);
    expect(filesOnDisk()).toHaveLength(0);
    clearUploads(uploads); // nothing left to remove is fine

    seedDatabase(db, seedDir);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reviews WHERE user_id IS NOT NULL').get()).toEqual({ n: 0 });
  });
});
