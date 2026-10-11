import JSZip from 'jszip'
import { extractUsername, type ProfileRow } from './csv'

export interface ZipResult {
  profiles: ProfileRow[]
  followersCount: number
  followingCount: number
}

const FOLLOWERS_RE = /^connections\/followers_and_following\/followers(?:_\d+)?\.json$/i
const FOLLOWING_RE = /^connections\/followers_and_following\/following(?:_\d+)?\.json$/i

interface IgItem {
  title?: string
  string_list_data?: Array<{ value?: string | null; href?: string | null } & Record<string, unknown>>
  media_list_data?: Array<Record<string, unknown>>
}

function itemUsername(item: IgItem): string | null {
  const fromList = item.string_list_data?.find((s) => typeof s.value === 'string' && s.value)?.value
  const raw = fromList || item.title || ''
  return extractUsername(raw)
}

async function collectUsers(entries: JSZip.JSZipObject[], key: 'relationships_followers' | 'relationships_following'): Promise<string[]> {
  const users: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const json = JSON.parse(await entry.async('string')) as unknown
    const list: IgItem[] = Array.isArray(json)
      ? (json as IgItem[])
      : Array.isArray((json as Record<string, unknown>)?.[key])
        ? ((json as Record<string, unknown>)[key] as IgItem[])
        : []
    for (const item of list) {
      const username = itemUsername(item)
      if (!username || seen.has(username.toLowerCase())) continue
      seen.add(username.toLowerCase())
      users.push(username)
    }
  }
  return users
}

export async function loadInstagramZip(file: File | Blob): Promise<ZipResult> {
  const zip = await JSZip.loadAsync(file)
  const entries = Object.values(zip.files)

  const followersFiles = entries
    .filter((e) => FOLLOWERS_RE.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
  const followingFiles = entries.filter((e) => FOLLOWING_RE.test(e.name))

  const followers = await collectUsers(followersFiles, 'relationships_followers')
  const following = await collectUsers(followingFiles, 'relationships_following')

  const followersSet = new Set(followers.map((u) => u.toLowerCase()))
  const followingSet = new Set(following.map((u) => u.toLowerCase()))
  const seen = new Set<string>()
  const profiles: ProfileRow[] = []
  for (const username of [...followers, ...following]) {
    const key = username.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    profiles.push({
      username,
      url: `https://www.instagram.com/${username}/`,
      sourceName: followersSet.has(key) ? 'seguidor' : 'seguindo',
      followsBack: followersSet.has(key),
      following: followingSet.has(key),
    })
  }

  return { profiles, followersCount: followers.length, followingCount: following.length }
}