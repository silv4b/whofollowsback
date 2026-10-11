export interface ProfileRow {
  username: string
  url: string
  sourceName: string
  followsBack?: boolean
  following?: boolean
}

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/
const HEADER_TOKENS =
  /^(username|user|usuario|userid|handle|nome|name|perfil|profile|url|link|imagem|image)$/i
const USERNAME_HINTS = /(username|user|usuario|handle)/i
const URL_HINTS = /(perfil|profile|url|link|imagem|image)/i
const FB_HINTS = /(segue|follow|mutuo|de_volta|de-volta|back)/i
const FOLLOWING_HINTS = /(seguindo|following)/i

export function extractUsername(value: string): string | null {
  const cleaned = value.trim()
  if (!cleaned) return null
  const urlMatch = cleaned.match(/instagram\.com\/([A-Za-z0-9._]+)/)
  const candidate = (urlMatch ? urlMatch[1] : cleaned).replace(/^@/, '')
  const segments = candidate.split('?')[0].split('/')[0].split('#')[0]
  if (!USERNAME_RE.test(segments)) return null
  return segments
}

function parseCsvLines(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n')
  const rows: string[][] = []
  for (const raw of lines) {
    if (raw.trim() === '') continue
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i]
      if (inQuotes) {
        if (ch === '"' && raw[i + 1] === '"') {
          current += '"'
          i++
        } else if (ch === '"') {
          inQuotes = false
        } else {
          current += ch
        }
      } else if (ch === '"') {
        inQuotes = true
      } else if (ch === ',' || ch === ';') {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current)
    rows.push(cells.map((c) => c.trim()))
  }
  return rows
}

function pickCellIndex(header: string[], width: number): number {
  if (!header || header.length === 0) return 0
  let idx = 0
  let hasKnown = false
  for (let i = 0; i < width; i++) {
    const cell = header[i] ?? ''
    if (URL_HINTS.test(cell)) {
      return i
    }
    if (USERNAME_HINTS.test(cell)) {
      idx = i
      hasKnown = true
    }
    if (!hasKnown && HEADER_TOKENS.test(cell)) {
      idx = i
      hasKnown = true
    }
  }
  return idx
}

export function parseCsv(text: string): ProfileRow[] {
  const rows = parseCsvLines(text)
  if (rows.length === 0) return []

  const width = Math.max(...rows.map((r) => r.length))
  const hasHeader = rows[0].some((cell) => HEADER_TOKENS.test(cell))
  const header = hasHeader ? rows[0] : []
  const dataRows = hasHeader ? rows.slice(1) : rows
  const cellIndex = pickCellIndex(header, width)
  const fbIndex = hasHeader && FB_HINTS.test(header[2] ?? '') ? 2 : -1
  const followingIndex = hasHeader && FOLLOWING_HINTS.test(header[3] ?? '') ? 3 : -1

  const seen = new Set<string>()
  const profiles: ProfileRow[] = []
  for (const row of dataRows) {
    const value = row[cellIndex] ?? ''
    const username = extractUsername(value)
    if (!username || seen.has(username.toLowerCase())) continue
    seen.add(username.toLowerCase())
    let followsBack: boolean | undefined
    if (fbIndex >= 0) {
      const fbValue = (row[fbIndex] ?? '').trim().toLowerCase()
      if (/^(sim|true|1|s)$/.test(fbValue)) followsBack = true
      else if (/^(nao|não|false|0|n)$/.test(fbValue)) followsBack = false
    }
    let following: boolean | undefined
    if (followingIndex >= 0) {
      const fValue = (row[followingIndex] ?? '').trim().toLowerCase()
      if (/^(sim|true|1|s)$/.test(fValue)) following = true
      else if (/^(nao|não|false|0|n)$/.test(fValue)) following = false
    }
    profiles.push({ username, url: `https://www.instagram.com/${username}/`, sourceName: value.slice(0, 120), followsBack, following })
  }
  return profiles
}

export function toCsv(profiles: ProfileRow[]): string {
  const hasFb = profiles.some((p) => p.followsBack !== undefined)
  const hasFollowing = profiles.some((p) => p.following !== undefined)
  let header = 'username,perfil'
  if (hasFb) header += ',segue_de_volta'
  if (hasFollowing) header += ',seguindo'
  const lines = profiles.map((p) => {
    const cells = [p.username, p.url]
    if (hasFb) cells.push(p.followsBack === true ? 'sim' : 'nao')
    if (hasFollowing) cells.push(p.following === true ? 'sim' : 'nao')
    return cells.join(',')
  })
  return [header, ...lines].join('\n')
}