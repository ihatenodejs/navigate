import axios from "axios"
import * as cheerio from "cheerio"
import { convert } from 'html-to-text'
import { isFileUrl, isValidUrl, isImageUrl } from '../util/fileUtils'

// everything is optional because the web is a mess
export interface ScrapeResult {
  title?: string
  description?: string
  image?: string
  keywords?: string
  links?: string[]
  text?: string
}

const MAX_TEXT_LENGTH = 50000 // 50KB
const MAX_LINKS = 500
const MAX_DESCRIPTION_LENGTH = 500
const MAX_HTML_SIZE = 5 * 1024 * 1024 // 5MB

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    if (!isValidUrl(url)) {
      console.log(`[w] Invalid URL format: ${url}`)
      return {
        title: "Invalid URL",
        description: "This URL is invalid and was skipped.",
        links: []
      }
    }
    
    if (isFileUrl(url)) {
      console.log(`[i] Skipping file URL: ${url}`)
      return {
        title: "File",
        description: "This URL points to a file",
        links: []
      }
    }

    const response = await axios.get(url, {
      timeout: 30000,
      maxContentLength: MAX_HTML_SIZE,
      maxBodyLength: MAX_HTML_SIZE,
      headers: {
        'User-Agent': 'NavigateBot/1.0'
      },
      validateStatus: (status) => {
        // accept only 2xx status
        return status >= 200 && status < 300
      }
    });
    
    if (response.data && typeof response.data === 'string' && response.data.length > MAX_HTML_SIZE) {
      console.warn(`[w] HTML content for ${url} exceeds size limit (${response.data.length} bytes), truncating`)
      response.data = response.data.substring(0, MAX_HTML_SIZE)
    }
    
    const $ = cheerio.load(response.data)

    const title = $("title").text().replace(/\s+/g, ' ').trim()

    const description = $('meta[name="description"]').attr("content")

    const image = $('meta[property="og:image"]').attr("content")

    const keywords = $('meta[name="keywords"]').attr("content")

    /* gets and parses links on page
    EXCLUDES:
      - non-http(s) links
      - file URLs (like .pdf, .doc, etc.)
      - invalid URLs
      - image URLs
      - media URLs
    */
    const allLinks = $("a").map((i, el) => $(el).attr("href")).get()
    const links = allLinks
      .filter((link: string) => link && typeof link === 'string' && link.startsWith("http"))
      .filter((link: string) => isValidUrl(link))
      .filter((link: string) => !isFileUrl(link))
      .filter((link: string) => !isImageUrl(link))
      .filter((link: string) => {
        const urlObj = new URL(link);
        const path = urlObj.pathname || '';
        const mediaPatterns = [
          '/images/', '/img/', '/media/', '/assets/', '/static/', '/cdn/',
          '/uploads/', '/files/', '/downloads/', '/content/', '/resources/'
        ];
        
        return !mediaPatterns.some(pattern => path.includes(pattern));
      })
    
    const limitedLinks = links.slice(0, MAX_LINKS)

    /* remove a couple things before text extraction
      - headers
      - footers
      - nav elements
      - images
      - media elements
    */
    $("img, header, footer, nav, video, audio, iframe, object, embed, source, track").remove()
    const fullText = convert($("body").html() || "")
    
    const text = fullText.length > MAX_TEXT_LENGTH 
      ? fullText.substring(0, MAX_TEXT_LENGTH) + "..." 
      : fullText
      
    const limitedDescription = description && description.length > MAX_DESCRIPTION_LENGTH
      ? description.substring(0, MAX_DESCRIPTION_LENGTH) + "..."
      : description

    return { 
      title, 
      description: limitedDescription, 
      image, 
      keywords, 
      links: limitedLinks, 
      text 
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        console.error(`[e] Timeout while scraping ${url}`);
      } else if (error.response) {
        console.error(`[e] HTTP error ${error.response.status} while scraping ${url}: ${error.message}`);
      } else if (error.request) {
        console.error(`[e] Network error while scraping ${url}: ${error.message}`);
      } else {
        console.error(`[e] Error scraping ${url}: ${error.message}`);
      }
    } else {
      console.error(`[e] Error scraping ${url}: ${error}`);
    }
    throw error;
  }
}