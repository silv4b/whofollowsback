import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseCsv, toCsv, type ProfileRow } from './csv'
import { runVerification, type Row, type RowStatus, type CheckSnapshot } from './checker'
import { loadInstagramZip } from './instagramZip'

type VisibilityFilter = 'pub' | 'priv'
type RelationshipFilter = 'follows_back' | 'not_follows_back'

const STATUS_LABEL: Record<RowStatus, string> = {
  idle: '—',
  checking: 'verificando…',
  exists: 'existe',
  not_exists: 'não existe',
  error: 'erro',
}

function Avatar({ username, avatar }: { username: string; avatar: string | null }) {
  const [failed, setFailed] = useState(false)
  if (avatar && !failed) {
    return (
      <img
        className="avatar"
        src={avatar}
        alt={`Foto de ${username}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }
  return <span className="avatar fallback">{username.slice(0, 1).toUpperCase()}</span>
}

function App() {
  const [rows, setRows] = useState<Row[]>([])
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<CheckSnapshot | null>(null)
  const [running, setRunning] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<RowStatus[]>([])
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter[]>([])
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [copied, setCopied] = useState(false)
  const [dropping, setDropping] = useState(false)

  useEffect(() => () => abortRef.current?.abort(), [])

  const counts = useMemo(() => {
    return {
      total: rows.length,
      idle: rows.filter((r) => r.status === 'idle').length,
      exists: rows.filter((r) => r.status === 'exists').length,
      publics: rows.filter((r) => r.status === 'exists' && r.isPrivate === false).length,
      privates: rows.filter((r) => r.status === 'exists' && r.isPrivate === true).length,
      notExists: rows.filter((r) => r.status === 'not_exists').length,
      errors: rows.filter((r) => r.status === 'error').length,
      checking: rows.filter((r) => r.status === 'checking').length,
      followsBack: rows.filter((r) => r.followsBack === true).length,
      notFollowBack: rows.filter((r) => r.followsBack === false).length,
    }
  }, [rows])

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (r: Row) => !q || r.username.toLowerCase().includes(q)
    return rows.filter((r) => {
      if (!matches(r)) return false
      if (statusFilter.length > 0 && !statusFilter.includes(r.status)) return false
      if (visibilityFilter.length > 0) {
        const ok = visibilityFilter.some((v) =>
          v === 'pub'
            ? r.status === 'exists' && r.isPrivate === false
            : r.status === 'exists' && r.isPrivate === true,
        )
        if (!ok) return false
      }
      if (relationshipFilter.length > 0) {
        const ok = relationshipFilter.some((v) =>
          v === 'follows_back' ? r.followsBack === true : r.followsBack === false,
        )
        if (!ok) return false
      }
      return true
    })
  }, [rows, query, statusFilter, visibilityFilter, relationshipFilter])

  function loadProfiles(profiles: ProfileRow[], name: string) {
    abortRef.current?.abort()
    setRows(profiles.map((p) => ({ ...p, status: 'idle' as RowStatus, isPrivate: null })))
    setProgress(null)
    setStatusFilter([])
    setVisibilityFilter([])
    setRelationshipFilter([])
    setFileName(name)
    setCopied(false)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip'
    let profiles: ProfileRow[] = []
    if (isZip) {
      try {
        const result = await loadInstagramZip(file)
        if (result.profiles.length === 0) {
          alert(
            'Não encontrei seguidores no ZIP. Confira se a exportação inclui a seção "Seguidores e Seguindo" no formato JSON.',
          )
          return
        }
        profiles = result.profiles
      } catch {
        alert('Não consegui ler o ZIP. Ele é uma exportação de dados do Instagram?')
        return
      }
    } else {
      const text = await file.text()
      profiles = parseCsv(text)
      if (profiles.length === 0) {
        alert('Nenhum perfil encontrado no arquivo. Confira se o CSV tem uma coluna com username ou link do perfil.')
        return
      }
    }
    loadProfiles(profiles, file.name)
  }

  function start(onlyPending: boolean) {
    if (rows.length === 0 || running) return
    abortRef.current?.abort()
    const base = rows.map((r) => {
      const needsCheck = onlyPending
        ? r.status !== 'exists' && r.status !== 'not_exists'
        : true
      return needsCheck ? { ...r, status: 'idle' as RowStatus, isPrivate: null, avatar: null, note: undefined } : r
    })
    setRows(base)
    setRunning(true)
    setProgress(null)
    setCopied(false)
    const controller = new AbortController()
    abortRef.current = controller
    window.setTimeout(() => {
      void runVerification(
        base,
        (index, patch) => setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r))),
        setProgress,
        { concurrency: 4, signal: controller.signal },
      )
        .catch(() => { })
        .finally(() => setRunning(false))
    }, 50)
  }

  async function copyExisting() {
    const list = rows.filter((r) => r.status === 'exists').map((r) => r.username).join('\n')
    if (!list) return
    await navigator.clipboard.writeText(list)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  function downloadExisting() {
    const existing = rows.filter((r) => r.status === 'exists')
    if (existing.length === 0) return
    const csv = toCsv(existing)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'perfis-que-existem.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const ocultos = rows.filter((r) => r.status === 'exists' && r.isPrivate).length

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="logo" aria-hidden>
          <span className="logo-ring">🤔</span>
        </div>
        <div>
          <h1>whofollowsback</h1>
          <p className="sub">
            Carregue um CSV com usernames ou um ZIP de exportação do Instagram. Confira quais contas ainda existem e
            exporte só os perfis válidos.
          </p>
        </div>
      </header>

      <main>

        <section className='tutorial'>
          <Link to="/tutorial" className="btn ghost small" style={{ marginLeft: 8, padding: '2px 8px' }}>
            Ver tutorial
          </Link>
        </section>

        <section
          className={`dropzone${dropping ? ' dropping' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDropping(true)
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDropping(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.zip,text/csv,application/zip"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="dropzone-inner">
            <span className="dropzone-icon">📄</span>
            <p>
              Arraste o <strong>CSV</strong> ou <strong>ZIP do Instagram</strong> aqui ou{' '}
              <strong>clique para escolher</strong>
            </p>
            <p className="hint">
              CSV com coluna de username ou exportação de dados (Seguidores e Seguindo, JSON).{' '}
            </p>
          </div>
        </section>

        <section className="controls">
          {rows.length > 0 && (
            <span className="filename">
              {fileName} — {rows.length} perfis
            </span>
          )}
        </section>

        {rows.length > 0 && (
          <>
            <section className="actions">
              <button type="button" className="btn primary" disabled={running} onClick={() => start(false)}>
                {running ? 'Verificando…' : 'Verificar todos'}
              </button>
              {(counts.errors > 0 || counts.idle > 0) && !running && (
                <button type="button" className="btn" onClick={() => start(true)}>
                  Re-verificar pendentes ({counts.idle + counts.errors})
                </button>
              )}
              {running && (
                <button type="button" className="btn danger" onClick={() => abortRef.current?.abort()}>
                  Cancelar
                </button>
              )}
              <span className="spacer" />
              <button type="button" className="btn" disabled={running || counts.exists === 0} onClick={copyExisting}>
                {copied ? 'Copiado ✓' : 'Copiar existentes'}
              </button>
              <button type="button" className="btn" disabled={running || counts.exists === 0} onClick={downloadExisting}>
                Baixar CSV (existentes)
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={running}
                onClick={() => {
                  setRows([])
                  setProgress(null)
                  setFileName('')
                }}
              >
                Limpar
              </button>
            </section>

            {(running || progress) && (
              <section className="progress-block">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${percent}%` }} />
                </div>
                <p className="progress-text">
                  Verificados {progress?.done ?? 0} de {rows.length} ({percent}%){' '}
                  {counts.checking > 0 ? `· ${counts.checking} em andamento` : ''}
                </p>
                <div className="stats">
                  <span className="stat ok">✓ {counts.exists} existem</span>
                  <span className="stat bad">✗ {counts.notExists} não existem</span>
                  <span className="stat warn">! {counts.errors} erros</span>
                </div>
              </section>
            )}

            {counts.exists > 0 && ocultos > 0 && !running && (
              <p className="hint">Entre os que existem, {ocultos} são contas privadas.</p>
            )}

            <section className="searchbar">
              <input
                type="search"
                className="search"
                placeholder="Buscar perfil…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </section>

            <section className="filters">
              <div className="filter-group">
                <span className="filter-label">Relação</span>
                {(
                  [
                    ['not_follows_back', 'Não seguem de volta', counts.notFollowBack],
                    ['follows_back', 'Seguem de volta', counts.followsBack],
                  ] as [RelationshipFilter, string, number][]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip${relationshipFilter.includes(key) ? ' active' : ''}`}
                    onClick={() => setRelationshipFilter(toggle(relationshipFilter, key))}
                  >
                    {label} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">Visibilidade</span>
                {(
                  [
                    ['pub', 'Públicos', counts.publics],
                    ['priv', 'Privados', counts.privates],
                  ] as [VisibilityFilter, string, number][]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip${visibilityFilter.includes(key) ? ' active' : ''}`}
                    onClick={() => setVisibilityFilter(toggle(visibilityFilter, key))}
                  >
                    {label} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
              <div className="filter-group">
                <span className="filter-label">Status</span>
                {(
                  [
                    ['exists', 'Existem', counts.exists],
                    ['not_exists', 'Não existem', counts.notExists],
                    ['error', 'Erros', counts.errors],
                  ] as [RowStatus, string, number][]
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    className={`chip${statusFilter.includes(key) ? ' active' : ''}`}
                    onClick={() => setStatusFilter(toggle(statusFilter, key))}
                  >
                    {label} <span className="chip-count">{count}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Perfil</th>
                    <th>Status</th>
                    <th className="right">Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty">
                        Nenhum perfil nesta categoria.
                      </td>
                    </tr>
                  )}
                  {filtered.map((row, i) => (
                    <tr key={row.username} className={`row-${row.status}`}>
                      <td className="num">{i + 1}</td>
                      <td>
                        <div className="perfil-cell">
                          <Avatar key={row.avatar ?? row.status} username={row.username} avatar={row.avatar ?? null} />
                          <span className="username">@{row.username}</span>
                          {row.followsBack !== undefined &&
                            (row.following === undefined ? (
                              <span className={`tag ${row.followsBack ? 'fb' : 'nofb'}`}>
                                {row.followsBack ? 'segue de volta' : 'não segue de volta'}
                              </span>
                            ) : row.followsBack && row.following ? (
                              <span className="tag fb">seguem de volta</span>
                            ) : row.followsBack ? (
                              <span className="tag priv">você não segue de volta</span>
                            ) : (
                              <span className="tag nofb">não te segue de volta</span>
                            ))}
                          {row.status === 'exists' && (
                            <span className={`tag ${row.isPrivate ? 'priv' : 'pub'}`}>
                              {row.isPrivate ? 'privado' : 'público'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`status status-${row.status}`}>
                        {STATUS_LABEL[row.status]}
                        {row.note && <div className="row-note">{row.note}</div>}
                      </td>
                      <td className="right">
                        <a className="btn small" href={row.url} target="_blank" rel="noopener noreferrer">
                          🛩️
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>

      <footer>
        <p>
          Checagem feita pelo próprio servidor (sem login). Se o Instagram limitar as requisições, aguarde alguns
          minutos e use “Re-verificar pendentes”.
        </p>
      </footer>
    </div>
  )
}

export default App