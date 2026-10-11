import { Link } from 'react-router-dom'

export default function Tutorial() {
  return (
    <div className="wrap">
      <header className="topbar">
        <div className="logo" aria-hidden>
          <span className="logo-ring">🤔</span>
        </div>
        <div>
          <h1>Como exportar o .zip corretamente</h1>
          <p className="sub">
            Siga os passos abaixo no aplicativo do Instagram para gerar uma exportação no <strong>formato JSON</strong>,
            com <strong>apenas Seguidores e Seguindo</strong>, no intervalo <strong>Desde o início</strong>. Após o download,
            envie o <code>.zip</code> nesta ferramenta.
          </p>
        </div>
      </header>

      <main>
        <nav style={{ marginBottom: 24 }}>
          <Link className="btn ghost" to="/">← Voltar ao verificador</Link>
        </nav>

        <section className="dropzone" style={{ textAlign: 'left', maxWidth: 900, margin: '0 auto' }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
            <li>
              <strong>Abra o menu do perfil</strong> – No seu perfil, toque no menu (...) no canto superior direito.
            </li>
            <li>
              <strong>Abra a Central de Contas</strong> – Em Configurações e atividade, toque em "Central de Contas".
            </li>
            <li>
              <strong>Suas informações e permissões</strong> – Toque em "Suas informações e permissões".
            </li>
            <li>
              <strong>Exportar suas informações</strong> – Toque em "Exportar suas informações".
            </li>
            <li>
              <strong>Criar exportação</strong> – Toque em "Criar exportação".
            </li>
            <li>
              <strong>Exportar para o dispositivo</strong> – Selecione "Exportar para o dispositivo".
            </li>
            <li>
              <strong>Personalizar informações</strong> – Toque em "Personalizar informações" para escolher o que vai
              entrar no arquivo.
            </li>
            <li>
              <strong>Marque apenas Seguidores e Seguindo</strong> – Marque <strong>apenas</strong> "Seguidores" e
              "Seguindo", toque em "Salvar" e volte à tela anterior.
            </li>
            <li>
              <strong>Use o período "Desde o início" (Essencial)</strong> – Toque em "Intervalo de datas", selecione{' '}
              <strong>Desde o início</strong> e toque em "Salvar".
            </li>
            <li>
              <strong>Confirme o formato JSON (Essencial)</strong> – Toque em "Formato", escolha <strong>JSON</strong>,
              toque em "Salvar" e depois em <strong>Iniciar exportação</strong>.
            </li>
            <li>
              <strong>Espere o arquivo ficar pronto</strong> – O Instagram vai preparar o arquivo. Você receberá um
              e-mail avisando quando estiver pronto (pode levar de <strong>minutos a horas</strong>). Baixe o <code>.zip</code>
              e envie-o nesta ferramenta.
            </li>
          </ol>

          <div style={{ marginTop: 16, padding: 12, background: 'var(--panel-2)', borderRadius: 8, fontSize: 14 }}>
            <strong>Arquivos esperados dentro do .zip:</strong>
            <pre style={{ marginTop: 8, marginBottom: 0, fontSize: 12, lineHeight: 1.5 }}>
{`connections/followers_and_following/followers_*.json
connections/followers_and_following/following.json`}</pre>
            <p style={{ marginTop: 8, marginBottom: 0, opacity: 0.8 }}>
              A ferramenta também aceita esses arquivos em subpastas — ela busca <code>followers_*.json</code> e <code>following.json</code> dentro do ZIP.
            </p>
          </div>
        </section>

        <footer>
          <p>Dica: exportar <strong>apenas Seguidores e Seguindo</strong>, intervalo <strong>Desde o início</strong> e formato <strong>JSON</strong> é o que garante o resultado correto.</p>
        </footer>
      </main>
    </div>
  )
}