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

- **`Questionnaire.Next`/`Questionnaire.Submit`/`Questionnaire.Actions` NÃO são usados — descoberta feita lendo o código-fonte real, não a documentação pública.** A documentação do shadcn não expõe isso, mas `node_modules/@shadcn/react/dist/questionnaire/index.js` mostra que o botão `Next`/`Submit` interno chama `item.validate()` antes de avançar, e essa validação **bloqueia qualquer item "unanswered" mesmo sem `required`** (só um item com status `"answered"` ou `"skipped"` — via `Questionnaire.Skip`, que também não usamos — passa). Confirmado escrevendo um teste exploratório isolado (`Questionnaire.Root` com 2 itens, nenhum `required`): clicar em `Questionnaire.Next` sem responder a pergunta atual **não avança** (`data-current` não muda, o `onSubmit` do Root nunca é chamado). Isso quebraria a tolerância a pergunta-sem-resposta já testada e decidida na #93 (`calculateQuizScore` conta não-resposta como erro, não bloqueia o fluxo). Por isso o rodapé continua sendo **o mesmo botão único de sempre** (`Button` do shadcn base, `type="button"`, texto alternando `nextQuestionAction`/`finishQuizAction` via `isLastQuestion`), fora do `Questionnaire`, controlando `currentIndex` diretamente — o `Questionnaire.Root` só fornece a marcação de pergunta/alternativas (`Item`/`Title`/`Choices`/`Choice`), não a navegação.
- **Resposta final lida via `ref` no clique do botão, não via `onSubmit`.** Como não há botão `type="submit"`, o evento nativo `submit` do formulário nunca dispara pelo fluxo normal. `Questionnaire` (o wrapper shadcn) repassa `ref` para o `<form>` subjacente; guardamos essa ref (`formRef`) e, no clique do botão "Finalizar quiz", fazemos `new FormData(formRef.current)` para ler `formData.get(question.id)` de cada pergunta (`null` → string vazia, mesma tolerância de sempre) — sem depender de nenhum gate de validação interno do primitivo.
- **`Questionnaire.Progress` não é usado.** O primitivo expõe `current`/`total`/`first`/`last` via um `render` prop cujo formato não é coberto pela documentação pública, e reimplementar a barra+rótulo já testados (`Progress` do shadcn base + `quizQuestionProgressLabel`) não muda o comportamento visível. Continuamos derivando `currentIndex` do nosso próprio estado (`onItemChange` do `Questionnaire.Root` mantém esse estado em sincronia caso a navegação por teclado do primitivo — setas/Enter, ligada ao `Root`, ativa mesmo sem os botões `Next`/`Skip` — troque o item ativo).
- **Todas as perguntas ficam no DOM, escondidas via `hidden`.** `Questionnaire.Item` aplica `hidden`/`inert` no `<fieldset>` quando não é o item ativo — confirmado lendo o bundle. `getAllByRole("radio")` continua só retornando os da pergunta visível (elementos com `hidden` são inacessíveis para queries de *role* no jsdom), mas **`getByText`/`queryByText` não filtram por visibilidade** (só checam presença no DOM) — os testes que antes afirmavam "a outra pergunta não está no documento" precisam trocar para `.not.toBeVisible()`, já que a pergunta inativa passa a estar sempre presente, só oculta.
- **Sem `required` nos itens** — não que isso mude o comportamento (ver acima, `required` só afetaria os botões `Next`/`Skip`/`Submit` que não usamos), mas mantém a intenção explícita de "nenhuma pergunta é obrigatória" registrada no `items`/`Questionnaire.Item`.
- **O botão "ver imagem" de cada opção fica fora do `Questionnaire.Choice`.** `Questionnaire.Choice` renderiza um `<label>` nativo envolvendo o `<input>` da alternativa; um `<button>` descendente desse `<label>` ainda ativa o controle associado ao ser clicado (mesma armadilha já resolvida na Issue #96 para `RadioGroup`/`Label` do Radix). Por isso `ImageAttachmentViewer` vira irmão do `Questionnaire.Choice` (os dois dentro de um `<div className="flex items-center gap-2">` por opção), nunca filho dele. No cabeçalho da pergunta não há esse risco: `Questionnaire.Title` renderiza um `<legend>`, que não tem controle associado.
- **Sem estado de resposta por clique.** Diferente da implementação anterior (`handleAnswerChange` a cada clique), as respostas ficam nos controles nativos do formulário (`Questionnaire.ChoiceInput`, um `<input type="radio" name={question.id} value={option.id}>` por baixo) e só são lidas uma vez, no clique do botão de finalizar, via `new FormData(formRef.current)`. Isso simplifica o componente (menos um `useState`).

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
        <div className="flex items-center gap-2" key={option.id}>
          <Questionnaire.Choice className="flex-1" value={option.id}>
            <MarkdownContent content={option.text} />
          </Questionnaire.Choice>
          <ImageAttachmentViewer fileName={option.imagePath} />
        </div>
      ))}
    </Questionnaire.Choices>
  </Questionnaire.Item>
  ```
- `QuizRunnerDialog` envolve as perguntas em (progress bar + rótulo continuam exatamente iguais, fora do `Questionnaire`):
  ```tsx
  <Questionnaire.Root
    item={currentQuestion?.id}
    items={questions.map((q) => ({ name: q.id, choices: q.options.map((o) => ({ value: o.id })) }))}
    onItemChange={(item) => {
      const index = questions.findIndex((q) => q.id === item);
      if (index !== -1) setCurrentIndex(index);
    }}
    ref={formRef}
  >
    {questions.map((question) => <QuizRunnerQuestionStep key={question.id} question={question} />)}
  </Questionnaire.Root>
  <DialogFooter>
    <Button onClick={handleAdvanceClick} type="button">
      {isLastQuestion ? t("finishQuizAction") : t("nextQuestionAction")}
    </Button>
  </DialogFooter>
  ```
- `handleAdvanceClick()`: se não é a última pergunta, só incrementa `currentIndex` (`item` do `Questionnaire.Root` é controlado, então isso já move o "wizard"). Na última, lê `new FormData(formRef.current)`, monta `answers` (`formData.get(question.id) ?? ""` por pergunta, mesma tolerância de sempre), chama `calculateQuizScore(questions, answers)` e grava `finishedAt`; guarda `answers` em estado (novo, só para a lista de revisão do AC-3) em vez de descartar.

## AC-3 — Lista de revisão por pergunta (novo, dentro de `QuizRunnerResult`)

Abaixo das duas linhas de tempo já existentes, uma lista (`<ol>`/`<li>` ou `<div>` com `role="list"`) com um item por pergunta, cada um mostrando:
- O texto da pergunta (`MarkdownContent`) + `ImageAttachmentViewer` do cabeçalho.
- `quizReviewYourAnswerLabel` interpolando o texto da opção escolhida (ou `quizReviewNoAnswerLabel` quando a pergunta não foi respondida).
- `quizReviewCorrectAnswerLabel` interpolando o texto da opção correta — **omitido quando a resposta escolhida já é a correta** (evita redundância visual).
- Um indicador de acerto/erro: `CheckCircle2` (`text-primary`) quando a resposta escolhida é a correta, `XCircle` (`text-destructive`) quando não é — ambos de `lucide-react`, mesma lib de ícones já usada no projeto (`components.json` → `iconLibrary: "lucide"`). Cada ícone recebe `role="img"` + `aria-label` (`quizReviewCorrectStatusLabel`/`quizReviewIncorrectStatusLabel`) para não depender só da cor.

`QuizRunnerResult` passa a receber `answers`/`questions` (hoje só recebe `result`/`averageTimeMs`/`totalTimeMs`) para montar essa lista.

### Novas chaves i18n (`en` e `pt-BR`)

`quizReviewCorrectAnswerLabel`, `quizReviewCorrectStatusLabel`, `quizReviewHeading`, `quizReviewIncorrectStatusLabel`, `quizReviewNoAnswerLabel`, `quizReviewYourAnswerLabel`. (`nextQuestionAction`/`finishQuizAction`/`viewImageAction` já existem e são reaproveitadas tal qual pelo botão único do rodapé.)

## Fora de escopo

- Usar `Questionnaire.Next`/`Questionnaire.Submit`/`Questionnaire.Previous`/`Questionnaire.Skip`/`Questionnaire.Actions` — ver "Escolhas técnicas": o gate de validação interno desses componentes é incompatível com a tolerância a pergunta-sem-resposta decidida na #93.
- Usar `Questionnaire.Progress`/`shortcuts` (atalhos de teclado por letra/número) — não pedido, e a barra de progresso atual já é testada e suficiente.
- Persistência do resultado/revisão no banco — comportamento inalterado (nada é salvo ao finalizar, mesma limitação já existente).

## Ordem do pipeline

1. **Testador**: reescrever `src/tests/unit/quiz-runner-dialog.test.tsx` para a nova marcação (`Questionnaire.Item`/`Choices`/`Choice` em vez de `RadioGroup`, todas as perguntas sempre montadas — trocar as asserções de "pergunta anterior não está no documento" por "não está visível") e acrescentar os testes da lista de revisão (texto da pergunta, resposta escolhida, resposta correta, indicador). Confirmar RED, commitar.
2. **Desenvolvedor**: implementar até GREEN.
3. **Revisor**: `npm run test:unit`; `npx ultracite check <arquivos tocados>`; `npm ci --ignore-scripts` (valida que `package-lock.json` ficou consistente depois do `shadcn add`); rodar o app manualmente para confirmar que não há regressão visual.
4. **Redator de Docs**: `CHANGELOG.md`.
