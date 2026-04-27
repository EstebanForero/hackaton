import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './client'

export async function runMigrations() {
  await migrate(db, { migrationsFolder: './drizzle' })
}

if (import.meta.main) {
  await runMigrations()
  await pool.end()
}
