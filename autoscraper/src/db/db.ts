import { drizzle } from "drizzle-orm/node-postgres"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"
import { eq, and, isNull, or, lt, isNotNull, gt } from "drizzle-orm"
import { isHostnameInCooldown } from "../util/hostTracker"
import { isValidUrl, isImageUrl, normalizeUrl } from '../util/fileUtils'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema }) as NodePgDatabase<typeof schema>

const MAX_KEYWORDS = 50
const MAX_LINKS_IN_DB = 50

export async function saveScrapeResult(url: string, result: {
  title?: string
  description?: string
  image?: string
  keywords?: string
  links?: string[]
  text?: string
}) {
  if (!isValidUrl(url)) {
    console.warn(`[w] Cannot save scrape result for invalid URL: ${url}`)
    return null
  }
  
  const normalizedUrl = normalizeUrl(url)
  
  const hasData = result.title || result.description || result.image || result.keywords || result.text || (result.links && result.links.length > 0)
  
  if (!hasData) {
    return null
  }
  
  const validLinks = result.links 
    ? result.links
        .filter(link => isValidUrl(link))
        .filter(link => !isImageUrl(link))
        .slice(0, MAX_LINKS_IN_DB) 
    : []
  
  let limitedKeywords: string[] = []
  if (result.keywords) {
    const keywordsArray = result.keywords.split(",")
    limitedKeywords = keywordsArray.slice(0, MAX_KEYWORDS)
  }
  
  const existing = await db.select().from(schema.searchData).where(eq(schema.searchData.url, normalizedUrl))
  
  if (existing.length > 0 && existing[0]) {
    await db.update(schema.searchData)
      .set({
        title: result.title,
        description: result.description,
        imageUrl: result.image,
        keywords: limitedKeywords,
        text: result.text,
        links: validLinks,
        updatedAt: new Date(),
      })
      .where(eq(schema.searchData.url, normalizedUrl))
    
    return existing[0].id
  } else {
    const insertResult = await db.insert(schema.searchData).values({
      url: normalizedUrl,
      title: result.title,
      description: result.description,
      imageUrl: result.image,
      keywords: limitedKeywords,
      text: result.text,
      links: validLinks,
    }).returning()
    
    if (insertResult.length > 0 && insertResult[0]) {
      return insertResult[0].id
    } else {
      throw new Error(`Failed to insert record for URL: ${normalizedUrl}`)
    }
  }
}

export async function addToQueue(url: string, sourceUrl?: string, depth: number = 0) {
  if (!isValidUrl(url)) {
    console.warn(`[w] Cannot add invalid URL to queue: ${url}`)
    return false
  }
  
  if (isImageUrl(url)) {
    console.warn(`[w] Cannot add image URL to queue: ${url}`)
    return false
  }
  
  if (sourceUrl && !isValidUrl(sourceUrl)) {
    console.warn(`[w] Invalid source URL: ${sourceUrl}`)
    sourceUrl = undefined
  }
  
  const normalizedUrl = normalizeUrl(url)
  const normalizedSourceUrl = sourceUrl ? normalizeUrl(sourceUrl) : undefined
  
  const recentlyScraped = await wasUrlScrapedRecently(normalizedUrl)
  if (recentlyScraped) {
    return false
  }
  
  const recentlyRetried = await wasUrlRetriedRecently(normalizedUrl)
  if (recentlyRetried) {
    return false
  }
  
  const existing = await db.select().from(schema.scrapeQueue).where(eq(schema.scrapeQueue.url, normalizedUrl))
  
  if (existing.length === 0) {
    await db.insert(schema.scrapeQueue).values({
      url: normalizedUrl,
      sourceUrl: normalizedSourceUrl,
      depth,
      status: "pending",
    })
    return true
  }
  
  return false
}

export async function getNextFromQueue() {
  // get all pending urls
  const pendingUrls = await db.select()
    .from(schema.scrapeQueue)
    .where(eq(schema.scrapeQueue.status, "pending"))
    .orderBy(schema.scrapeQueue.createdAt)
  
  // find the first URL that's not in cooldown
  for (const next of pendingUrls) {
    if (!isHostnameInCooldown(next.url)) {
      await db.update(schema.scrapeQueue)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(schema.scrapeQueue.id, next.id))
      
      return next
    }
  }
  
  return null
}

export async function markQueueItemCompleted(id: number) {
  await db.update(schema.scrapeQueue)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(schema.scrapeQueue.id, id))
}

