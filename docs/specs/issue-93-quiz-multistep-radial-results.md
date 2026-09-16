# Spec — Issue #93: Quiz multi-step com progress-bar e resultado com radial chart

- **Issue:** #93 — "Quiz: fluxo multi-step com progress-bar e tela de resultado com radial chart".
- **Branch:** `feature/93-quiz-multistep-radial-results`
- **Motivação:** `QuizRunnerDialog` hoje renderiza todas as perguntas de uma vez, com
  `<input type="radio">` cru, e o resultado é uma única frase de texto (`quizResultMessage`). Esta
  issue redesenha essa experiência: uma pergunta por vez, progress-bar no topo, componentes shadcn/ui
  (`RadioGroup`) para as alternativas, e uma tela de resultado com um radial chart mostrando a
  pontuação, mais tempo total e tempo médio por questão.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário (confirmadas antes deste spec, não deduzidas)**:
  1. **Navegação só pra frente** — sem botão "Anterior"/revisão de resposta já dada.
  2. **Layout do resultado**: o radial chart fica no centro mostrando a pontuação (%), com tempo total
     e tempo médio por questão como duas linhas de texto separadas (não integrados ao gráfico).

## Escolhas técnicas (não são decisão de design, mas registradas para o Revisor)

- **`Stepper` do ReUI não é usado** — depende de `@base-ui/react`, uma lib de primitivos diferente do
  Radix que todo o resto do projeto usa (`components.json` declara `"style": "radix-mira"`; todo
  componente em `src/components/ui` já instalado importa de `radix-ui`). Introduzir uma segunda lib de
  primitivos só para uma barra de progresso não navegável (decisão 1 acima) não se paga. Em vez disso:
  `Progress` (shadcn base, Radix, sem dependência nova) + o próprio estado de step (`currentIndex`) do
  componente.
- **Radial chart**: shadcn `chart` (wrapper `ChartContainer`/`ChartConfig` sobre Recharts, única
  dependência nova: `recharts`) — não existe um exemplo gratuito do ReUI chamado exatamente
  "radial chart text" (só variações de donut/lighthouse no catálogo gratuito), então o componente é
  escrito à mão seguindo a receita oficial do shadcn (`RadialBarChart` de um único valor, ângulo final
  proporcional ao valor, texto centralizado via `<Label content={...} />` dentro de
  `<PolarRadiusAxis>`), mantendo a mesma abordagem/estilo que o restante do app já usa para  outros
  componentes shadcn.
- **Tempo médio por questão**: `tempoTotal / número de perguntas` — matematicamente idêntico a medir o
  tempo de cada pergunta individualmente e tirar a média (média = soma / contagem, sempre), então basta
  guardar `startedAt`/`finishedAt` (dois timestamps), sem cronômetro por pergunta.

## AC-1 — `src/utils/quiz-scoring.ts`: `formatQuizDuration`

```ts
export function formatQuizDuration(milliseconds: number): string;
```

Formata uma duração em milissegundos como `"Ns"` (< 1 minuto) ou `"Mm SSs"` (>= 1 minuto, segundos
sempre com 2 dígitos, ex. `"3m 05s"`). Arredonda para o segundo mais próximo; nunca negativo (entrada
negativa é tratada como `0`).

## AC-2 — `src/components/radial-chart-text.tsx` (novo, genérico — não é quiz-específico)

```ts
export interface RadialChartTextProps {
  centerLabel: string;
  centerSublabel?: string;
  className?: string;
  value: number; // 0-100, clampado
}
export function RadialChartText(props: RadialChartTextProps): JSX.Element;
```

Anel único (`RadialBarChart` de um item), ângulo final proporcional a `value` (0 = anel vazio, 100 =
volta completa), cor `var(--chart-2)` (já existente em `src/styles/global.css`, mesma família usada
pelos outros charts do app — não uma cor nova). Texto centralizado: `centerLabel` em destaque
(`text-3xl font-bold`), `centerSublabel` abaixo, em `text-muted-foreground`, só quando fornecido.

