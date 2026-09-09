# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Added

- **Calendário: visão de lista/mês das próximas revisões** ([#18](https://github.com/jopsfernandes/Personare/issues/18)).
  Adiciona uma página de Calendário acessível pela Sidebar, exibindo um evento por `ReviewItem` pendente (mostrando a frente do Flashcard), restrita a duas views (Mês e Agenda/Lista) e sem drag-and-drop, conforme pedido pela issue:
  - **Novo componente `EventCalendar` da ReUI** (`npx shadcn@latest add @reui/event-calendar`), instalado em `src/components/reui/event-calendar/*`, trazendo `date-fns`/`@date-fns/tz`/`@base-ui/react` como novas dependências. Usado com `views={["month", "agenda"]}` (restringindo o seletor às duas views pedidas) e `interactions={{ drag: false, resize: false, selectSlot: false }}` + `readOnly: true` em cada evento gerado — duas camadas de garantia contra edição, já que o componente vem com drag-and-drop habilitado por padrão.
  - **Extensão do namespace de IPC/oRPC `review`** (Issue #16), sem quebrar o contrato existente: `ensureReviewItems` ganhou `activityId` opcional — quando omitido, cobre todos os flashcards não deletados do app (não só os de uma Atividade), garantindo que Baralhos nunca revisados apareçam no calendário. Nova procedure `listSchedule` (sem input, sem o filtro `dueDate <= now()` que `listDue` tem, já que o calendário também mostra revisões futuras), com join até `modules`/`programs` para dar suporte à navegação, retornando `{ id, dueDate, front, activityId, activityTitle, moduleId, programId }` por linha. `listDue`/`submitRating`/`review-session-dialog.tsx` (Issue #16) permanecem intocados.
  - Novo `src/actions/calendar.ts`: wrapper para `listSchedule`/`ensureReviewItems({})` e a função pura `toCalendarEvents` mapeando as linhas para o formato `CalendarEvent` da ReUI.
  - `src/routes/calendar.tsx`: placeholder substituído pela composição do `EventCalendar`; cada evento é clicável (via `renderEvent`) e navega até o Módulo de origem da Atividade.
  - **Bug pré-existente descoberto durante o trabalho, registrado separadamente na Issue #64 (não corrigido nesta issue)**: um problema de precisão de timestamp que motivou ajuste em um teste de `listSchedule`, sem relação com a lógica de calendário em si.
  - **Bugfix nesta issue**: o primeiro GREEN usava `defaultEvents` (não-controlado, lido só na montagem) para alimentar o `EventCalendar`, mas o carregamento de dados da rota é assíncrono (`ensureReviewItems` → `listSchedule`), então o componente capturava o array vazio inicial e nunca mais olhava para os dados — o calendário sempre mostrava "sem eventos" apesar da busca funcionar. Corrigido trocando para o par controlado `events`/`onEventsChange`, conforme a própria documentação da ReUI recomenda quando a aplicação (aqui, o banco via `listSchedule`) é a fonte de verdade dos dados. Achado testando visualmente contra um build empacotado, não pelos testes unitários (que mockam o componente ReUI inteiro).
  - Cobertura de testes em `src/tests/unit/review-ipc.test.ts` (novos casos para `listSchedule` e `ensureReviewItems` sem `activityId`), `src/tests/unit/calendar-actions.test.ts` (novo) e `src/tests/unit/calendar-page.test.tsx` (novo). 340/340 testes passando, sem regressão.

- **Motor FSRS: sessão de revisão do Baralho** ([#16](https://github.com/jopsfernandes/Personare/issues/16)).
  Integra a biblioteca `ts-fsrs` ao `ReviewItem`, com uma tela de sessão de revisão que itera pelos cartões pendentes de um Baralho, captura o rating do usuário (again/hard/good/easy) e atualiza `stability`/`difficulty`/`due_date` via o algoritmo FSRS:
  - **Mudança de schema**: `review_items` estendida com os campos que o `Card` do `ts-fsrs` precisa para reagendar corretamente além do que já existia (`difficulty`/`stability`/`due_date`/`last_rating`/`rating_history`) — `state` (texto, default `"New"`), `reps`/`lapses`/`scheduled_days`/`learning_steps` (inteiro, default `0`) e `last_reviewed_at` (timestamp nullable). `elapsed_days` do `Card` é intencionalmente nunca persistido (marcado `@deprecated` na própria lib, será removido na v6). Migration `drizzle/0005_violet_puff_adder.sql`.
  - Novo módulo puro `src/utils/fsrs.ts`, sem I/O: `createInitialReviewItemFields` (estado inicial via `createEmptyCard()`), `toFsrsCard`/`fromFsrsCard` (ponte entre a linha persistida e o tipo `Card` da biblioteca) e `applyRating` (chama `fsrs().next(...)` com parâmetros default, sem customização de `request_retention`/`learning_steps`).
  - **Novo namespace de IPC/oRPC `review`** (`src/ipc/review/`), registrado em `src/ipc/router.ts`: `ensureReviewItems({ activityId })` (criação preguiçosa e idempotente de um `review_items` por flashcard ainda sem um, via `LEFT JOIN` + `WHERE IS NULL`), `listDue({ activityId })` (cartões com `due_date <= now()`, já com `front`/`back` do flashcard via join, evitando N+1 na UI) e `submitRating({ reviewItemId, rating })` (valida o rating por Zod enum excluindo `"manual"`, aplica via `utils/fsrs.ts` e acrescenta ao `rating_history` em JSON). Consumido pelo renderer via `src/actions/review.ts`.
  - Novo componente `src/components/review-session-dialog.tsx`: ao abrir, chama `ensureReviewItems` e depois `listDue` para montar a fila em memória; por cartão, revela frente → verso e os 4 botões de rating; ao avaliar, a fila local avança sem reconsultar `listDue`, mostrando mensagens de "nada para revisar agora" ou "sessão concluída" quando aplicável.
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: novo botão condicional "iniciar revisão" (ícone `Repeat`, distinto do `Layers` de "gerenciar flashcards" e do `Play` de "responder quiz") para Atividades do tipo `flashcard_deck`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para a ação de iniciar revisão, revelar resposta, os 4 ratings e as mensagens de fila vazia/sessão concluída.
  - **Fora de escopo, explicitamente não tocado**: `flashcard-form-dialog.tsx`/`flashcard-manager-dialog.tsx` (Issue #15) e o fluxo de criação de Flashcard — a criação de `review_items` é preguiçosa, não acontece na criação do Flashcard; nenhum parâmetro customizado de FSRS, preview de múltiplos outcomes ou UI de estatísticas de progresso; Calendário (Issue #18) e notificação do SO (Issue #20), mesmo usando `due_date` como dado que eventualmente alimentará essas telas.
  - Cobertura de testes em `src/tests/unit/fsrs-utils.test.ts`, `src/tests/unit/review-ipc.test.ts`, `src/tests/unit/review-session-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 320/320 testes passando, sem regressão.

- **Atividade do tipo Flashcard/Baralho: CRUD de Flashcards** ([#15](https://github.com/jopsfernandes/Personare/issues/15)).
  Adiciona CRUD de Flashcards (frente/verso) dentro de uma Atividade do tipo `flashcard_deck` (Baralho):
  - **Nenhuma migration nova**: as tabelas `flashcards` e `review_items` já existiam desde `drizzle/0001_chilly_zombie.sql` (schema fundacional); esta issue só implementa o CRUD sobre a tabela `flashcards` já existente.
  - **Novo namespace de IPC/oRPC `flashcards`** (`src/ipc/flashcards/`), espelhando `ipc/activities` (entidade flat, sem sub-entidade): `list({ activityId })`/`create({ activityId, front, back })`/`update({ id, front, back })`/`softDelete({ id })`, registrado em `src/ipc/router.ts`. `front`/`back` rejeitam string vazia (Zod `.min(1)`). Consumido pelo renderer via `src/actions/flashcards.ts` (wrappers finos, sem camada de composição — Flashcard não tem sub-entidade como as opções do Quiz).
  - Novo componente `src/components/flashcard-form-dialog.tsx`: cria/edita UM flashcard por vez (campos `front`/`back`, validação HTML nativa `required`).
  - Novo componente `src/components/flashcard-manager-dialog.tsx`: gerenciador de todos os flashcards de um Baralho, mostrando frente e verso de cada linha (tela de autoria, não a tela de revisão) — listar, adicionar, editar, excluir (soft-delete).
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: novo botão condicional "gerenciar flashcards" (ícone `Layers`) para Atividades do tipo `flashcard_deck`, seguindo o mesmo padrão condicional de `link`/`pdf`/`quiz`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para o gerenciador e o formulário de flashcard, reaproveitando `saveAction`/`cancelAction` já existentes.
  - **Fora de escopo, explicitamente não tocado**: qualquer leitura/escrita em `review_items`, integração com `ts-fsrs` e a tela de sessão de revisão — tudo isso pertence à Issue #16 (Motor FSRS), que depende desta issue estar concluída. Um Flashcard criado por esta feature fica sem `ReviewItem` associado até a Issue #16 existir.
  - Cobertura de testes em `src/tests/unit/flashcards-ipc.test.ts`, `src/tests/unit/flashcard-form-dialog.test.tsx`, `src/tests/unit/flashcard-manager-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 272/272 testes passando, sem regressão.

- **Atividade do tipo Quiz: perguntas de múltipla escolha, execução e resultado** ([#14](https://github.com/jopsfernandes/Personare/issues/14)).
  Adiciona suporte a Quiz com múltiplas perguntas de múltipla escolha por Atividade, usado quando `type = 'quiz'`:
  - **Mudança de schema**: novas tabelas `quiz_questions` (`id`, `activity_id` FK, `text`, `created_at`/`updated_at`, `deleted_at` para soft-delete) e `quiz_options` (`id`, `question_id` FK, `text`, `is_correct`, `created_at`/`updated_at`, `deleted_at` — cada opção tem soft-delete próprio, mesmo padrão do resto do app) em `src/database/schema.ts`, aplicadas via `drizzle/0004_overconfident_whiplash.sql`.
  - **Novo namespace de IPC/oRPC `quiz`** (`src/ipc/quiz/`), espelhando `ipc/activities`: `listQuestions`/`createQuestion`/`updateQuestion`/`softDeleteQuestion` e `listOptions`/`createOption`/`updateOption`/`softDeleteOption`, registrado em `src/ipc/router.ts`. Consumido pelo renderer via `src/actions/quiz.ts`, que também expõe `listQuizQuestionsWithOptions(activityId)` — composição no processo renderer que evita N+1 dentro de um handler.
  - `src/utils/quiz-scoring.ts`: função pura `calculateQuizScore(questions, answers)`, sem I/O; pergunta sem resposta conta como errada, sem lançar exceção.
  - Novo componente `src/components/quiz-question-form-dialog.tsx`: cria/edita uma pergunta e suas alternativas, com validação client-side (mínimo 2 opções com texto, exatamente 1 correta).
  - Novo componente `src/components/quiz-question-manager-dialog.tsx`: gerenciador de todas as perguntas de um Quiz (listar, adicionar, editar, excluir). Ao editar uma pergunta, as opções são reconciliadas via soft-delete-and-recreate (o form não devolve `id` das opções existentes).
  - Novo componente `src/components/quiz-runner-dialog.tsx`: tela de execução do Quiz (radio buttons por pergunta) e tela de resultado ao final ("X de Y corretas"). Estado de resposta vive só em memória do componente — a V1 não persiste tentativas de Quiz no banco (Plan.md 1.2), reiniciando do zero se o diálogo for fechado e reaberto.
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: dois novos botões condicionais para Atividades do tipo `quiz` — "gerenciar perguntas" (`ListChecks`) e "responder quiz" (`Play`) — seguindo o mesmo padrão condicional já usado para `link`/`pdf`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para os formulários de pergunta/opção, ações do gerenciador e executor, e o resultado do Quiz (interpolação `{{correct}}`/`{{total}}`).
  - Fora de escopo desta issue e não alterados: Issue #15 (Flashcards/Baralho), geração de `ReviewItem` a partir de Quiz e persistência de tentativas/histórico de resultado no banco — todos explicitamente adiados pelo Plan.md para versão futura.
  - Cobertura de testes em `src/tests/unit/quiz-schema.test.ts`, `src/tests/unit/quiz-ipc.test.ts`, `src/tests/unit/quiz-scoring.test.ts`, `src/tests/unit/quiz-question-form-dialog.test.tsx`, `src/tests/unit/quiz-actions.test.ts`, `src/tests/unit/quiz-question-manager-dialog.test.tsx`, `src/tests/unit/quiz-runner-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 241/241 testes passando, sem regressão.

- **Atividade do tipo PDF: seleção e visualização de arquivo** ([#13](https://github.com/jopsfernandes/Personare/issues/13)).
  Adiciona suporte a um arquivo PDF associado à Atividade, usado quando `type = 'pdf'`:
  - **Mudança de schema**: nova coluna `activities.file_path` (`text`, nullable) em `src/database/schema.ts`, aplicada via `drizzle/0003_past_crusher_hogan.sql` (`ALTER TABLE activities ADD file_path text`, sem `NOT NULL`), seguindo o mesmo padrão de coluna opcional por tipo da Issue #12 (`url`).
  - **Novo namespace de IPC/oRPC `dialog`** (`src/ipc/dialog/`), expondo a procedure `selectPdfFile`, registrada em `src/ipc/router.ts`. No processo main, usa `dialog.showOpenDialog` do Electron filtrado para extensão `.pdf` (`properties: ["openFile"]`), retornando o caminho do arquivo escolhido ou `null` se o usuário cancelar. Consumida pelo renderer via `src/actions/dialog.ts`. **Nota para a Issue #14**: este é o primeiro namespace de IPC que não é um CRUD sobre uma tabela — expõe uma capability do processo main (file dialog nativo do SO), sem schema de validação de payload próprio.
  - IPC de `activities` (`src/ipc/activities/schemas.ts` e `handlers.ts`) atualizado para aceitar e retornar `filePath` em `create`/`update`/`list`, consumido pelo renderer via `src/actions/activities.ts`.
  - `src/components/activity-form-dialog.tsx`: novo botão de seleção de arquivo, exibido apenas quando o tipo selecionado é `pdf`, que aciona `selectPdfFile` e exibe o caminho escolhido; o valor só é enviado ao submit quando o tipo é `pdf`, caso contrário `null`.
  - Novo componente `src/components/pdf-viewer-dialog.tsx`: dialog com um `iframe` (`src="file://<filePath>"`) para visualizar o PDF embutido na própria aplicação.
  - `src/components/activities-data-table.tsx`: nova ação "visualizar" (ícone `FileText`) na linha da Data Table, visível apenas para Atividades do tipo `pdf`, que abre o `PdfViewerDialog`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para o botão de seleção de arquivo, o título do iframe do visualizador e a ação "visualizar".
  - Cobertura de testes em `src/tests/unit/schema.test.ts`, `src/tests/unit/activities-ipc.test.ts`, `src/tests/unit/activity-form-dialog.test.tsx`, `src/tests/unit/activities-data-table.test.tsx`, `src/tests/unit/dialog-ipc.test.ts` (novo) e `src/tests/unit/pdf-viewer-dialog.test.tsx` (novo). 163/163 testes passando, sem regressão.

- **Atividade do tipo Link: campo de URL** ([#12](https://github.com/jopsfernandes/Personare/issues/12)).
  Adiciona suporte a uma URL associada à Atividade, usada quando `type = 'link'`:
  - **Mudança de schema**: nova coluna `activities.url` (`text`, nullable) em `src/database/schema.ts`, aplicada via `drizzle/0002_peaceful_apocalypse.sql` (`ALTER TABLE activities ADD url text`, sem `NOT NULL`). Esta é a primeira alteração no schema de `activities` desde a Issue #10, e a Issue #13 (Atividade tipo PDF) depende de partir deste schema já migrado.
  - IPC de `activities` (`src/ipc/activities/schemas.ts` e `handlers.ts`) atualizado para aceitar e retornar `url` em `create`/`update`/`list`, consumido pelo renderer via `src/actions/activities.ts`.
  - `src/components/activity-form-dialog.tsx`: novo campo de URL (`type="url"`) exibido apenas quando o tipo selecionado é `link`; o valor só é enviado ao submit quando o tipo é `link`, caso contrário `null`.
  - `src/components/activities-data-table.tsx`: nova ação "abrir URL" (ícone `ExternalLink`) na linha da Data Table, visível apenas para Atividades do tipo `link`, usando `openExternalLink` (`src/actions/shell.ts`) para abrir a URL no navegador padrão do sistema.
  - `src/localization/i18n.ts`: nova chave de tradução (en e pt-BR) para o label do campo de URL e para a ação de abrir URL.
  - Cobertura de testes em `src/tests/unit/schema.test.ts`, `src/tests/unit/activities-ipc.test.ts`, `src/tests/unit/activity-form-dialog.test.tsx` (novo) e `src/tests/unit/activities-data-table.test.tsx`. 140/140 testes passando, sem regressão.

- **CRUD de Atividade dentro de Módulo** ([#10](https://github.com/jopsfernandes/Personare/issues/10)).
  Adiciona a Data Table de Atividades à rota de um Módulo, com criação, edição e exclusão (soft-delete), espelhando o padrão dos CRUDs de Programa (Issue #8) e Módulo (Issue #9):
  - `src/routes/programs.$programId.modules.$moduleId.tsx`: placeholder substituído pela Data Table de Atividades (`src/components/activities-data-table.tsx`) do Módulo da rota atual, listando apenas as atividades não deletadas daquele Módulo.
  - `src/components/activities-data-table.tsx`: exibe cada Atividade com um `Badge` (novo componente shadcn/ui `src/components/ui/badge.tsx`) trazendo o rótulo traduzido do seu `type`.
  - `src/components/activity-form-dialog.tsx`: dialog de criar/editar Atividade (título e tipo obrigatórios; tipo escolhido via `Select`, novo componente shadcn/ui `src/components/ui/select.tsx`).
  - `src/components/delete-activity-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - Novo namespace de IPC/oRPC `activities` (`src/ipc/activities/`), expondo `list` (filtrado por `moduleId`)/`create`/`update`/`softDelete`, registrado em `src/ipc/router.ts` e consumido pelo renderer via `src/actions/activities.ts`.
  - `activities.type` permanece uma coluna de texto aberta (`z.string().min(1)`, sem enum fechado), conforme definido na Issue #4: o formulário e o `Badge` cobrem os tipos do MVP (`link`, `quiz`, `pdf`, `flashcard_deck`), mas a API aceita outros valores de tipo.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para título da página, botões, labels do formulário, rótulos de tipo e confirmação de exclusão, sem texto hardcoded; placeholder `activitiesPlaceholder` removido.
  - Cobertura de testes em `src/tests/unit/activities-ipc.test.ts` (handlers de IPC, incluindo filtro por `moduleId`, que `softDelete` não aparece em `list` e aceitação de um tipo fora do MVP) e `src/tests/unit/activities-data-table.test.tsx` (renderização da Data Table, Badge de tipo e ações).
  - Fora de escopo desta issue e não alterados: Sidebar (`src/components/app-sidebar.tsx`), CRUDs de Programa e Módulo (`src/ipc/programs/`, `src/ipc/modules/`) e schema do banco.

- **CRUD de Módulo dentro de Programa** ([#9](https://github.com/jopsfernandes/Personare/issues/9)).
  Adiciona a Data Table de Módulos à rota de um Programa, com criação, edição e exclusão (soft-delete), espelhando o padrão do CRUD de Programa (Issue #8):
  - `src/routes/programs.$programId.tsx`: placeholder substituído pela Data Table de Módulos (`src/components/modules-data-table.tsx`) do Programa da rota atual, listando apenas os módulos não deletados daquele Programa.
  - `src/components/module-form-dialog.tsx`: dialog de criar/editar Módulo (nome obrigatório, associado ao `programId` da rota).
  - `src/components/delete-module-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - `src/routes/programs.$programId.modules.$moduleId.tsx`: nova rota placeholder de Atividades do Módulo, para onde cada linha da tabela navega (conteúdo real fica para a Issue #10).
  - Novo namespace de IPC/oRPC `modules` (`src/ipc/modules/`), expondo `list` (filtrado por `programId`)/`create`/`update`/`softDelete`, registrado em `src/ipc/router.ts` e consumido pelo renderer via `src/actions/modules.ts`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para títulos, botões, labels do formulário e confirmação de exclusão, sem texto hardcoded.
  - Cobertura de testes em `src/tests/unit/modules-ipc.test.ts` (handlers de IPC, incluindo filtro por `programId` e que `softDelete` não aparece em `list`) e `src/tests/unit/modules-data-table.test.tsx` (renderização da Data Table e ações).
  - Fora de escopo desta issue e não alterados: Sidebar (`src/components/app-sidebar.tsx`), CRUD de Programa (`src/ipc/programs/`, `src/routes/index.tsx`) e schema do banco.

- **CRUD de Programa** ([#8](https://github.com/jopsfernandes/Personare/issues/8)).
  Adiciona a Data Table de Programas à tela inicial do dashboard, com criação, edição e exclusão (soft-delete):
  - `src/routes/index.tsx`: rota inicial substituída pela Data Table de Programas (`src/components/programs-data-table.tsx`), listando apenas os programas não deletados.
  - `src/components/program-form-dialog.tsx`: dialog de criar/editar Programa (nome obrigatório).
  - `src/components/delete-program-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - `src/routes/programs.$programId.tsx`: nova rota placeholder de Módulos do Programa, para onde cada linha da tabela navega (conteúdo real fica para a Issue #9).
  - Novo namespace de IPC/oRPC `programs` (`src/ipc/programs/`), expondo `list`/`create`/`update`/`softDelete`, consumido pelo renderer via `src/actions/programs.ts`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para títulos, botões, labels do formulário e confirmação de exclusão, sem texto hardcoded.
  - Cobertura de testes em `src/tests/unit/programs-ipc.test.ts` (handlers de IPC, incluindo que `softDelete` não aparece em `list`) e `src/tests/unit/programs-data-table.test.tsx` (renderização da Data Table e ações).

- **Sidebar de navegação** ([#17](https://github.com/jopsfernandes/Personare/issues/17)).
  Adiciona a Sidebar principal da aplicação, usando o bloco oficial `sidebar` do shadcn/ui:
  - `src/components/app-sidebar.tsx`: novo componente com os itens de navegação "Programas" (rota `/`) e "Calendário" (nova rota placeholder `src/routes/calendar.tsx`, cujo conteúdo real fica para a Issue #18).
  - `src/layouts/base-layout.tsx`: layout raiz atualizado para envolver o conteúdo com `SidebarProvider` e renderizar a nova Sidebar (incluindo `SidebarTrigger` para colapsar/expandir) em todas as rotas.
  - Novos componentes shadcn/ui de suporte instalados via CLI: `sidebar`, `sheet`, `tooltip`, `separator`, `skeleton`, `input`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para os itens do menu, sem texto hardcoded na Sidebar.
  - Indicador de rota ativa via `aria-current`/`isActive`, seguindo o padrão do bloco shadcn.
  - Cobertura de testes em `src/tests/unit/app-sidebar.test.tsx` e `src/tests/unit/base-layout.test.tsx`.

- **Schema inicial do banco de dados** ([#4](https://github.com/jopsfernandes/Personare/issues/4)).
  Modelagem das tabelas de domínio via Drizzle ORM (SQLite) em `src/database/schema.ts`, substituindo o placeholder `health_check` da Issue #2 como fonte de verdade do schema:
  - `programs` (Programa), `modules` (Módulo), `activities` (Atividade) e `flashcards` (Flashcard), formando a hierarquia Programa → Módulo → Atividade → Flashcard. Baralho não tem tabela própria: é uma `activities` com `type = 'flashcard_deck'`.
  - `activities.type` é uma coluna de texto aberta (discriminador validado pela aplicação), não um enum fechado/CHECK constraint do SQLite, permitindo adicionar novos tipos de Atividade (além de `link`, `quiz`, `pdf`, `flashcard_deck`) sem migration destrutiva.
  - `review_items` (ReviewItem) como entidade de primeira classe agendada pelo FSRS, desacoplada estruturalmente da hierarquia de conteúdo: referencia apenas o `flashcard_id` que a agenda, mantendo `stability`, `difficulty`, `due_date` e histórico de ratings (`last_rating`/`rating_history`) mesmo que o Flashcard associado seja editado.
  - Todas as tabelas de negócio usam UUID (gerado pela aplicação) como chave primária e têm `created_at`/`updated_at`; `programs`, `modules`, `activities` e `flashcards` têm soft-delete via `deleted_at` nullable.
  - Nova migration `drizzle/0001_chilly_zombie.sql` gerada via drizzle-kit, aplicada pelo `runMigrations` já existente de `src/database/migrate.ts`.
  - Cobertura de testes em `src/tests/unit/schema.test.ts`: inserção básica em cada tabela, relacionamentos (FK), soft-delete e aplicação da migration contra um banco de teste temporário.

- **Integração de banco de dados local com SQLite + Drizzle** ([#2](https://github.com/jopsfernandes/Personare/issues/2)).
  Adiciona persistência local ao app via `better-sqlite3` e `drizzle-orm`/`drizzle-kit`:
  - `src/database/client.ts`: client de conexão SQLite criado no processo main.
  - `src/database/migrate.ts`: execução automática das migrations no startup, com suporte a build empacotado via `process.resourcesPath` (e `extraResource: ["./drizzle"]` em `forge.config.ts`).
  - `drizzle/0000_init.sql`: primeira migration, vazia.
  - Novo namespace de IPC/oRPC `database` (`src/ipc/database/`), expondo `getDatabaseStatus` ao renderer.
- **Dependência `ts-fsrs` e teste de corretude do algoritmo FSRS** ([#3](https://github.com/jopsfernandes/Personare/issues/3)).
  Adicionada a biblioteca `ts-fsrs` (`^5.4.2`) como dependência do projeto, base para o agendamento de repetição espaçada (FSRS) previsto na Fase 1.
  - Novo teste de regressão `src/tests/unit/fsrs-correctness.test.ts`, validando `stability`, `difficulty` e os intervalos (`scheduled_days`) calculados pelo algoritmo FSRS-6 (pesos padrão da biblioteca) contra sequências de ratings (`again`/`hard`/`good`/`easy`).
  - Os valores de referência usados no teste são copiados literalmente da suíte de testes oficial do `ts-fsrs` (`FSRS-6.test.ts`, upstream `open-spaced-repetition/ts-fsrs`), garantindo que nossa integração se comporte de forma idêntica à implementação de referência.

### Changed

- **Rebranding do boilerplate `electron-shadcn` para Personare** ([#1](https://github.com/jopsfernandes/Personare/issues/1)).
  Removidas todas as referências ao boilerplate original (`electron-shadcn`) e ao autor original (`LuanRoger`), substituídas pela identidade do projeto Personare:
  - `README.md`: textos e links atualizados para o Personare.
  - `package.json`: campo `author` alterado para `Personare <contato@devfernandes.com>`.
  - `forge.config.ts`: publisher do Electron Forge (GitHub) atualizado para `owner: jopsfernandes`, `name: Personare`.
  - `src/main.ts`: configuração do `update-electron-app` atualizada para o novo repositório.
  - `src/localization/i18n.ts`: `appName` alterado para `Personare` e `madeBy` para `Made by Personare` / `Feito por Personare` (en e pt-BR).
  - `index.html`, `src/components/navigation-menu.tsx`, `src/layouts/base-layout.tsx`, `src/routes/index.tsx`: referências de UI/título atualizadas.
  - `src/tests/e2e/example.test.ts`: teste de título de janela atualizado para o novo nome do app.
  - Cobertura de testes adicionada (`src/tests/unit/branding-config.test.ts`, `src/tests/unit/branding-i18n.test.ts`, `src/tests/unit/no-legacy-branding.test.ts`) garantindo que nenhuma ocorrência de `electron-shadcn` ou `LuanRoger` permaneça no código-fonte.
