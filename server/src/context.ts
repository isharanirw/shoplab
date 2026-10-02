import type { Config } from './config';
import type { Db } from './db/connection';
import type { FailureLimiter } from './lib/rateLimiter';
import type { ChaosEngine } from './testability/chaos';

export interface AppContext {
  config: Config;
  db: Db;
  loginLimiter: FailureLimiter;
  chaos: ChaosEngine;
  startedAt: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'admin';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}
