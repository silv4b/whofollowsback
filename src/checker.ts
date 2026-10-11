export type RowStatus = 'idle' | 'checking' | 'exists' | 'not_exists' | 'error'

export interface Row {
  username: string
  url: string
  sourceName: string
  status: RowStatus
  isPrivate: boolean | null
  avatar?: string | null
  note?: string
  followsBack?: boolean
  following?: boolean
}

export interface CheckSnapshot {
  done: number
  total: number
  exists: number
  notExists: number
  errors: number
}

interface ApiResult {
  username: string
  exists: boolean | null
  isPrivate: boolean | null
  avatar?: string | null
  code: 'exists' | 'not_exists' | 'rate_limited' | 'error'
  status: number
}

const RECONFIRM_DELAY_MS = 1500
const GAP_PER_WORKER_MS = 400

async function fetchProfile(username: string): Promise<ApiResult> {
  const res = await fetch(`/api/check-profile?username=${encodeURIComponent(username)}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as ApiResult
}

export async function runVerification(
  rows: Row[],
  onRow: (index: number, patch: Partial<Row>) => void,
  onProgress: (snapshot: CheckSnapshot) => void,
  opts: { concurrency?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const concurrency = Math.min(opts.concurrency ?? 4, 8)
  const abort = opts.signal
  const queue = rows.map((_, i) => i)
  let head = 0

  const snapshot = (): CheckSnapshot => ({
    done: rows.filter((r) => r.status !== 'idle').length,
    total: rows.length,
    exists: rows.filter((r) => r.status === 'exists').length,
    notExists: rows.filter((r) => r.status === 'not_exists').length,
    errors: rows.filter((r) => r.status === 'error').length,
  })

  const work = async (): Promise<void> => {
    while (head < queue.length) {
      if (abort?.aborted) return
      const index = queue[head++]
      const row = rows[index]
      rows[index] = { ...row, status: 'checking', note: undefined }
      onRow(index, { status: 'checking', note: undefined })
      try {
        const first = await fetchProfile(row.username)
      let result = first
        if (first.code === 'not_exists') {
          await new Promise((r) => setTimeout(r, RECONFIRM_DELAY_MS))
          if (abort?.aborted) return
          result = await fetchProfile(row.username)
        }
        if (result.code === 'exists') {
          rows[index] = {
            ...rows[index],
            status: 'exists',
            isPrivate: result.isPrivate ?? false,
            avatar: result.avatar ?? rows[index].avatar,
          }
          onRow(index, { status: 'exists', isPrivate: result.isPrivate ?? false, avatar: result.avatar ?? rows[index].avatar })
        } else if (result.code === 'not_exists') {
          rows[index] = { ...rows[index], status: 'not_exists', isPrivate: null, avatar: null }
          onRow(index, { status: 'not_exists', isPrivate: null, avatar: null })
        } else {
          const note =
            result.code === 'rate_limited'
              ? 'Instagram limitou as requisições. Tente novamente em alguns minutos.'
              : `Falha ao consultar (HTTP ${result.status || '—'}).`
          rows[index] = { ...rows[index], status: 'error', isPrivate: null, avatar: null, note }
          onRow(index, { status: 'error', isPrivate: null, avatar: null, note })
        }
      } catch (err) {
        const note = err instanceof Error ? err.message : 'Erro de rede'
        rows[index] = { ...rows[index], status: 'error', isPrivate: null, avatar: null, note }
        onRow(index, { status: 'error', isPrivate: null, avatar: null, note })
      }
      onProgress(snapshot())
      await new Promise((r) => setTimeout(r, GAP_PER_WORKER_MS + Math.random() * 250))
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, () => work())
  await Promise.all(workers)
  onProgress(snapshot())
}