## AC-3 — `src/components/quiz-runner-dialog.tsx` (reescrito)

- **Progress bar** (`Progress` de `@/components/ui/progress`) no topo do `DialogContent` (antes do
  `DialogHeader`), `value = ((currentIndex + 1) / questions.length) * 100`. Rótulo de texto acima/abaixo
  (`quizQuestionProgressLabel`, ex. "Pergunta 2 de 5") — necessário para leitores de tela, já que a
  `Progress` do Radix não expõe a fração como texto por si só.
- **Uma pergunta por vez**: renderiza só `questions[currentIndex]`, usando `RadioGroup`/`RadioGroupItem`
  (`@/components/ui/radio-group`) + `Label` (`@/components/ui/label`) em vez do `<input>` cru atual —
  mesmo texto/estrutura semântica (`role="radio"`, um grupo por pergunta), agora com um único grupo
  montado por vez (não N grupos simultâneos).
- **Navegação só pra frente**: um único botão no rodapé — `nextQuestionAction` ("Próxima pergunta")
  enquanto `currentIndex < questions.length - 1`; vira `finishQuizAction` ("Finalizar quiz") na última
  pergunta. Clicar nele nas perguntas intermediárias incrementa `currentIndex`; na última, calcula o
  resultado (mesmo tolerante-a-pergunta-sem-resposta de sempre, via `calculateQuizScore`) e registra
  `finishedAt`. Não há botão "Anterior" (decisão 1) nem opção de revisar uma pergunta já respondida.
- **Cronometragem**: `startedAt` é gravado (`Date.now()`) no mesmo efeito que já reresetava
  `answers`/`result` quando `open` vira `true` (não espera o fetch de `listQuizQuestionsWithOptions` —
  a diferença é desprezível e simplifica o estado). `finishedAt` é gravado no clique do botão de
  finalizar.
- **Tela de resultado** (substitui a frase de texto única atual): `RadialChartText` com
  `value = (correct / total) * 100`, `centerLabel = "{percent}%"`, `centerSublabel` reaproveitando a
  string já existente `quizResultMessage` ("X de Y corretas"); abaixo, duas linhas de texto usando as
  novas chaves `quizTotalTimeLabel`/`quizAverageTimeLabel`, cada uma interpolando o resultado de
  `formatQuizDuration` (tempo total = `finishedAt - startedAt`; tempo médio = tempo total dividido pelo
  número de perguntas).

### Novas chaves i18n (`en` e `pt-BR`)

`nextQuestionAction`, `quizAverageTimeLabel`, `quizQuestionProgressLabel`, `quizTotalTimeLabel`.
`finishQuizAction`/`quizResultMessage` já existem e são reaproveitadas tal qual.

## Fora de escopo

- Navegação para trás / revisão de resposta já dada (decisão do usuário).
- Qualquer persistência do resultado do quiz (score, tempos) — comportamento inalterado: nada é
  salvo no banco ao finalizar, mesma limitação já existente antes desta issue.
- Cronômetro visível durante o quiz (contador regressivo/progressivo na tela) — só o tempo total e a
  média aparecem, e só depois de finalizar.

## Ordem do pipeline

1. **Testador**: reescrever `src/tests/unit/quiz-runner-dialog.test.tsx` para o novo comportamento
   (uma pergunta por vez, botão "próxima"/"finalizar", tela de resultado com radial chart + tempos —
   usando `vi.useFakeTimers()`/`vi.setSystemTime` para tornar `startedAt`/`finishedAt` determinísticos
   nos testes), acrescentar testes de `formatQuizDuration` em `quiz-scoring.test.ts`, e um teste mínimo
   de `radial-chart-text.test.tsx`. Confirmar RED contra a implementação atual, commitar.
2. **Desenvolvedor**: implementar até GREEN.
3. **Revisor**: `npm run test:unit`; confirmar que nenhuma pergunta deixou de ser tolerante a
   não-resposta; que a barra de progresso e o rótulo textual concordam; que não há regressão visual
   grosseira (rodar o app manualmente).
4. **Redator de Docs**: `CHANGELOG.md`.
