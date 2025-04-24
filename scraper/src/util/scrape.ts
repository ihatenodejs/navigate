import axios from "axios"
import "dotenv/config"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { drizzle } from "drizzle-orm/node-postgres"
import { searchData } from "../db/schema"
import * as cheerio from "cheerio"
import * as schema from "../db/schema"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
  
const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>

export async function scrapeUrl(url: string) {
  const response = await axios.get(url)
  const $ = cheerio.load(response.data)

  // Data
  const title = $("title").text()
  const description = $("meta[name='description']").attr("content") || ""
  const imageUrl = $("meta[property='og:image']").attr("content") || ""
  const keywords = $("meta[name='keywords']").attr("content")

  // Extract keywords
  let keywordsArray: string[] = []
  if (keywords) {
    keywordsArray = keywords.split(",")
  }
  
  return { title, description, imageUrl, keywordsArray }
}

export async function saveToDatabase(url: string, title: string, description: string, imageUrl: string, keywordsArray: string[]) {
  await db.insert(searchData).values({
    url,
    title,
    description,
    imageUrl,
    keywords: keywordsArray,
  })
}