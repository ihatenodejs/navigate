import { checkIngest } from "./ingest/ingest"
import checkIfScrapeAllowed from "./safety/preCheck"
import { clearScreen, truncate } from "./util/osFunctions"
import { saveToDatabase, scrapeUrl } from "./util/scrape"
import getRandomUrl from "./util/toScrape"
import * as readline from "readline"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function promptUser(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

clearScreen()
checkIngest()
console.log()

async function main() {
  while (true) {
    const url = await getRandomUrl()
    if (!url) {
      console.log("No URLs to scrape")
      rl.close()
      process.exit(0)
    }

    clearScreen()

    console.log("┌───────────────────────────────────────────────┐")
    console.log("│               NAVIGATE SCRAPER                │")
    console.log("├───────────────────────────────────────────────┤")
    console.log(`│ URL: ${truncate(url, { length: 40 })}... │`)
    console.log("│ Pre-check: ", await checkIfScrapeAllowed(url) ? "Allowed" : "Blocked", "                          │")
    console.log("┢━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┪")
    console.log("┃       [S]crape         ┃         [Q]uit       ┃")
    console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━┻━━━━━━━━━━━━━━━━━━━━━━┛\n")

    const input = await promptUser("> ")
    if (input === "s") {
      const { title, description, imageUrl, keywordsArray } = await scrapeUrl(url)

      console.log(`\nTitle: ${title}`)
      console.log(`Description: ${description}`)
      console.log(`Image URL: ${imageUrl}`)
      console.log(`Keywords: ${keywordsArray.join(", ")}\n`)

      console.log("Save to database? (y/n)")
      const save = await promptUser("> ")
      if (save === "y") {
        await saveToDatabase(url, title, description, imageUrl, keywordsArray)
      }
    } else if (input === "q") {
      clearScreen()
      console.log("\nExiting...\n")
      rl.close()
      process.exit(0)
    } else {
      clearScreen()
      console.log("Invalid input. Please enter 's' to scrape or 'q' to quit.\n")
    }
  }
}

main().catch(err => {
  console.error("[!] Error:", err)
  rl.close()
  process.exit(1)
})