import robotsParser from 'robots-txt-parser';

const robots = robotsParser(
  {
    userAgent: 'NavigateBot',
    allowOnNeutral: false,
  },
)

export default async function checkIfScrapeAllowed(url: string) {
  try {
    await robots.useRobotsFor(url)
    return robots.canCrawl(url)
  } catch (error) {
    console.error("[!]", error)
    return false
  }
}