export async function markQueueItemFailed(id: number) {
  await db.update(schema.scrapeQueue)
    .set({ 
      status: "failed", 
      updatedAt: new Date(),
      lastError: new Date()
    })
    .where(eq(schema.scrapeQueue.id, id))
}

export async function markQueueItemDisallowed(id: number) {
  await db.update(schema.scrapeQueue)
    .set({ status: "disallowed", updatedAt: new Date() })
    .where(eq(schema.scrapeQueue.id, id))
}

export async function getUnprocessedUrls() {
  return db.select()
    .from(schema.searchData)
    .where(eq(schema.searchData.processed, false))
}

export async function markUrlAsProcessed(id: number) {
  await db.update(schema.searchData)
    .set({ processed: true, updatedAt: new Date() })
    .where(eq(schema.searchData.id, id))
}

export async function saveLinkRelations(sourceId: number, targetIds: number[]) {
  if (!sourceId || !targetIds || targetIds.length === 0) {
    console.warn(`[w] Cannot save link relations: invalid sourceId or targetIds`)
    return
  }
  
  let successCount = 0
  let errorCount = 0
  
  for (const targetId of targetIds) {
    try {
      const existingRelation = await db.select()
        .from(schema.linkRelations)
        .where(
          and(
            eq(schema.linkRelations.sourceId, sourceId),
            eq(schema.linkRelations.targetId, targetId)
          )
        )
        .limit(1)
      
      if (existingRelation.length === 0) {
        await db.insert(schema.linkRelations).values({
          sourceId,
          targetId,
        })
        successCount++
      }
    } catch (error) {
      console.warn(`[w] Error saving link relation (${sourceId} -> ${targetId}): ${error}`)
      errorCount++
    }
  }
  
  if (successCount > 0) {
    console.log(`[i] Created ${successCount} link relations for source ID ${sourceId}`)
  }
  
  if (errorCount > 0) {
    console.warn(`[w] Failed to create ${errorCount} link relations for source ID ${sourceId}`)
  }
}

export async function getFailedUrls() {
  return db.select()
    .from(schema.scrapeQueue)
    .where(eq(schema.scrapeQueue.status, "failed"))
}

export async function getEligibleFailedUrls(): Promise<typeof schema.scrapeQueue.$inferSelect[]> {
  const thirtyMinutesAgo = new Date()
  thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)
  
  return db.select()
    .from(schema.scrapeQueue)
    .where(
      and(
        eq(schema.scrapeQueue.status, "failed"),
        or(
          isNull(schema.scrapeQueue.lastError),
          lt(schema.scrapeQueue.lastError, thirtyMinutesAgo)
        )
      )
    )
}

export async function getDisallowedUrls() {
  return db.select()
    .from(schema.scrapeQueue)
    .where(eq(schema.scrapeQueue.status, "disallowed"))
}

export async function resetFailedUrl(id: number) {
  await db.update(schema.scrapeQueue)
    .set({ 
      status: "pending", 
      updatedAt: new Date(),
      lastError: null
    })
    .where(eq(schema.scrapeQueue.id, id))
}

export async function wasUrlScrapedRecently(url: string): Promise<boolean> {
  try {
    if (!isValidUrl(url)) {
      return false
    }
    
    const normalizedUrl = normalizeUrl(url)
    
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    
    const existing = await db.select()
      .from(schema.searchData)
      .where(
        and(
          eq(schema.searchData.url, normalizedUrl),
          eq(schema.searchData.processed, true)
        )
      )
      .limit(1)
    
    if (existing.length > 0 && existing[0]) {
      const updatedAt = existing[0].updatedAt
      return updatedAt > oneDayAgo
    }
    
    return false
  } catch (error) {
    console.warn(`[w] Error checking if URL was scraped recently: ${url} - ${error}`)
    return false
  }
}

export async function wasUrlRetriedRecently(url: string): Promise<boolean> {
  try {
    if (!isValidUrl(url)) {
      return false
    }
    
    const normalizedUrl = normalizeUrl(url)
    const thirtyMinutesAgo = new Date()
    thirtyMinutesAgo.setMinutes(thirtyMinutesAgo.getMinutes() - 30)
    
    const existing = await db.select()
      .from(schema.scrapeQueue)
      .where(
        and(
          eq(schema.scrapeQueue.url, normalizedUrl),
          eq(schema.scrapeQueue.status, "failed"),
          isNotNull(schema.scrapeQueue.lastError),
          gt(schema.scrapeQueue.lastError, thirtyMinutesAgo)
        )
      )
      .limit(1)
    
    return existing.length > 0
  } catch (error) {
    console.warn(`[w] Error checking if URL was retried recently: ${url} - ${error}`)
    return false
  }
} 