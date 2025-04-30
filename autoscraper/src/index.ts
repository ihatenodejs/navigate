import fs from "fs"
import { scrapeUrl, type ScrapeResult } from "./scrape/scrapeUrl"
import { checkIfScrapeAllowed } from "./scrape/preCheck"
import { 
  saveScrapeResult, 
  addToQueue, 
  getNextFromQueue, 
  markQueueItemCompleted, 
  markQueueItemFailed,
  markQueueItemDisallowed,
  getUnprocessedUrls,
  markUrlAsProcessed,
  saveLinkRelations,
  getEligibleFailedUrls,
  resetFailedUrl,
  db
} from "./db/db"
import { recordHostnameVisit } from "./util/hostTracker"
import { isValidUrl, isImageUrl, normalizeUrl } from "./util/fileUtils"
import * as schema from "./db/schema"
import { eq } from "drizzle-orm"

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
const version = pkg.version

function getSeedCt() {
  const seeds = fs.readFileSync("seeds.txt", "utf8")
  const seedCount = seeds.split("\n").length
  return seedCount
}

console.log(`=== Autoscraper v${version} ===`)
console.log(`Seeds: ${getSeedCt()}\n`)
console.log("[i] Starting scrape...")

const seeds = fs.readFileSync("seeds.txt", "utf8")
const seedArray = seeds.split("\n").filter(url => url.trim() !== "")

let processedCount = 0
let failedCount = 0
let disallowedCount = 0
let skippedCount = 0
let maxDepth = 3

for (const seed of seedArray) {
  if (isValidUrl(seed)) {
    const normalizedSeed = normalizeUrl(seed)
    const added = await addToQueue(normalizedSeed, undefined, 0)
    if (added) {
      console.log(`[i] Added seed URL to queue: ${normalizedSeed}`)
    } else {
      // recently scraped or in queue
      skippedCount++
    }
  } else {
    console.log(`[w] Invalid seed URL, skipping: ${seed}`)
  }
}

while (true) {
  const nextItem = await getNextFromQueue()
  
  if (!nextItem) {
    console.log("[i] Queue is empty or all URLs are in cooldown. Checking for unprocessed URLs...")
    
    const unprocessed = await getUnprocessedUrls()
    
    if (unprocessed.length === 0) {
      console.log("[i] No unprocessed URLs found. Checking for failed URLs to retry...")
      
      const failedUrls = await getEligibleFailedUrls()
      
      if (failedUrls.length === 0) {
        console.log("[i] No more URLs to process. Exiting.")
        break
      }
      
      console.log(`[i] Found ${failedUrls.length} failed URLs eligible for retry`)
      
      for (const item of failedUrls) {
        await resetFailedUrl(item.id)
        console.log(`[i] Reset failed URL to pending: ${item.url}`)
      }
      
      console.log("[i] All URLs are in cooldown. Waiting 10 seconds before checking again...")
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      continue
    }
    
    for (const item of unprocessed) {
      if (isValidUrl(item.url)) {
        const normalizedUrl = normalizeUrl(item.url)
        const added = await addToQueue(normalizedUrl, undefined, 1)
        if (added) {
          console.log(`[i] Added unprocessed URL to queue: ${normalizedUrl}`)
        } else {
          // recently scraped or in queue
          skippedCount++
        }
      } else {
        console.log(`[w] Invalid unprocessed URL, skipping: ${item.url}`)
      }
    }
    
    continue
  }
  
  const { id, url, depth } = nextItem
  
  try {
    console.log(`[i] Processing URL (depth ${depth}): ${url}`)
    
    // check if scrape is allowed
    const isAllowed = await checkIfScrapeAllowed(url)
    if (!isAllowed) {
      console.log(`[w] Scraping not allowed for ${url}, skipping...`)
      await markQueueItemDisallowed(id)
      disallowedCount++
      continue
    }
    
    recordHostnameVisit(url)
    
    const result: ScrapeResult = await scrapeUrl(url)
    console.log(`[i] Scraped ${url}`)
    console.log(`[i] Title: ${result.title}`)
    console.log(`[i] Description: ${result.description}`)
    console.log(`[i] Image: ${result.image}`)
    console.log(`[i] Keywords: ${result.keywords}`)
    console.log(`[i] Links: ${result.links?.length || 0} links found`)
    
    if (result.text && result.text.endsWith("...")) {
      console.log(`[i] Text content was truncated due to size limits`)
    }
    
    const savedId = await saveScrapeResult(url, result)
    
    if (savedId !== null) {
      // add discovered links to the queue
      if (result.links && result.links.length > 0 && depth < maxDepth) {
        const targetIds: number[] = []
        
        console.log(`[i] Processing ${result.links.length}/500 discovered links from ${url}`)
        
        for (const link of result.links) {
          if (isImageUrl(link)) {
            console.log(`[i] Skipping image URL: ${link}`)
            continue
          }
          
          if (isValidUrl(link)) {
            const normalizedLink = normalizeUrl(link)
            const added = await addToQueue(normalizedLink, url, depth + 1)
            if (added) {
              console.log(`[i] Added discovered link to queue (depth ${depth + 1}): ${normalizedLink}`)
              
              try {
                const existingLink = await db.select()
                  .from(schema.searchData)
                  .where(eq(schema.searchData.url, normalizedLink))
                  .limit(1)
                  
                if (existingLink.length > 0 && existingLink[0]) {
                  targetIds.push(existingLink[0].id)
                } else {
                  const linkResult = await saveScrapeResult(normalizedLink, {})
                  if (linkResult !== null) {
                    targetIds.push(linkResult)
                  }
                }
              } catch (error) {
                console.warn(`[w] Could not process link relationship for ${normalizedLink}: ${error}`)
              }
            } else {
              // recently scraped or in queue
              skippedCount++
            }
          } else {
            console.log(`[w] Invalid discovered link, skipping: ${link}`)
          }
        }
        
        if (targetIds.length > 0) {
          console.log(`[i] Created ${targetIds.length} link relations for ${url}`)
          await saveLinkRelations(savedId, targetIds)
        }
      }
      
      await markUrlAsProcessed(savedId)
    } else {
      console.log(`[w] No data saved for ${url}, skipping link processing`)
    }
    
    await markQueueItemCompleted(id)
    processedCount++
    
    // add a small delay to avoid overwhelming servers
    await new Promise(resolve => setTimeout(resolve, 1000))
    
  } catch (error) {
    console.error(`[e] Error processing ${url}: ${error}`)
    await markQueueItemFailed(id)
    failedCount++
  }
  
  if ((processedCount + failedCount + disallowedCount + skippedCount) % 10 === 0) {
    console.log(`[i] Progress: ${processedCount} processed, ${failedCount} failed, ${disallowedCount} disallowed, ${skippedCount} skipped`)
  }
}

console.log(`[i] Scraping completed. Processed: ${processedCount}, Failed: ${failedCount}, Disallowed: ${disallowedCount}, Skipped: ${skippedCount}`)
