# Spec — Issue #20: Notificação via inicialização com o sistema operacional

- **Issue:** [#20](https://github.com/jopsfernandes/Personare/issues/20) — "Notificação via inicialização com o sistema operacional"
- **Corpo da issue:** "Configurar `app.setLoginItemSettings` para iniciar o app oculto/na bandeja do
  sistema junto com o SO. Ao iniciar oculto, calcular as revisões do dia via `ts-fsrs` e disparar
  notificações nativas do SO. Adicionar opção na UI para o usuário desativar essa inicialização
  automática, com explicação clara do que ela faz. Referência: Plan.md, seção 2 e Fase 1, item 16."
- **Branch:** `feature/20-notificacao-boot`
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Ícone do Tray**: usar um ícone placeholder simples gerado em código (não existe nenhum asset de
     marca no repositório ainda — `images/` só tem um screenshot de demo, `forge.config.ts` não
     configura ícone nenhum). Trocar por um ícone de marca real é trabalho futuro, fora desta issue.
  2. **Escopo do "modo oculto"**: **mais amplo que o texto literal da issue** — não é só na
     inicialização automática pelo SO. Fechar a janela principal (botão X) também minimiza para o Tray
     em vez de encerrar o app, em **qualquer** sessão, independente de como o app foi iniciado. O app só
     encerra de fato pelo item "Sair" do menu do Tray. Essa é uma mudança de comportamento do ciclo de
     vida do app inteiro, não só do caminho de auto-start — documentada aqui porque foi uma decisão de
     produto explícita do usuário, não uma inferência.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Contexto técnico

`src/main.ts` hoje: `app.whenReady()` sempre chama `createWindow()` incondicionalmente, e
`window-all-closed` chama `app.quit()` (fora do macOS). Não existe `Tray`, `Notification`, nem
`app.setLoginItemSettings` em lugar nenhum do código. Não existe nenhuma tabela de configurações no
schema, nem rota `/settings`.

O processo **main** já tem acesso direto ao `db` (via `getDatabaseClient()`, setado em
`setupDatabase()`) — a lógica de "calcular revisões do dia" e ler/gravar a preferência de auto-start
**não precisa passar pelo oRPC** para o próprio processo main consultar essas coisas; oRPC só é
necessário para a tela de Configurações (processo renderer) ler/gravar a preferência.

### AC-1 — Migration: tabela `app_settings`

Uma tabela singleton (uma linha só, id fixo) para preferências do app. Por ora, um único campo:

```ts
export const appSettings = sqliteTable("app_settings", {
  autoStartEnabled: integer("auto_start_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  id: integer("id").primaryKey(), // sempre 1, singleton
});
```

Gerar a migration via `drizzle-kit generate` (será a `0006_*.sql`). Não popular uma linha inicial via
migration — o handler de leitura (AC-3) deve fazer upsert/criar a linha `id=1` com o default `false` na
primeira leitura se ela ainda não existir (evita depender de seed de dado em migration).

### AC-2 — `src/main/tray-icon.ts`: ícone placeholder gerado em código, sem asset externo

Função pura `createPlaceholderTrayIcon(): Electron.NativeImage` que constrói um buffer RGBA
manualmente (ex. 32×32, um círculo preenchido sólido calculado por distância ao centro — sem
renderizar texto/fonte, sem depender de nenhuma lib de imagem) e retorna via
`nativeImage.createFromBuffer(buffer, { width: 32, height: 32 })`. Zero dependência nova, zero
resolução de caminho de arquivo entre dev/pacote — o ícone existe só em memória.

### AC-3 — `src/main/due-reviews.ts`: contagem de revisões do dia, direto no processo main

Função pura(ish) `countDueReviews(db: DatabaseClient, now: Date): number` — mesma lógica de join que
`review.listDue`/`review.listSchedule` já usam (`review_items` inner join `flashcards` where
`flashcards.deletedAt IS NULL`), mas **global** (sem filtro de `activityId`, como `listSchedule`) **e**
filtrada por `dueDate <= now` (como `listDue`) — ou seja, a mesma semântica de "pendente agora" que o
resto do app já usa para "revisões do dia", só que sem escopo de uma Atividade específica. Não expor
isso como procedure oRPC nova — é só para o processo main consultar internamente ao decidir se dispara
notificação.

### AC-4 — Namespace IPC `settings`

Novo diretório `src/ipc/settings/` (`schemas.ts`, `handlers.ts`, `index.ts`), registrado em
`src/ipc/router.ts` sob a chave `settings`:

- **`get()`** (sem input): lê a linha `id=1` de `app_settings`; se não existir, cria com
  `autoStartEnabled: false` e retorna isso. Retorna `{ autoStartEnabled: boolean }`.
- **`setAutoStart({ enabled: boolean })`**: faz upsert da linha `id=1` com o novo valor, **e** chama
  `app.setLoginItemSettings({ openAtLogin: enabled })` no mesmo handler — o toggle tem efeito imediato
  no registro do SO, não só na próxima inicialização. `app` (de `"electron"`) é importado direto no
  handler — assim como o resto do app, os handlers de IPC já rodam exclusivamente no processo main.

### AC-5 — `src/main.ts`: ciclo de vida do app

Reescrever a inicialização:

1. `app.whenReady()`: ler `app.getLoginItemSettings().wasOpenedAtLogin` **antes** de criar qualquer
   janela — essa é a API que diz se o SO iniciou o app por causa do login item (funciona em
   Windows/macOS; não existe conceito equivalente em Linux, então nesse caso o valor sempre será
   `false` e o app simplesmente sempre abre normal, o que é aceitável — não é o SO alvo principal do
   projeto).
2. `setupDatabase()` continua rodando cedo, como já roda hoje (a leitura da preferência salva depende
   disso).
3. Criar o `Tray` **sempre**, incondicionalmente (independente de como o app foi iniciado) — ícone via
   `createPlaceholderTrayIcon()` (AC-2), menu de contexto com dois itens: "Abrir Personare" (foca/mostra
   a janela principal, criando-a se ainda não existir) e "Sair" (encerra o app de verdade — ver item 6).
   Clicar no ícone do Tray (não no menu) também foca/mostra a janela.
4. Se `wasOpenedAtLogin` for `true`: **não** chamar `createWindow()` neste momento (app inicia sem
   nenhuma janela visível, só o Tray). Consultar `countDueReviews` (AC-3) contra o `now` atual; se
   `> 0`, disparar uma `new Notification({ title, body })` nativa (texto simples, ex. "Você tem N
   revisões pendentes hoje" — chave i18n não é necessária aqui, é texto do processo main sem acesso ao
   `i18next` do renderer; usar texto fixo em português é aceitável para esta issue, internacionalizar
   notificações nativas fica para trabalho futuro).
5. Se `wasOpenedAtLogin` for `false` (inicialização manual, todo o resto): `createWindow()` normalmente,
   como hoje.
6. **Fechar a janela principal não fecha o app.** Interceptar o evento `close` da janela (`mainWindow.on("close", ...)`
   — não `window-all-closed`, que dispara tarde demais para conseguir cancelar): se o app não estiver
   num estado explícito de "saindo de verdade" (uma flag módulo-level, ex. `let isQuitting = false`,
   setada como `true` só dentro do handler do item "Sair" do Tray antes de chamar `app.quit()`),
   `event.preventDefault()` e `mainWindow.hide()` em vez de deixar a janela fechar. O item "Sair" do
   Tray seta `isQuitting = true` e então chama `app.quit()` (que, sem a flag setada, teria sido
   interceptado pelo mesmo handler de `close`).
7. Ao sincronizar a preferência salva com o SO na inicialização: depois de ler a preferência via AC-4's
   `get()` (chamado diretamente contra o `db`, sem round-trip de oRPC, já que main já tem o client),
   chamar `app.setLoginItemSettings({ openAtLogin: preferência })` sempre no boot — garante que o
   registro do SO fique sincronizado com o valor salvo mesmo se ficaram dessincronizados por algum
   motivo externo.

### AC-6 — `src/routes/settings.tsx` + item na Sidebar

Nova rota `/settings` (chave i18n `navSettings`), com uma seção "Inicialização automática": um toggle
(componente `Switch` do shadcn, já usado em `flashcard-manager-dialog.tsx`/outros) ligado a
`settings.get()`/`settings.setAutoStart()`, mais um parágrafo de texto explicando claramente o que a
opção faz (ex.: "Quando ativado, o Personare inicia automaticamente e minimizado na bandeja do sistema
ao ligar o computador, calculando e notificando suas revisões pendentes do dia. Você pode abrir o app a
qualquer momento pelo ícone na bandeja."). Adicionar `{ labelKey: "navSettings", to: "/settings" }` ao
array de itens de `app-sidebar.tsx` (mesmo padrão de `navCalendar`).

## Fora de escopo (não tocar)

- Notificação recorrente/periódica ao longo do dia enquanto o app roda oculto — a issue pede só o
  cálculo "ao iniciar oculto", um único check no boot, não um timer/polling contínuo.
- Clique na notificação abrindo uma tela específica (ex. Calendário) — a notificação nativa dispara,
  sem ação customizada ao clicar nela.
- Um toast/aviso na primeira vez que o usuário fecha a janela para o Tray explicando que o app continua
  rodando — não pedido, não implementar.
- Internacionalização do texto da notificação nativa (processo main não tem acesso ao `i18next` do
  renderer) — texto fixo em português é aceitável aqui.
- Ícone de marca real — o placeholder gerado em código (AC-2) é intencional e temporário.
- Qualquer mudança em `review.listDue`/`review.listSchedule`/`review-session-dialog.tsx` — `AC-3` é uma
  função nova e paralela, não uma alteração nessas procedures existentes.

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED para AC-1 a AC-6. Note que testes de processo main
   Electron (`Tray`, `Notification`, `app.setLoginItemSettings`, `app.whenReady`) não rodam bem em
   Vitest/jsdom da mesma forma que os testes de IPC/componente já existentes — para `src/main.ts` em
   si, escrever testes que verifiquem a **lógica extraível e pura** (ex. `countDueReviews` em
   `due-reviews.test.ts`, `createPlaceholderTrayIcon` retornando um `NativeImage` não-vazio em
   `tray-icon.test.ts`) e os testes de IPC normais para `settings` (`settings-ipc.test.ts`, seguindo o
   padrão de `review-ipc.test.ts`, incluindo mockar `electron`'s `app.setLoginItemSettings` já que
   testes de IPC não rodam dentro do Electron real). A lógica de orquestração dentro de `main.ts`
   propriamente dita (decidir criar janela vs. Tray, interceptar `close`) é mais difícil de testar
   isoladamente com este stack — não forçar um teste artificial para ela; documentar no PR que essa
   parte foi validada manualmente (rodando o app de verdade), não por teste automatizado. Confirmar RED
   pelo motivo certo nas partes que SÃO testáveis, commitar, não implementar produção.
2. **Desenvolvedor**: implementar o mínimo para fazer os testes passarem, sem editar nenhum teste, e
   **validar manualmente rodando o app empacotado de verdade** (não só a suíte automatizada) que: o
   toggle em Configurações liga/desliga o registro no SO, fechar a janela minimiza para o Tray em vez
   de fechar o app, e o menu do Tray consegue reabrir e encerrar o app corretamente.
3. **Revisor**: rodar a suíte completa, revisar o diff contra o spec, confirmar que `close` é
   interceptado (não `window-all-closed`), confirmar a flag `isQuitting`, confirmar que nenhuma
   notificação recorrente/timer foi introduzida, confirmar que `review.listDue`/`listSchedule` não
   foram tocados.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #20, documentando explicitamente
   a mudança de comportamento "fechar a janela agora minimiza para o Tray" (é uma mudança de UX visível
   a todo usuário, não só quem ativar o auto-start).
