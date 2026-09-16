# Spec — Issue #96: Markdown, LaTeX e anexo de imagem em flashcards e quizzes

- **Issue:** [#96](https://github.com/jopsfernandes/Personare/issues/96) — "Markdown, LaTeX e anexo de
  imagem em flashcards e quizzes"
- **Corpo da issue:** suportar Markdown e fórmulas em LaTeX (renderizadas como matemática) no conteúdo
  de flashcards e quizzes, e permitir anexar uma imagem opcional — no flashcard, e no quiz tanto no
  cabeçalho (pergunta) quanto em cada resposta (opção) — sem que a imagem apareça inline (um botão abre
  a imagem numa janela, para não quebrar o layout).
- **Branch:** `feature/96-markdown-latex-imagens`
- **Sequência:** independente das issues de tipo de Atividade (#12-#15) e da #93/#95 (resultado do quiz)
  — só toca as telas de autoria e exibição de conteúdo de flashcard/quiz que essas issues já entregaram.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Estado herdado

`flashcards.front`/`back`, `quiz_questions.text` e `quiz_options.text` (`src/database/schema.ts`) são
colunas `text` simples. Os formulários (`flashcard-form-dialog.tsx`, `quiz-question-form-dialog.tsx`)
usam `<Input>` de uma linha com `useState` puro (sem `react-hook-form`). A exibição
(`flashcard-manager-dialog.tsx`, `quiz-question-manager-dialog.tsx`, `quiz-runner-dialog.tsx`,
`review-session-dialog.tsx`) interpola esse texto cru (`{flashcard.front}`, `{currentQuestion.text}`,
`{option.text}`, etc.). Nenhuma lib de Markdown/LaTeX (`react-markdown`, `remark-math`, `rehype-katex`,
`katex`) ou editor (`tiptap`, `react-hook-form`) existe no `package.json`. Não existem
`src/components/ui/textarea.tsx` nem `tabs.tsx`. Não existe nenhum mecanismo de upload/anexo de
arquivo — o precedente mais próximo é `activities.filePath`, que guarda o caminho absoluto que o
usuário escolheu via `dialog.showOpenDialog` (`src/ipc/dialog/handlers.ts`, `selectPdfFile`), sem
copiar o arquivo para lugar nenhum.

**Decisão de produto já tomada** (não é aberta a debate nesta spec): conteúdo é armazenado como
**Markdown puro** (a mesma coluna `text` que já existe); LaTeX usa os delimitadores padrão do KaTeX
(`$...$` inline, `$$...$$` bloco) dentro desse Markdown. Imagens são **copiadas** para
`app.getPath("userData")/attachments/`, e cada tabela ganha uma coluna nullable com o **nome do
arquivo** copiado (nunca o caminho original do usuário).

## O que implementar

### AC-1 — `MarkdownContent` e `MarkdownEditor`

Adicionar dependências: `react-markdown`, `remark-math`, `rehype-katex`, `katex`. Adicionar os
primitivos shadcn `textarea` e `tabs` em `src/components/ui/`.

- **`src/components/markdown-content.tsx`**: componente somente-leitura, `{ content: string; className?:
  string }`. Renderiza `content` via `<ReactMarkdown remarkPlugins={[remarkMath]}
  rehypePlugins={[rehypeKatex]}>`; importa `katex/dist/katex.min.css`. Fórmulas entre `$...$`/`$$...$$`
  saem como markup do KaTeX (elemento com classe `katex`), não como texto cru com os `$` literais.
- **`src/components/markdown-editor.tsx`**: campo de formulário controlado, `{ id: string; label:
  string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }`.
  Usa `Tabs` com duas abas — "Escrever" (um `Textarea` ligado a `value`/`onChange`) e "Pré-visualizar"
  (`<MarkdownContent content={value} />`) — mais uma dica de texto fixa sobre a sintaxe LaTeX suportada.

Testes: `src/tests/unit/markdown-content.test.tsx` (Markdown básico e uma fórmula LaTeX geram o markup
esperado) e `src/tests/unit/markdown-editor.test.tsx` (alternar aba, digitar no Textarea dispara
`onChange`, a aba de pré-visualização reflete `value` atual).

### AC-2 — Anexo de imagem: schema, migration e IPC

Adicionar ao `src/database/schema.ts` (nullable, mesmo padrão de `activities.filePath`):
`flashcards.frontImagePath`, `flashcards.backImagePath`, `quizQuestions.imagePath`,
`quizOptions.imagePath`. Gerar a migration com `npx drizzle-kit generate` (deve ser um `ALTER TABLE ...
ADD COLUMN` simples) e rodar `npx ultracite fix` no `drizzle/meta/*.json` gerado antes de commitar.

Novo domínio `src/ipc/attachments/` (`schemas.ts`, `handlers.ts`, `index.ts`), registrado em
`src/ipc/router.ts` sob a chave `attachments`, mesmo formato de `src/ipc/flashcards/`:

- `saveImage({ sourcePath })`: copia `sourcePath` para um novo arquivo
  `app.getPath("userData")/attachments/<randomUUID()><extensão original>`; retorna `{ fileName }`.
- `getImageDataUrl({ fileName })`: lê o arquivo daquela pasta e retorna um data URL base64 (a renderer
  não tem acesso a `fs`).
- `deleteImage({ fileName })`: remove o arquivo.

Adicionar `selectImageFile` em `src/ipc/dialog/handlers.ts` (mesmo padrão de `selectPdfFile`, filtro de
extensões `png`/`jpg`/`jpeg`/`gif`/`webp`), expor em `dialog/index.ts`. Novo
`src/actions/attachments.ts` (`saveAttachmentImage`, `getAttachmentImageDataUrl`,
`deleteAttachmentImage`) espelhando `src/actions/flashcards.ts`; adicionar `selectImageFile` a
`src/actions/dialog.ts`.

Teste: `src/tests/unit/attachments-ipc.test.ts`, com `app.getPath("userData")` apontando para um
diretório temporário do teste.

### AC-3 — `ImageAttachmentField` e `ImageAttachmentViewer`

- **`src/components/image-attachment-field.tsx`**: usado dentro dos formulários de edição. Props: `{
  fileName: string | null; onChange: (fileName: string | null) => void; label: string }`. Botão
  "Anexar imagem" chama `selectImageFile()`; se um caminho voltar, chama `saveAttachmentImage(path)` e
  propaga o `fileName` resultante via `onChange`. Se já houver um `fileName`, mostra um indicador de
  "imagem anexada" com um botão "Remover" que chama `deleteAttachmentImage(fileName)` e
  `onChange(null)`.
- **`src/components/image-attachment-viewer.tsx`**: usado nos locais somente-leitura. Props: `{
  fileName: string | null }`. Se `fileName` for `null`, não renderiza nada. Senão, um botão "Ver
  imagem" que, só ao ser clicado, busca `getAttachmentImageDataUrl(fileName)` e abre a imagem dentro de
  um `Dialog` (`src/components/ui/dialog.tsx`). A imagem nunca aparece inline na lista/tela — só dentro
  do dialog, atrás do clique — para não quebrar o layout.

Testes: `src/tests/unit/image-attachment-field.test.tsx` e
`src/tests/unit/image-attachment-viewer.test.tsx`.

### AC-4 — Flashcards usam Markdown/LaTeX/imagem

- `FlashcardFormValue` ganha `frontImagePath: string | null` e `backImagePath: string | null`. A
  assinatura de `onSubmit` em `flashcard-form-dialog.tsx` passa de posicional
  (`front, back`) para um objeto único: `onSubmit(values: { front: string; back: string; frontImagePath:
  string | null; backImagePath: string | null }) => void` — os dois `<Input>` de frente/verso viram
  `<MarkdownEditor>`, cada um acompanhado de um `<ImageAttachmentField>`.
- `flashcard-manager-dialog.tsx`: cada linha troca `<span>{flashcard.front}</span>` /
  `<span>{flashcard.back}</span>` por `<MarkdownContent content={flashcard.front} />` (idem para back),
  cada um seguido de `<ImageAttachmentViewer fileName={flashcard.frontImagePath} />` (idem back).
  `handleFormSubmit` repassa os novos campos para `createFlashcard`/`updateFlashcard`.
- `src/actions/flashcards.ts` e `src/ipc/flashcards/{schemas,handlers}.ts`: `create`/`update` aceitam e
  persistem `frontImagePath`/`backImagePath` (nullable, default `null`).
- `review-session-dialog.tsx`: `<p>{currentItem.front}</p>` / `<p>{currentItem.back}</p>` viram
  `<MarkdownContent content={currentItem.front} />` / `back`, cada um com seu
  `<ImageAttachmentViewer>`.

### AC-5 — Quiz usa Markdown/LaTeX/imagem (pergunta e cada opção)

- `QuizQuestionFormValue` e as opções ganham `imagePath: string | null`. O `<Input>` da pergunta e o de
  cada opção em `quiz-question-form-dialog.tsx` viram `<MarkdownEditor>`; cada um ganha um
  `<ImageAttachmentField>` (na pergunta e em cada linha de opção). `onSubmit` passa a incluir
  `imagePath` da pergunta e de cada opção.
- `quiz-question-manager-dialog.tsx`: linha da lista troca o texto cru da pergunta por
  `<MarkdownContent>` + `<ImageAttachmentViewer>`.
- `src/actions/quiz.ts` e `src/ipc/quiz/{schemas,handlers}.ts`: `createQuestion`/`updateQuestion`
  aceitam/persistem `imagePath` da pergunta; `createOption`/`updateOption` aceitam/persistem
  `imagePath` da opção.
- `quiz-runner-dialog.tsx`: `<QuestionnaireTitle>{currentQuestion.text}</QuestionnaireTitle>` vira
  `<QuestionnaireTitle><MarkdownContent content={currentQuestion.text} /></QuestionnaireTitle>` mais um
  `<ImageAttachmentViewer>` para a pergunta; `{option.text}` dentro de `<QuestionnaireChoice>` e
  `{entry.text}` na lista de revisão recebem o mesmo tratamento (`MarkdownContent` +
  `ImageAttachmentViewer` para a imagem daquela opção).

### Novas chaves i18n (adicionar em `src/localization/i18n.ts`, `en` e `pt-BR`)

`attachImageAction`, `removeImageAction`, `viewImageAction`, `imageAttachedLabel`,
`markdownWriteTabLabel`, `markdownPreviewTabLabel`, `markdownLatexHintMessage`. Reaproveitar
`saveAction`/`cancelAction` e os labels de flashcard/quiz já existentes onde servirem.

## Fora de escopo (não tocar)

- Sincronizar os arquivos de `userData/attachments` no backup local (#21) ou no backup do Google Drive
  (#27) — o anexo fica só localmente por enquanto; portar isso é trabalho de uma issue futura.
- Apagar arquivos de `userData/attachments` quando o flashcard/pergunta/opção dona é soft-deletada —
  soft-delete continua só marcando `deletedAt`; limpeza de órfãos fica para depois.
- Qualquer editor WYSIWYG ou toolbar de formatação (botões de negrito/itálico) — só Markdown digitado à
  mão com pré-visualização.
- Mudanças em `radial-chart-stack.tsx`, no fluxo de resultado do quiz (Issue #93/#95), ou no
  agendamento FSRS (Issue #16/#77).

## Ordem do pipeline

1. **Testador**: ler este spec, escrever testes RED para AC-1 a AC-5 nos arquivos listados acima,
   confirmar que falham pelo motivo certo, commitar, **não implementar produção**.
2. **Desenvolvedor**: implementar o mínimo para fazer todos os testes passarem, sem editar nenhum
   teste.
3. **Revisor**: rodar a suíte completa (`npm run test:unit`), revisar o diff contra este spec, conferir
   que nenhuma imagem aparece inline fora do `ImageAttachmentViewer`/dialog, e que os 4 pontos de
   exibição (flashcard manager, quiz manager, quiz runner, review session) foram todos atualizados.
4. **Redator de Docs**: atualizar `CHANGELOG.md` referenciando a Issue #96.
