import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { scrapeQueue } from "../db/schema"
import { eq, asc } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "../db/schema"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>

async function getRandomUrl() {
  const url = await db.query.scrapeQueue.findFirst({
    where: eq(scrapeQueue.status, "pending"),
    orderBy: [asc(scrapeQueue.createdAt)],
  })

  if (!url) {
    return null
  }

  return url.url
}

export default getRandomUrl