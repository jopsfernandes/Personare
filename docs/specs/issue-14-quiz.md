# Spec — Issue #14: Atividade tipo Quiz

- **Issue:** [#14](https://github.com/jopsfernandes/Personare/issues/14) — "Atividade tipo Quiz"
- **Corpo da issue:** "Criação de Quiz com múltiplas perguntas (múltipla escolha no mínimo). Tela de
  execução do Quiz e tela de resultado ao final. Referência: Plan.md, Fase 1, item 11."
- **Branch:** `feature/14-atividade-quiz`
- **Sequência:** quarta de uma série sequencial não-paralela de issues de tipo de Atividade
  (#12 Link → #13 PDF → **#14 Quiz** → #15 Flashcard/Baralho), porque cada uma estende o schema de
  `activities`/tabelas relacionadas e migrations do drizzle-kit não podem colidir. **#15 (Flashcards)
  está fora de escopo** — não tocar em `flashcards`/`reviewItems`.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Estado herdado (RED phase já commitada)

Uma sessão anterior já rodou a etapa de Testador até a metade e parou por orçamento de tokens
(commit `acd26f6`, "WIP: Issue #14 RED tests (paused for token budget)"). **Não recomeçar do zero** —
os quatro arquivos de teste abaixo já existem na branch `feature/14-atividade-quiz` e definem, em
código executável, o contrato para a parte que já foi especificada:

- `src/tests/unit/quiz-schema.test.ts` — tabelas `quiz_questions` e `quiz_options`.
- `src/tests/unit/quiz-ipc.test.ts` — namespace oRPC `src/ipc/quiz` (CRUD de perguntas e opções).
- `src/tests/unit/quiz-scoring.test.ts` — `src/utils/quiz-scoring.ts` (`calculateQuizScore`).
- `src/tests/unit/quiz-question-form-dialog.test.tsx` — `src/components/quiz-question-form-dialog.tsx`.

Esses quatro arquivos **não devem ser reescritos** — são a fonte de verdade para essa fatia do
contrato. Leia-os antes de escrever qualquer teste novo ou código de produção.

### Contrato já definido pelos testes existentes (resumo, não substitui a leitura dos arquivos)

**Schema** (`src/database/schema.ts`, seguindo a convenção de `programs`/`modules`/`activities`: PK
UUID via `randomUUID()`, `created_at`/`updated_at` obrigatórios):

- `quizQuestions`: `id`, `activityId` (FK → `activities.id`), `text`, `createdAt`, `updatedAt`,
  `deletedAt` (nullable, soft-delete — testado explicitamente).
- `quizOptions`: `id`, `questionId` (FK → `quizQuestions.id`), `text`, `isCorrect` (boolean),
  `createdAt`, `updatedAt`. O teste **não** exige uma coluna `deletedAt` em `quiz_options` — a
  estratégia de remoção de opção fica em aberto (soft-delete com coluna própria, ou hard
  delete-and-recreate ao editar uma pergunta, são ambas aceitáveis) **desde que a decisão tomada seja
  registrada no PR**, e desde que `softDeleteOption` continue excluindo a opção de `listOptions`
  (isso sim é testado e obrigatório).
- Gerar a migration correspondente via `drizzle-kit generate` (será a `0004_*.sql`) — nunca editar
  `drizzle/meta/*` à mão.

**IPC** (`src/ipc/quiz/`, mesmo padrão de `src/ipc/activities/`): `listQuestions`, `createQuestion`,
`updateQuestion`, `softDeleteQuestion`, `listOptions`, `createOption`, `updateOption`,
`softDeleteOption`. Registrar em `src/ipc/router.ts` sob a chave `quiz`. `text` vazio é rejeitado
(Zod `.min(1)`) tanto em perguntas quanto em opções. `isCorrect` tem default `false` quando omitido.

**Scoring** (`src/utils/quiz-scoring.ts`): `calculateQuizScore(questions, answers)` — função pura,
sem I/O, sem dependência de banco/IPC. `answers` é um mapa `questionId -> optionId` escolhido pelo
usuário, mantido só em memória (V1 não persiste tentativas de Quiz no banco — Plan.md 1.2 confirma que
`quiz` não gera `ReviewItem` nem histórico persistido na V1). Pergunta sem resposta conta como errada,
sem lançar exceção. `optionId` que não pertence à pergunta é ignorado (conta como errada). Quiz sem
perguntas retorna `{ correct: 0, total: 0 }`.

**`QuizQuestionFormDialog`** (`src/components/quiz-question-form-dialog.tsx`): gerencia UMA pergunta e
suas alternativas por vez. Props: `{ question: QuizQuestionFormValue | null, open, onOpenChange,
onSubmit }`, onde `onSubmit(text: string, options: { text: string; isCorrect: boolean }[]) => void` —
repare que as opções emitidas para `onSubmit` **não carregam `id`**, mesmo ao editar uma pergunta
existente; isso é intencional e implica que quem chama este diálogo (o gerenciador de perguntas,
abaixo) é responsável por reconciliar essa lista com as opções que já existiam no banco. Nova pergunta
começa com ao menos 2 linhas de opção vazias. Validação client-side antes de chamar `onSubmit`: no
mínimo 2 opções com texto não-vazio e exatamente 1 marcada como correta (via `role="radio"`, não
Radix Select — ver comentário no próprio teste sobre `pointer-capture` não confiável em jsdom). Botão
de remover opção fica desabilitado quando restam só 2.

## O que falta especificar e implementar (continuação do Testador, depois do Desenvolvedor)

A issue pede três coisas que a RED phase herdada ainda não cobre: **múltiplas perguntas por Quiz**
(um gerenciador de perguntas, não só o form de uma pergunta isolada), a **tela de execução** e a
**tela de resultado**. Nenhum destes três pontos tem teste ainda — é o próximo passo do Testador.

### AC-1 — Gerenciador de perguntas do Quiz

Novo componente `src/components/quiz-question-manager-dialog.tsx`. Dado um `activity` (tipo
`"quiz"`), lista as perguntas existentes (texto + ações de editar/excluir por linha), com uma ação
"adicionar pergunta". Adicionar/editar abre `QuizQuestionFormDialog`. Excluir chama
`softDeleteQuestion`. Ao submeter o form:

- **Pergunta nova**: `createQuestion(activityId, text)` e então `createOption` para cada opção
  submetida.
- **Pergunta existente**: `updateQuestion(id, text)`, depois reconciliar as opções — dado que o form
  não devolve ids, a estratégia mais simples e já documentada como aceitável no teste de IPC é
  soft-deletar todas as opções que o gerenciador já tinha carregado para aquela pergunta e criar
  `createOption` para cada opção submetida (hard delete-and-recreate). Documente essa escolha no PR.

Para evitar N+1 manual no gerenciador, adicione em `src/actions/quiz.ts` uma função de composição
`listQuizQuestionsWithOptions(activityId)` que chama `listQuestions` e depois `listOptions` por
pergunta, retornando `{ id, text, options: { id, text, isCorrect }[] }[]`. Essa composição roda no
processo renderer (camada de actions), não dentro de um handler IPC — os handlers seguem 1:1 como os
de `activities`.

### AC-2 — Tela de execução + tela de resultado

Novo componente `src/components/quiz-runner-dialog.tsx`. Dado um `activity`, busca as perguntas com
opções (`listQuizQuestionsWithOptions`) e renderiza todas as perguntas com um grupo de radio buttons
nativos por pergunta (um `name` de grupo distinto por pergunta, para não colidir seleção entre
perguntas), permitindo escolher uma opção por pergunta. Um botão de finalizar calcula o placar via
`calculateQuizScore` e troca a view interna do diálogo para uma tela de resultado mostrando
"X de Y corretas" (chave i18n nova, com interpolação `{{correct}}`/`{{total}}`). Nada é persistido no
banco — o estado de resposta vive só em memória do componente, e se o diálogo for fechado e reaberto,
reinicia do zero (não é bug, é a V1 documentada em Plan.md 1.2).

### AC-3 — Integração na tabela de atividades e na rota

Em `src/components/activities-data-table.tsx`, seguindo o padrão condicional já usado para
`link`/`pdf` (botões `ExternalLink`/`FileText` visíveis só no tipo correspondente): adicionar dois
botões condicionais para `activity.type === "quiz"` — "gerenciar perguntas" (ícone `ListChecks` de
`lucide-react`) e "responder quiz" (ícone `Play`) — cada um chamando uma nova prop
(`onManageQuiz`/`onTakeQuiz`) obrigatória, mesmo padrão de `onEdit`/`onViewPdf`.

Em `src/routes/programs.$programId.modules.$moduleId.tsx`: dois novos estados locais
(`activityBeingManaged`, `activityTakingQuiz`) e handlers, montando `QuizQuestionManagerDialog` e
`QuizRunnerDialog` ao lado do `PdfViewerDialog` já existente — mesmo padrão de
`activityBeingViewed`/`handleViewPdf`/`handlePdfViewerOpenChange`. `activity-form-dialog.tsx` **não
precisa mudar** — o tipo `"quiz"` já está em `MVP_ACTIVITY_TYPES` desde o boilerplate de Link/PDF, e o
conteúdo do Quiz não é um campo da Activity, é uma entidade relacionada.

### Novas chaves i18n (adicionar em `src/localization/i18n.ts`, `en` e `pt-BR`)

Obrigatórias porque os testes RED já herdados já as referenciam (`i18n.t(...)`) e ainda não existem:
`quizQuestionTextLabel`, `quizOptionTextLabel`, `addQuizOptionAction`, `removeQuizOptionAction`.

Novas para AC-1/AC-2/AC-3 (nomes exatos ficam a critério de quem escrever os testes do gerenciador e
do executor, seguindo o padrão de nomenclatura já em uso — ex. `manageQuizQuestionsAction`,
`takeQuizAction`, `addQuizQuestionAction`, `editQuizQuestionAction`, `deleteQuizQuestionAction`,
`finishQuizAction`, uma chave de resultado com interpolação). Reaproveitar `cancelAction`/`saveAction`
onde o rótulo já existente serve, em vez de criar sinônimo.

## Fora de escopo (não tocar)

- Issue #15 (Flashcards/Baralho): tabelas `flashcards`/`reviewItems`, qualquer UI de baralho.
- Geração de `ReviewItem` a partir de Quiz — explicitamente adiado pelo Plan.md (seção 1.2) para
  versão futura, não é V1.
- Persistência de tentativas/histórico de resultado de Quiz no banco — V1 é só em memória.
- Qualquer mudança em `activity-form-dialog.tsx`, no fluxo de Link (`url`) ou PDF (`filePath`).

## Ordem do pipeline

1. **Testador** (continuação): ler os 4 arquivos RED existentes + este spec, escrever testes RED para
   AC-1, AC-2 e AC-3 (novos arquivos em `src/tests/unit/`), confirmar que falham pelo motivo certo
   (arquivo/export/chave i18n inexistente), commitar, **não implementar produção**.
2. **Desenvolvedor**: implementar o mínimo para fazer TODOS os testes de Quiz passarem — os 4 já
   herdados e os novos do Testador — sem editar nenhum teste.
3. **Revisor**: rodar a suíte completa (`npm run test:unit`), revisar o diff contra este spec,
   procurar por escopo além do pedido (especialmente vazamento para #15), arquivos esquecidos,
   estratégia de soft-delete de `quiz_options` documentada.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #14, descrevendo a feature
   entregue.
