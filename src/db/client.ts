import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL ??
  'postgres://atelier:atelier@localhost:5432/atelier_store'

const globalForDb = globalThis as unknown as {
  atelierPool?: pg.Pool
}

export const pool =
  globalForDb.atelierPool ??
  new pg.Pool({
    connectionString,
    max: 10,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.atelierPool = pool
}

export const db = drizzle(pool, { schema })
