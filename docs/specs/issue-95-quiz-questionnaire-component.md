# Spec — Issue #95: Quiz com componente Questionnaire do shadcn/ui + revisão por pergunta

- **Issue:** #95 — "Quiz: usar componente Questionnaire do shadcn/ui + revisão por pergunta no resultado".
- **Branch:** `feature/95-quiz-questionnaire-component`
- **Motivação:** `QuizRunnerDialog` (redesenhado na Issue #93, mergeado como parte da #93/#94/#96) monta as alternativas de resposta à mão com `RadioGroup`/`RadioGroupItem` + `Label`. O componente oficial `Questionnaire` do shadcn/ui (lançado em ago/2026) cobre exatamente esse caso — pergunta + alternativas + navegação — com primitivos prontos (`Item`, `Choices`, `Choice`, `Next`, `Submit`) e captura nativa das respostas via `FormData`. Esta issue troca `RadioGroup` pelos primitivos `Questionnaire` e, no resultado final, adiciona uma lista de revisão por pergunta (texto, resposta escolhida, resposta correta, indicador de acerto/erro).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Estado herdado (Issue #93/#96, já em `main`)

- Uma pergunta por vez, `Progress` (shadcn) + rótulo textual `quizQuestionProgressLabel` no topo — **mantido tal qual**, não é parte do componente `Questionnaire` (ver "Escolhas técnicas").
- Navegação só pra frente (sem "Anterior"/revisão de resposta já dada) — decisão da #93, **mantida**.
- Tela de resultado: `RadialChartText` com o percentual + `quizResultMessage`, mais duas linhas de tempo (`quizTotalTimeLabel`/`quizAverageTimeLabel`) — **mantido tal qual**, a issue só adiciona a lista de revisão *abaixo* disso.
- `question.imagePath`/`option.imagePath` com `ImageAttachmentViewer` (Issue #96) — **mantido**, tanto na tela de pergunta quanto (novamente) na lista de revisão.
- `calculateQuizScore`/`formatQuizDuration` (`src/utils/quiz-scoring.ts`) — **mantidos sem alteração de assinatura**.

## Decisões do usuário (confirmadas antes deste spec, não deduzidas)

Herdadas da issue: manter a navegação só-pra-frente e o layout do resultado já decididos na #93; a única mudança de UI pedida é a troca do primitivo de alternativas e a adição da revisão por pergunta.

## Escolhas técnicas (não são decisão de design, mas registradas para o Revisor)

- **`Questionnaire.Progress` não é usado.** O primitivo expõe `current`/`total`/`first`/`last` via um `render` prop cujo formato não é coberto pela documentação pública, e reimplementar a barra+rótulo já testados (`Progress` do shadcn base + `quizQuestionProgressLabel`) não muda o comportamento visível. Continuamos derivando `currentIndex` do nosso próprio estado, sincronizado a partir de `onItemChange` do `Questionnaire.Root`.
- **Todas as perguntas ficam no DOM, escondidas via `hidden`.** `Questionnaire.Item` aplica `hidden` no `<fieldset>` quando não é o item ativo (`QuestionnaireItemState.active`) — confirmado lendo `node_modules/@shadcn/react/dist/questionnaire/index.js`. Isso é o que já é esperado pelos testes existentes (`getAllByRole("radio")` só retorna os da pergunta visível, porque elementos com `hidden` são inacessíveis para queries de role no jsdom), então a suíte não precisa de nenhuma mudança nesse ponto — só troca `input type="radio"` por `Questionnaire.Choice`/`ChoiceInput` (ainda `role="radio"` quando `multiple` não é passado).
- **Sem `required` nos itens.** Mantém a tolerância a pergunta não respondida (decisão da #93/`calculateQuizScore`) — se marcássemos `required`, o `Questionnaire.Next`/`Submit` bloqueariam o avanço.
- **Sem estado de resposta por clique.** Diferente da implementação anterior (`handleAnswerChange` a cada clique), as respostas ficam nos controles nativos do formulário (`Questionnaire.ChoiceInput`, um `<input type="radio" name={question.id} value={option.id}>` por baixo) e só são lidas uma vez, no `onSubmit` do `Questionnaire.Root` (disparado pelo clique em `Questionnaire.Submit`, depois da validação nativa), via `new FormData(event.currentTarget)`. Isso simplifica o componente (menos um `useState`) e é exatamente o padrão documentado pelo shadcn para este primitivo.
- **`Questionnaire.Next`/`Questionnaire.Submit` decidem sua própria visibilidade** (`QuestionnaireNavigationState.visible`, baseado em `first`/`last` do item ativo) — os dois ficam sempre montados dentro de `Questionnaire.Actions`; não precisamos mais de um `isLastQuestion` para escolher qual botão renderizar (só para calcular o rótulo do progresso, que é nosso).

## AC-1 — Instalar o componente

`npx shadcn@latest add questionnaire` (feito sem `--overwrite`; a CLI pediu para sobrescrever `src/components/ui/button.tsx` — recusado, o diff era só reformatação sem mudança funcional). Isso adiciona `src/components/ui/questionnaire.tsx` e a dependência `@shadcn/react` a `package.json`/`package-lock.json`.

## AC-2 — `src/components/quiz-runner-dialog.tsx` (reescrito)

- `QuizRunnerQuestionStep` deixa de existir como componente próprio de `RadioGroup`; passa a renderizar, para **cada** pergunta (todas montadas, não só a atual):
  ```tsx
  <Questionnaire.Item name={question.id}>
    <Questionnaire.Title>
      <MarkdownContent content={question.text} />
      <ImageAttachmentViewer fileName={question.imagePath} />
    </Questionnaire.Title>
    <Questionnaire.Choices>
      {question.options.map((option) => (
        <Questionnaire.Choice key={option.id} value={option.id}>
          <MarkdownContent content={option.text} />
          <ImageAttachmentViewer fileName={option.imagePath} />
        </Questionnaire.Choice>
      ))}
    </Questionnaire.Choices>
  </Questionnaire.Item>
  ```
- `QuizRunnerDialog` envolve tudo em:
  ```tsx
  <Questionnaire.Root
    item={currentQuestion?.id}
    items={questions.map((q) => ({ name: q.id, choices: q.options.map((o) => ({ value: o.id })) }))}
    onItemChange={(item) => {
      const index = questions.findIndex((q) => q.id === item);
      if (index !== -1) setCurrentIndex(index);
    }}
    onSubmit={handleSubmit}
  >
    {/* Progress + label continuam iguais, fora do Questionnaire.Root ou dentro, tanto faz — não dependem dele */}
    {questions.map((question) => <QuizRunnerQuestionStep key={question.id} question={question} />)}
    <Questionnaire.Actions>
      <Questionnaire.Next>{t("nextQuestionAction")}</Questionnaire.Next>
      <Questionnaire.Submit>{t("finishQuizAction")}</Questionnaire.Submit>
    </Questionnaire.Actions>
  </Questionnaire.Root>
  ```
- `handleSubmit(event)`: `event.preventDefault()`; monta `answers` lendo `new FormData(event.currentTarget).get(question.id)` para cada pergunta (`null` → string vazia, mesma tolerância de sempre); chama `calculateQuizScore(questions, answers)` e grava `finishedAt`; guarda `answers` em estado (novo, só para a lista de revisão do AC-3) em vez de descartar.

## AC-3 — Lista de revisão por pergunta (novo, dentro de `QuizRunnerResult`)

Abaixo das duas linhas de tempo já existentes, uma lista (`<ol>`/`<li>` ou `<div>` com `role="list"`) com um item por pergunta, cada um mostrando:
- O texto da pergunta (`MarkdownContent`) + `ImageAttachmentViewer` do cabeçalho.
- `quizReviewYourAnswerLabel` interpolando o texto da opção escolhida (ou `quizReviewNoAnswerLabel` quando a pergunta não foi respondida).
- `quizReviewCorrectAnswerLabel` interpolando o texto da opção correta — **omitido quando a resposta escolhida já é a correta** (evita redundância visual).
- Um indicador de acerto/erro: `CheckCircle2` (`text-primary`) quando a resposta escolhida é a correta, `XCircle` (`text-destructive`) quando não é — ambos de `lucide-react`, mesma lib de ícones já usada no projeto (`components.json` → `iconLibrary: "lucide"`).

`QuizRunnerResult` passa a receber `answers`/`questions` (hoje só recebe `result`/`averageTimeMs`/`totalTimeMs`) para montar essa lista.

### Novas chaves i18n (`en` e `pt-BR`)

`quizReviewCorrectAnswerLabel`, `quizReviewHeading`, `quizReviewNoAnswerLabel`, `quizReviewYourAnswerLabel`. (`nextQuestionAction`/`finishQuizAction`/`viewImageAction` já existem e são reaproveitadas tal qual pelos primitivos `Questionnaire.Next`/`Submit`.)

## Fora de escopo

- Usar `Questionnaire.Previous`/`Questionnaire.Skip` — decisão de navegação só-pra-frente da #93 permanece.
- Usar `Questionnaire.Progress`/`shortcuts` (atalhos de teclado por letra/número) — não pedido, e a barra de progresso atual já é testada e suficiente.
- Persistência do resultado/revisão no banco — comportamento inalterado (nada é salvo ao finalizar, mesma limitação já existente).

## Ordem do pipeline

1. **Testador**: reescrever `src/tests/unit/quiz-runner-dialog.test.tsx` para a nova captura de resposta via `FormData`/submit nativo (o comportamento observável — uma pergunta por vez, radios por alternativa, progress label, next/finish, resultado com radial chart + tempos — não muda; o que muda é que a submissão final agora é um submit de formulário) e acrescentar os testes da lista de revisão (texto da pergunta, resposta escolhida, resposta correta, indicador). Confirmar RED, commitar.
2. **Desenvolvedor**: implementar até GREEN.
3. **Revisor**: `npm run test:unit`; `npx ultracite check <arquivos tocados>`; `npm ci --ignore-scripts` (valida que `package-lock.json` ficou consistente depois do `shadcn add`); rodar o app manualmente para confirmar que não há regressão visual.
4. **Redator de Docs**: `CHANGELOG.md`.
