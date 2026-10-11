# whofollowsback

Aplicação web para verificar quais perfis do Instagram ainda existem a partir de uma lista em CSV ou de um arquivo `.zip` exportado pelos dados do Instagram.

## Tecnologias

- [React 19](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vitejs.dev/)
- [React Router DOM 7](https://reactrouter.com/)
- [JSZip 3](https://stuk.github.io/jszip/)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter)

## Como rodar

```bash
# Instalar dependências
npm install

# Rodar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar linter
npm run lint

# Preview da build
npm run preview
```

## Funcionalidades

### 1. Importação de dados

- **Arrastar e soltar**: Suporte a drag & drop para arquivos CSV ou ZIP.
- **Upload via botão**: Seleção manual de arquivos (`.csv`, `.zip`).
- **Suporte a CSV**: Aceita arquivos CSV com usernames, links do Instagram ou colunas com informações de seguidores/seguindo.
- **Suporte a ZIP do Instagram**: Lê exportações de dados do Instagram contendo `followers_*.json` e `following.json` em `connections/followers_and_following/`.
- **Detecção inteligente de colunas**: Identifica automaticamente colunas com username, link, relação "segue de volta" e "seguindo".
- **Normalização de usernames**: Extrai usernames a partir de URLs (`instagram.com/usuario`), remove `@` e valida formato permitido (`A-Za-z0-9._` com até 30 caracteres).
- **Remoção de duplicados**: Ignora usernames duplicados (case-insensitive).

### 2. Verificação de perfis

- **Verificação em lote**: Verifica todos os perfis carregados com controle de concorrência (máximo 4 requisições simultâneas).
- **Endpoint interno**: Usa o plugin Vite `/api/check-profile` para consultar perfis diretamente pelo frontend.
- **Detecção de existência**: Identifica perfis que existem (`existe`), não existem (`não existe`) ou com erro (`erro`).
- **Reconfirmação inteligente**: Quando detectado como "não existe", faz uma segunda verificação após 1,5s para reduzir falsos negativos.
- **Detecção de privacidade**: Identifica se o perfil verificado é público ou privado.
- **Extração de avatar**: Captura a imagem de perfil (`og:image`) quando disponível.
- **Tratamento de rate-limit**: Detecta quando o Instagram limita requisições (HTTP 429, challenge/login ou mensagem "Please wait a few minutes") e exibe aviso apropriado.
- **Pausa entre requisições**: Adiciona pequenos intervalos entre verificações para evitar bloqueios.
- **Cancelar verificação**: Permite interromper o processo a qualquer momento.
- **Verificar pendentes**: Reexecuta verificação apenas para perfis com status `idle` ou `erro`.

### 3. Relações entre perfis (Seguidores/Seguindo)

- **Extração do ZIP**: Ao importar ZIP do Instagram, cruza listas de seguidores e seguindo.
- **Tags automáticas**: Exibe tags indicando:
  - `segue de volta` / `não segue de volta`
  - `você não segue de volta` (quando segue mas não é seguido de volta)
  - `não te segue de volta` (quando é seguido mas não segue de volta)
- **Suporte a CSV com relações**: Aceita colunas `segue_de_volta` e `seguindo` com valores `sim/true/1/s` ou `nao/não/false/0/n`.
- **Contadores dedicados**: Exibe totais de perfis que seguem de volta e não seguem de volta.

### 4. Filtros e busca

- **Busca por username**: Filtro em tempo real pelo nome de usuário.
- **Filtro por status**: Filtra por `Existem`, `Não existem` ou `Erros`.
- **Filtro por visibilidade**: Filtra perfis existentes entre `Públicos` e `Privados`.
- **Filtro por relação**: Filtra entre `Seguem de volta` e `Não seguem de volta`.
- **Combinação de filtros**: Múltiplos filtros podem ser aplicados simultaneamente.
- **Contadores em chips**: Cada filtro exibe a quantidade de resultados correspondentes.

### 5. Ações e exportação

- **Copiar existentes**: Copia todos os usernames com status `existe` para a área de transferência (um por linha).
- **Baixar CSV**: Exporta um arquivo `perfis-que-existem.csv` contendo apenas perfis verificados como existentes. Inclui colunas `username`, `perfil`, `segue_de_volta` e `seguindo` quando aplicável.
- **Limpar lista**: Remove todos os perfis carregados, resets de filtros e progresso.
- **Abrir perfil**: Botão para abrir o perfil no Instagram em nova aba.

### 6. Interface e experiência

- **Tema escuro**: Interface moderna com paleta escura e detalhes em gradiente rosa/roxo.
- **Progresso em tempo real**: Barra de progresso com porcentagem, contagem verificados/total e status "em andamento".
- **Estatísticas resumidas**: Cards com totais de `existem`, `não existem`, `erros`, `públicos`, `privados`.
- **Tabela responsiva**: Exibe avatar, username, tags de relação/visibilidade, status com observações e link para perfil.
- **Aviso de perfis privados**: Exibe mensagem quando existem perfis privados entre os verificados.
- **Página de tutorial**: Guia completo em `/tutorial` com passo a passo para exportar ZIP do Instagram corretamente (formato JSON, intervalo "Desde o início", apenas Seguidores e Seguindo).
- **Estado preservado**: Aborta requisições pendentes ao trocar de arquivo ou cancelar.

## Estrutura do projeto

```text
app/
├── src/
│   ├── App.tsx           # Componente principal com UI e lógica
│   ├── checker.ts        # Lógica de verificação em lote e tipos
│   ├── csv.ts            # Parsing e exportação de CSV
│   ├── instagramZip.ts   # Leitura de ZIP do Instagram
│   ├── main.tsx          # Ponto de entrada + rotas
│   ├── Tutorial.tsx      # Página de tutorial
│   └── index.css         # Estilos globais
├── plugins/
│   └── checkProfile.ts   # Plugin Vite com endpoint /api/check-profile
├── public/               # Assets estáticos
├── index.html            # HTML base
└── vite.config.ts        # Configuração do Vite
```

## Observações

- A verificação é feita consultando páginas públicas do Instagram. Se houver muitos perfis, o Instagram pode temporariamente limitar requisições, nesse caso use "Re-verificar pendentes" após aguardar alguns minutos.
- Para melhor compatibilidade, recomenda-se exportar o ZIP com **formato JSON**, intervalo **"Desde o início"** e **apenas "Seguidores" e "Seguindo"**.
