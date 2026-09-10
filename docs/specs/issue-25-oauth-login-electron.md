# Spec — Issue #25: Fluxo de login OAuth com Google no Electron

- **Issue:** #25 — "Fluxo de login OAuth com Google no Electron" (Plan.md seção 5 / Fase 2, item 20).
- **Branch:** `feature/25-oauth-login-electron`
- **Backend:** `Study-Butler-Backend` (repo separado, `https://github.com/jopsfernandes/study-butler-backend`),
  já expõe `GET /auth/google`, `GET /auth/google/callback` e `GET /auth/me` (JWT bearer), documentado em
  `README.md` daquele repo. Esta issue é só o lado do Electron: abrir o navegador do sistema, capturar o
  retorno via protocolo customizado, guardar e usar o token.
- **Decisões técnicas desta issue (escolhas de engenharia dentro do escopo já aprovado pelo usuário, não
  decisões de produto em aberto)**:
  1. **Fluxo via navegador do sistema + protocolo customizado `personare://`**, não uma `BrowserWindow`
     embutida carregando o login do Google diretamente — é a prática recomendada (o usuário usa a sessão
     já logada do navegador padrão, e o app nunca vê a senha do Google).
  2. **Single-instance lock** (`app.requestSingleInstanceLock()`) passa a ser exigido — é a forma padrão do
     Electron de capturar a URL do protocolo quando o app já está aberto (`second-instance`), evitando uma
     segunda instância inútil. **Mudança de comportamento visível**: abrir o Personare uma segunda vez
     agora foca a janela existente em vez de abrir um processo novo.
  3. **Token guardado via `safeStorage`** (criptografia do keychain/credential manager do SO), em um
     arquivo no `userData`, não no SQLite local — é credencial, não dado de conteúdo do usuário. Se
     `safeStorage.isEncryptionAvailable()` for `false` (alguns Linux sem keyring), a sessão simplesmente
     não persiste entre reinícios (login de novo a cada abertura) — aceitável para este MVP, documentado,
     não uma falha silenciosa de segurança (nunca grava texto plano como fallback).
  4. **Sem canal de push main→renderer novo**: a tela de Configurações faz polling de `auth.getSession()`
     a cada 2s, por até 2 minutos, depois de clicar em "Entrar com Google" — evita introduzir um mecanismo
     de evento novo (o oRPC deste projeto é só request/response) só para este caso único.
  5. **URL do backend fixa por constante** (`BACKEND_BASE_URL` em `src/constants/index.ts`), não
     configurável pela UI — não existe ainda um backend publicado em produção; trocar para a URL real de
     produção antes de distribuir a Fase 2 fica registrado como follow-up, não resolvido aqui.

## Fluxo

1. Usuário clica "Entrar com Google" em Configurações → `auth.login()` → processo main monta
   `${BACKEND_BASE_URL}/auth/google?redirect_uri=personare://oauth-callback` e chama
   `shell.openExternal(url)`.
2. Navegador do sistema abre, usuário autentica com o Google, backend redireciona para
   `personare://oauth-callback?token=<jwt>` (ou `?error=...`).
3. O SO entrega essa URL ao Personare:
   - **macOS**: evento `open-url` do `app`.
   - **Windows/Linux**: se o app já estava aberto, `second-instance` (a URL chega em `argv` da nova
     instância); se não estava aberto, a própria instância que inicia já tem a URL em `process.argv` no
     boot.
4. `handleAuthCallbackUrl(url)` (novo, em `src/main.ts`) extrai `token`, chama
   `fetchCurrentUser(token)` (novo `src/main/backend-client.ts`) contra `GET /auth/me` do backend; se
   sucesso, guarda a sessão em memória (`src/ipc/auth/state.ts`, espelhando o padrão já usado por
   `src/ipc/database/state.ts`) e persiste o token via `safeStorage` (`src/main/auth-token-storage.ts`);
   foca a janela principal.
5. No boot do app, tenta restaurar uma sessão salva: lê o token persistido, valida contra `/auth/me`; se
   inválido/expirado, descarta o arquivo salvo.
6. Configurações mostra o estado: "Entrar com Google" (deslogado) ou nome/e-mail/avatar + "Sair"
   (logado). "Sair" chama `auth.logout()`, que limpa sessão em memória e o token persistido.

## Arquivos novos/alterados

- `src/constants/index.ts`: `OAUTH_PROTOCOL`, `OAUTH_REDIRECT_URI`, `BACKEND_BASE_URL`.
- `src/main/auth-token-storage.ts` (puro, recebe `filePath` por parâmetro): `saveToken`/`loadToken`/
  `clearToken`, via `safeStorage` do Electron.
- `src/main/backend-client.ts`: `fetchCurrentUser(token)` contra `GET /auth/me`.
- `src/ipc/auth/` (novo namespace oRPC): `login()`, `getSession()`, `logout()`.
- `src/ipc/auth/state.ts`: `getSession`/`setSession`, padrão de `ipc/database/state.ts`.
- `src/main.ts`: single-instance lock, `setAsDefaultProtocolClient`, `open-url`, `second-instance`,
  extração de URL de protocolo no boot, `handleAuthCallbackUrl`, restauração de sessão salva no boot.
- `src/actions/auth.ts` + seção "Conta" em `src/routes/settings.tsx`.

## Fora de escopo (não tocar)

- Qualquer sincronização real de conteúdo (Calendar, Drive, Programs/Modules) — só autenticação.
- URL de produção do backend — fica hardcoded localhost por agora, troca é follow-up.
- Publicar a tela de consentimento OAuth / obter credenciais reais no Google Cloud Console (já feito pelo
  usuário, fora do código).
- Qualquer mudança no lado do `Study-Butler-Backend` — já está pronto e testado.

## Ordem do pipeline

1. **Testador**: RED para `auth-token-storage` (mockando `electron`'s `safeStorage`), `backend-client`
   (mockando `fetch` global), `ipc/auth` (mockando `electron`'s `shell.openExternal` e o backend-client),
   e a seção "Conta" em Configurações (mockando `@/actions/auth`). A orquestração de protocolo/
   single-instance em `main.ts` em si (assim como o `close`/Tray da Issue #20) não é testável de forma
   automatizada com este stack — documentar validação manual no PR.
2. **Desenvolvedor**: implementar o mínimo para os testes passarem; validar manualmente o fluxo completo
   ponta a ponta (app empacotado ou `npm start`, backend rodando local com credenciais reais do Google).
3. **Revisor**: suíte completa, confirmar que o token nunca é persistido em texto plano, que o
   single-instance lock não quebra o Tray/close-to-tray da Issue #20.
4. **Redator de Docs**: `CHANGELOG.md`, destacando a mudança de comportamento do single-instance lock.
