import mime from 'mime-types'
import { URL } from 'url'

export function isValidUrl(url: string): boolean {
  try {
    if (!url || typeof url !== 'string') {
      return false
    }

    const urlObj = new URL(url)
    
    // another protocol check
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false
    }
    
    if (!urlObj.hostname || urlObj.hostname.length < 1) {
      return false
    }
    
    // common issues
    if (urlObj.hostname.includes('..') || urlObj.hostname.includes('//')) {
      return false
    }
    
    return true
  } catch (error) {
    return false
  }
}

export function analyzeUrl(url: string): {
  isFile: boolean
  isImage: boolean
  isMedia: boolean
  isDocument: boolean
  isArchive: boolean
  isCode: boolean
  isData: boolean
  isOther: boolean
  fileType: string | null
  mimeType: string | null
  pathComponents: string[]
  queryParams: Record<string, string>
} {
  const result = {
    isFile: false,
    isImage: false,
    isMedia: false,
    isDocument: false,
    isArchive: false,
    isCode: false,
    isData: false,
    isOther: false,
    fileType: null as string | null,
    mimeType: null as string | null,
    pathComponents: [] as string[],
    queryParams: {} as Record<string, string>
  }

  try {
    if (!isValidUrl(url)) {
      return result
    }

    const urlObj = new URL(url)
    const path = urlObj.pathname || ''
    
    result.pathComponents = path.split('/').filter(Boolean)
    
    urlObj.searchParams.forEach((value, key) => {
      result.queryParams[key] = value
    })
    
    const extensionMatch = path.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/)
    if (extensionMatch && extensionMatch[1]) {
      const extension = extensionMatch[1].toLowerCase()
      result.fileType = extension
      
      const mimeType = mime.lookup(extension)
      if (mimeType) {
        result.mimeType = mimeType
      }
    }
    
    const imageExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'tif',
      'avif', 'heic', 'heif', 'jfif', 'pjpeg', 'pjp'
    ]
    
    const documentExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'
    ]
    
    const mediaExtensions = [
      'mp3', 'mp4', 'wav', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'ogg'
    ]
    
    const archiveExtensions = [
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2'
    ]
    
    const codeExtensions = [
      'js', 'css', 'php', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'rb', 'go', 'rs'
    ]
    
    const dataExtensions = [
      'json', 'xml', 'csv', 'sql', 'db', 'sqlite', 'sqlite3'
    ]
    
    const otherExtensions = [
      'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'iso', 'img'
    ]
    
    if (result.fileType) {
      if (imageExtensions.includes(result.fileType)) {
        result.isImage = true
        result.isFile = true
      } else if (documentExtensions.includes(result.fileType)) {
        result.isDocument = true
        result.isFile = true
      } else if (mediaExtensions.includes(result.fileType)) {
        result.isMedia = true
        result.isFile = true
      } else if (archiveExtensions.includes(result.fileType)) {
        result.isArchive = true
        result.isFile = true
      } else if (codeExtensions.includes(result.fileType)) {
        result.isCode = true
        result.isFile = true
      } else if (dataExtensions.includes(result.fileType)) {
        result.isData = true
        result.isFile = true
      } else if (otherExtensions.includes(result.fileType)) {
        result.isOther = true
        result.isFile = true
      }
    }
    
    if (result.mimeType) {
      if (result.mimeType.startsWith('image/')) {
        result.isImage = true
        result.isFile = true
      } else if (result.mimeType.startsWith('audio/') || result.mimeType.startsWith('video/')) {
        result.isMedia = true
        result.isFile = true
      } else if (result.mimeType.startsWith('application/')) {
        if (result.mimeType.includes('pdf') || 
            result.mimeType.includes('word') || 
            result.mimeType.includes('excel') || 
            result.mimeType.includes('powerpoint') || 
            result.mimeType.includes('rtf') || 
            result.mimeType.includes('officedocument')) {
          result.isDocument = true
          result.isFile = true
        } else if (result.mimeType.includes('zip') || 
                  result.mimeType.includes('rar') || 
                  result.mimeType.includes('7z') || 
                  result.mimeType.includes('tar') || 
                  result.mimeType.includes('gzip')) {
          result.isArchive = true
          result.isFile = true
        } else if (result.mimeType.includes('javascript') || 
                  result.mimeType.includes('css') || 
                  result.mimeType.includes('php') || 
                  result.mimeType.includes('python') || 
                  result.mimeType.includes('java') || 
                  result.mimeType.includes('c++') || 
                  result.mimeType.includes('ruby') || 
                  result.mimeType.includes('go') || 
                  result.mimeType.includes('rust')) {
          result.isCode = true
          result.isFile = true
        } else if (result.mimeType.includes('json') || 
                  result.mimeType.includes('xml') || 
                  result.mimeType.includes('csv') || 
                  result.mimeType.includes('sql')) {
          result.isData = true
          result.isFile = true
        } else if (!result.mimeType.includes('html') && 
                  !result.mimeType.includes('xml')) {
          result.isOther = true
          result.isFile = true
        }
      } else if (result.mimeType.startsWith('text/') && 
                !result.mimeType.includes('html') && 
                !result.mimeType.includes('xml')) {
        result.isDocument = true
        result.isFile = true
      }
    }
    
    const filePatterns = [
      'images', 'img', 'media', 'assets', 'static', 'cdn', 'uploads', 
      'files', 'downloads', 'content', 'resources', 'docs', 'documents',
      'pdfs', 'videos', 'audio', 'music', 'archives', 'code', 'scripts',
      'data', 'binaries', 'executables', 'installers', 'packages'
    ]
    
    if (result.pathComponents.some(component => 
        filePatterns.some(pattern => component.toLowerCase().includes(pattern)))) {
      result.isFile = true
      
      if (result.pathComponents.some(component => 
          ['images', 'img', 'photos', 'pictures'].some(pattern => 
            component.toLowerCase().includes(pattern)))) {
        result.isImage = true
      } else if (result.pathComponents.some(component => 
                ['media', 'videos', 'audio', 'music'].some(pattern => 
                  component.toLowerCase().includes(pattern)))) {
        result.isMedia = true
      } else if (result.pathComponents.some(component => 
                ['docs', 'documents', 'pdfs'].some(pattern => 
                  component.toLowerCase().includes(pattern)))) {
        result.isDocument = true
      } else if (result.pathComponents.some(component => 
                ['archives', 'downloads'].some(pattern => 
                  component.toLowerCase().includes(pattern)))) {
        result.isArchive = true
      } else if (result.pathComponents.some(component => 
                ['code', 'scripts', 'src'].some(pattern => 
                  component.toLowerCase().includes(pattern)))) {
        result.isCode = true
      } else if (result.pathComponents.some(component => 
                ['data', 'datasets'].some(pattern => 
                  component.toLowerCase().includes(pattern)))) {
        result.isData = true
      } else {
        result.isOther = true
      }
    }
    
    if (result.queryParams['format'] === 'image' || 
        result.queryParams['type'] === 'image' || 
        result.queryParams['content'] === 'image') {
      result.isImage = true
      result.isFile = true
    } else if (result.queryParams['format'] === 'pdf' || 
              result.queryParams['type'] === 'pdf' || 
              result.queryParams['content'] === 'pdf') {
      result.isDocument = true
      result.isFile = true
    } else if (result.queryParams['format'] === 'media' || 
              result.queryParams['type'] === 'media' || 
              result.queryParams['content'] === 'media') {
      result.isMedia = true
      result.isFile = true
    } else if (result.queryParams['format'] === 'archive' || 
              result.queryParams['type'] === 'archive' || 
              result.queryParams['content'] === 'archive') {
      result.isArchive = true
      result.isFile = true
    } else if (result.queryParams['format'] === 'code' || 
              result.queryParams['type'] === 'code' || 
              result.queryParams['content'] === 'code') {
      result.isCode = true
      result.isFile = true
    } else if (result.queryParams['format'] === 'data' || 
              result.queryParams['type'] === 'data' || 
              result.queryParams['content'] === 'data') {
      result.isData = true
      result.isFile = true
    } else if (result.queryParams['format'] || 
              result.queryParams['type'] || 
              result.queryParams['content']) {
      result.isOther = true
      result.isFile = true
    }
    
    return result
  } catch (error) {
    console.warn(`Error analyzing URL: ${error}`)
    return result
  }
}

// these are going to be used more later for indexing files

export function isImageUrl(url: string): boolean {
  return analyzeUrl(url).isImage
}

export function isFileUrl(url: string): boolean {
  return analyzeUrl(url).isFile
}

export function isMediaUrl(url: string): boolean {
  return analyzeUrl(url).isMedia
}

export function isDocumentUrl(url: string): boolean {
  return analyzeUrl(url).isDocument
}

export function isArchiveUrl(url: string): boolean {
  return analyzeUrl(url).isArchive
}

export function isCodeUrl(url: string): boolean {
  return analyzeUrl(url).isCode
}

export function isDataUrl(url: string): boolean {
  return analyzeUrl(url).isData
}

export function normalizeUrl(url: string): string {
  try {
    if (!isValidUrl(url)) {
      return url
    }
    
    const urlObj = new URL(url)
    
    // Remove fragment (#) and query parameters (?)
    urlObj.hash = ''
    urlObj.search = ''
    
    return urlObj.toString()
  } catch (error) {
    console.warn(`[w] Error normalizing URL: ${url} - ${error}`)
    return url
  }
} 