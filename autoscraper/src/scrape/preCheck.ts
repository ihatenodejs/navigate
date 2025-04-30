import axios from "axios"
import robotsParser from "robots-parser"
import { isFileUrl, isValidUrl } from '../util/fileUtils'

export async function checkIfScrapeAllowed(url: string): Promise<boolean> {
  try {
    if (!isValidUrl(url)) {
      console.log(`[w] Invalid URL format: ${url}`)
      return false
    }
    
    if (isFileUrl(url)) {
      console.log(`[i] URL points to a file, skipping: ${url}`)
      return false
    }
    
    const urlObj = new URL(url)
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
    
    try {
      const response = await axios.get(`${baseUrl}/robots.txt`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'NavigateBot/1.0'
        }
      })
      
      const robotsTxt = response.data
      const robots = robotsParser(url, robotsTxt)
      
      const isAllowed = robots.isAllowed(url, "NavigateBot/1.0") ?? true
      return isAllowed
    } catch (error) {
      console.warn(`[w] Could not fetch robots.txt for ${url}: ${error}`)
      return true
    }
  } catch (error) {
    console.warn(`[w] Error checking if scraping is allowed for ${url}: ${error}`)
    return false
  }
}