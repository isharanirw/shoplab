import { describe, expect, it } from 'vitest';
import { FailureLimiter } from './rateLimiter';

function setup() {
  let now = 1_000_000;
  const limiter = new FailureLimiter(5, 60_000, () => now);
  return { limiter, advance: (ms: number) => (now += ms) };
}

describe('FailureLimiter', () => {
  it('does not block before the limit is reached', () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i++) limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('blocks after 5 failures in the window', () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
  });

  it('keeps keys independent', () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure('a');
    expect(limiter.isBlocked('b')).toBe(false);
  });

  it('unblocks once the failures leave the window', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure('a');
    advance(60_001);
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('only counts failures inside the sliding window', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 3; i++) limiter.recordFailure('a');
    advance(40_000);
    for (let i = 0; i < 2; i++) limiter.recordFailure('a');
    expect(limiter.isBlocked('a')).toBe(true);
    advance(25_000); // the first three are now older than 60s
    expect(limiter.isBlocked('a')).toBe(false);
  });

  it('reports seconds until the oldest failure expires', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 5; i++) limiter.recordFailure('a');
    advance(20_000);
    expect(limiter.retryAfterSeconds('a')).toBe(40);
  });

  it('clears a single key or everything', () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('a');
      limiter.recordFailure('b');
    }
    limiter.clearKey('a');
    expect(limiter.isBlocked('a')).toBe(false);
    expect(limiter.isBlocked('b')).toBe(true);
    limiter.clearAll();
    expect(limiter.isBlocked('b')).toBe(false);
  });
});
