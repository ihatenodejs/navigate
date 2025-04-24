import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { drizzle } from "drizzle-orm/node-postgres"
import { scrapeQueue } from "../db/schema"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "../db/schema"

export function checkIngestCount() {
  const urls = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "urls.txt"), "utf8")
  const urlArray = urls.split("\n")

  // Cleanup
  const blankLinesRemoved = urlArray.filter((url) => url.trim() !== "")
  const duplicatesRemoved = blankLinesRemoved.filter((url, index, self) => self.indexOf(url) === index)

  return duplicatesRemoved.length
}

export async function ingestUrls() {
  const urls = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "urls.txt"), "utf8")
  let urlArray = urls.split("\n")

  // Cleanup
  const blankLinesRemoved = urlArray.filter((url) => url.trim() !== "")
  const duplicatesRemoved = blankLinesRemoved.filter((url, index, self) => self.indexOf(url) === index)

  // Ingest
  const db = drizzle(process.env.DATABASE_URL!) as NodePgDatabase<typeof schema>

  let successCt = 0
  let failCt = 0

  for (const url of duplicatesRemoved) {
    try {
      await db.insert(scrapeQueue).values({
        url,
        status: "pending",
      })

      urlArray = urlArray.filter((u) => u !== url)

      successCt++
    } catch (error) {
      console.error(`Failed to ingest: ${url} | ${error}`)
      failCt++
    }
  }

  fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "urls.txt"), urlArray.join("\n"))

  return {
    success: successCt,
    failure: failCt,
  }
}

export async function checkIngest() {
  if (checkIngestCount() === 0) {
    console.log("[i] No URLs to ingest")
  } else {
    console.log(`[i] Ingesting ${checkIngestCount()} URLs`)
    const { success, failure } = await ingestUrls()
    console.log(`[✓] Ingested ${success} URLs, failed to ingest ${failure} URLs`)
  }
}