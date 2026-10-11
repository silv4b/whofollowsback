import type { Plugin } from 'vite'
import type { ServerResponse } from 'node:http'

export interface CheckResult {
  username: string
  exists: boolean | null
  isPrivate: boolean | null
  avatar: string | null
  code: 'exists' | 'not_exists' | 'rate_limited' | 'error'
  title: string
  status: number
}

const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
} as const

function htmlDecode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
}

async function checkProfile(username: string): Promise<CheckResult> {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  let html = ''
  let status = 0
  let finalUrl = ''
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    })
    status = res.status
    finalUrl = res.url
    html = await res.text()
  } catch {
    return {
      username,
      exists: null,
      isPrivate: null,
      avatar: null,
      code: 'error',
      title: '',
      status: 0,
    }
  } finally {
    clearTimeout(timer)
  }

  const title = htmlDecode(html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? '')
  const hasOg = /property=["']og:description["']\s+content=["']/i.test(html)
  const isPrivate = /"is_private":\s*true/i.test(html)
  const avatar = htmlDecode(html.match(/property=["']og:image["']\s+content=["']([^"']*)["']/i)?.[1] ?? '') || null
  const t = title.toLowerCase()
  const confirmedTitle =
    hasOg && (t.includes(`(@${username.toLowerCase()})`) || t.startsWith(username.toLowerCase()))

  if (status >= 200 && status < 300 && hasOg && confirmedTitle) {
    return { username, exists: true, isPrivate, avatar, code: 'exists', title, status }
  }

  const rateLimited =
    status === 429 ||
    /Please wait a few minutes/i.test(html) ||
    /\/accounts\/login\/|\/challenge\//i.test(finalUrl)

  if (rateLimited) {
    return { username, exists: null, isPrivate: null, avatar: null, code: 'rate_limited', title, status }
  }

  if (status >= 500 || html.length < 500) {
    return { username, exists: null, isPrivate, avatar: null, code: 'error', title, status }
  }

  return { username, exists: false, isPrivate: null, avatar: null, code: 'not_exists', title, status }
}

function sendJson(res: ServerResponse, data: unknown): void {
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export function checkProfilePlugin(): Plugin {
  return {
    name: 'check-profile-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        if (url.pathname !== '/api/check-profile') {
          next()
          return
        }
        const username = (url.searchParams.get('username') ?? '').trim()
        if (!USERNAME_RE.test(username)) {
          sendJson(res, { error: 'username inválido' })
          return
        }
        try {
          sendJson(res, await checkProfile(username))
        } catch (err) {
          sendJson(res, {
            username,
            exists: null,
            isPrivate: null,
            code: 'error',
            title: '',
            status: 0,
            error: err instanceof Error ? err.message : 'erro',
          })
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost')
        if (url.pathname !== '/api/check-profile') {
          next()
          return
        }
        const username = (url.searchParams.get('username') ?? '').trim()
        if (!USERNAME_RE.test(username)) {
          sendJson(res, { error: 'username inválido' })
          return
        }
        try {
          sendJson(res, await checkProfile(username))
        } catch (err) {
          sendJson(res, {
            username,
            exists: null,
            isPrivate: null,
            code: 'error',
            title: '',
            status: 0,
            error: err instanceof Error ? err.message : 'erro',
          })
        }
      })
    },
  }
}