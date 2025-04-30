import { isValidUrl } from './fileUtils'

const hostnameLastVisit = new Map<string, number>()
const DEFAULT_COOLDOWN = 30 * 1000

export function isHostnameInCooldown(url: string, cooldownMs: number = DEFAULT_COOLDOWN): boolean {
  try {
    if (!isValidUrl(url)) {
      return false
    }
    
    const hostname = new URL(url).hostname
    const lastVisit = hostnameLastVisit.get(hostname)
    
    if (!lastVisit) {
      return false
    }
    
    const now = Date.now()
    const timeSinceLastVisit = now - lastVisit
    
    return timeSinceLastVisit < cooldownMs
  } catch (error) {
    console.warn(`[w] Error checking hostname cooldown for ${url}: ${error}`)
    return false
  }
}

export function recordHostnameVisit(url: string): void {
  try {
    if (!isValidUrl(url)) {
      console.warn(`[w] Cannot record hostname visit for invalid URL: ${url}`)
      return
    }
    
    const hostname = new URL(url).hostname
    hostnameLastVisit.set(hostname, Date.now())
  } catch (error) {
    console.warn(`[w] Error recording hostname visit for ${url}: ${error}`)
  }
}

export function getTimeUntilAvailable(url: string, cooldownMs: number = DEFAULT_COOLDOWN): number {
  try {
    if (!isValidUrl(url)) {
      return 0
    }
    
    const hostname = new URL(url).hostname
    const lastVisit = hostnameLastVisit.get(hostname)
    
    if (!lastVisit) {
      return 0
    }
    
    const now = Date.now()
    const timeSinceLastVisit = now - lastVisit
    
    if (timeSinceLastVisit >= cooldownMs) {
      return 0
    }
    
    return cooldownMs - timeSinceLastVisit
  } catch (error) {
    console.warn(`[w] Error checking time until available for ${url}: ${error}`)
    return 0
  }
} 