import { pool } from './client'
import { runMigrations } from './migrate'
import { seedProducts } from './seed'

async function waitForPostgres() {
  const deadline = Date.now() + 30_000
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      await pool.query('select 1')
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  throw lastError
}

await waitForPostgres()
await runMigrations()
await seedProducts()
await pool.end()
