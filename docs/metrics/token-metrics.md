# Métricas de consumo de tokens por pipeline de agentes

Log de consumo de tokens por etapa do pipeline Spec Driven Development + TDD (Testador →
Desenvolvedor → Revisor → Redator de Docs), medido pelo próprio harness ao final de cada subagente
(`subagent_tokens`), não estimado. Criado como o primeiro ciclo de instrumentação recomendado pela
deliberação em `docs/council/2026-09-08-reducao-docs-e-testes-vs-consumo-de-tokens.md` — antes dessa
medição, não havia dado real sobre onde o consumo de tokens do pipeline realmente vai.

Cada linha reporta os tokens da chamada daquele subagente especificamente — não inclui o custo do
orquestrador (esta sessão) que lê a issue, monta o spec e escreve os prompts de cada etapa.

## Issue #14 — Atividade tipo Quiz

- **Branch:** `feature/14-atividade-quiz`
- **Observação:** esta issue já tinha uma etapa de Testador parcialmente executada em uma sessão
  anterior (commit `acd26f6`, pausada por orçamento de tokens antes deste ciclo de medição existir) —
  a linha "Testador" abaixo cobre apenas a continuação (AC-1/AC-2/AC-3), não o RED phase original.

**Nota de metodologia:** as duas primeiras tentativas desta etapa usaram mecanismos diferentes de
medição. A primeira (subagente interno via ferramenta `Agent` do Claude Code) teria reportado
`subagent_tokens` diretamente do harness — número autoritativo — mas foi interrompida pelo usuário
antes de concluir, sem gerar esse número. A segunda (terminal `Sentinela`, recrutado no canvas Maestri
a pedido do usuário, para visualização) não expõe `subagent_tokens` ao orquestrador; o número abaixo
foi obtido pedindo ao próprio terminal para rodar `/cost` (comando interno do Claude Code CLI, não uma
ferramenta invocável programaticamente — precisou ser enviado como entrada raw ao terminal). É
portanto um **auto-relato da mesma sessão**, não uma medição externa independente, mas é o dado mais
preciso disponível para um terminal do canvas Maestri.

| Papel | Terminal/Agente | Modelo | Input | Output | Cache read | Cache write | Custo (USD) | Duração API |
|---|---|---|---|---|---|---|---|---|
| Testador (continuação, retomada após interrupção) | Sentinela (Maestri) | claude-sonnet-5 | 1,6k | 12,1k | 2,3m | 78,7k | $0,90 | 2m49s |
| Testador (continuação, tentativa interrompida) | subagente interno (Agent tool) | claude-sonnet-5 | — | — | — | — | não medido (interrompido antes de reportar) | ~3min (parcial) |
| Desenvolvedor | Cinzel (Maestri) | claude-sonnet-5 | 188 | 77,8k | 16,2m | 215,1k | $4,87 | 12m14s |
| Revisor | Lupa (Maestri) | claude-sonnet-5 | 28 | 7,5k | 993,5k | 107,1k | $0,71 | 1m23s |
| Redator de Docs | Cronista (Maestri) | claude-sonnet-5 | 16 | 3,5k | 516,9k | 36,4k | $0,29 | 38s |
| **Total do ciclo** | | | **~1,8k** | **~100,9k** | **~20,0m** | **~437,3k** | **~$6,77** | **~17m04s** |

Cada terminal também gastou um pouco de `claude-haiku-4-5` (background/roteamento do próprio CLI —
~2,6-3,3k input, ~2-4k tokens por terminal, ~$0,003 cada), irrelevante perto do custo em Sonnet.

## Leituras deste primeiro ciclo

- **O Desenvolvedor domina o custo** (~72% do total, $4,87 de $6,77) — coerente com o que o conselho
  já havia previsto: o custo real está na geração de código e na exploração/leitura de arquivos de
  referência para manter convenção, não no tamanho de documentação ou testes em si. As outras três
  etapas (Testador, Revisor, Redator) somadas custam menos da metade do que só o Desenvolvedor.
- **`cache read` domina sobre tudo** (~20M tokens no ciclo, contra ~101k de output) — o prompt cache
  do Claude Code está absorvendo a maior parte do reprocessamento de contexto repetido entre turnos
  dentro de cada terminal. Isso é uma faca de dois gumes: barato por token, mas o volume enorme sugere
  que cada agente está recarregando bastante contexto estável a cada novo turno — candidato natural
  para a recomendação de "orçamento de contexto por papel" da ADR-0001 (nem todo papel precisa ler o
  mesmo volume).
- **O próprio processo de orquestração via `/maestri` tem custo mensurável** — o painel de `/cost`
  de cada terminal reportou "10% do uso veio de `/maestri`" a nível de conta, nas últimas 24h. Isso é
  auto-referencial e vale registrar: o mecanismo de coordenação entre agentes (recrutar terminais,
  handoff via `maestri ask`, polling de status) consome tokens por si só, separado do trabalho de
  implementação. Não é um vilão, mas também não é gratuito — vale considerar isso ao decidir, na
  ADR-0001, se toda issue precisa dos 4 papéis em terminais separados ou se issues pequenas cabem num
  pipeline mais enxuto (2 papéis, ou um único agente cobrindo TDD completo).
- **Nenhuma etapa foi limitada por tamanho de documentação lida** — nenhum dos quatro terminais leu
  mais do que `docs/specs/issue-14-quiz.md` (o spec desta issue, ~9KB) mais os arquivos de código
  diretamente relevantes ao seu papel. Isso é evidência de primeira mão, não hipotética, de que a
  premissa original ("documentação grande consome tokens") não se confirma neste ciclo — quem consumiu
  tokens foi o volume de código gerado/lido (Desenvolvedor) e o overhead de coordenação
  (`/maestri`), exatamente como o conselho havia previsto antes de qualquer medição existir.

## Issue #15 — Atividade tipo Flashcard/Baralho

- **Branch:** `feature/15-atividade-flashcard-baralho`
- **Time reaproveitado**: mesmos quatro terminais Maestri da Issue #14 (Sentinela/Cinzel/Lupa/Cronista),
  ainda vivos no canvas, reatribuídos para esta issue sem recriação. Isso significa que o `/cost` de
  cada terminal é **cumulativo desde a Issue #14**, não isolado a esta issue — os valores abaixo são o
  **delta** (custo atual menos o custo já registrado ao final da Issue #14), não uma leitura direta do
  `/cost`.
- **Diferença estrutural desta issue**: nenhuma migration nova foi necessária (`flashcards` e
  `review_items` já existiam desde `drizzle/0001`), então o trabalho do Desenvolvedor foi só
  IPC + UI, sem a etapa de schema/`drizzle-kit generate` que a Issue #14 teve.

| Papel | Terminal | Custo acumulado (após #15) | Custo acumulado (após #14) | **Delta (#15)** |
|---|---|---|---|---|
| Testador | Sentinela | $2,91 | $0,90 | **$2,01** |
| Desenvolvedor | Cinzel | $8,81 | $4,87 | **$3,94** |
| Revisor | Lupa | $1,35 | $0,71 | **$0,64** |
| Redator de Docs | Cronista | $0,72 | $0,29 | **$0,43** |
| **Total do ciclo (#15)** | | | | **~$7,02** |

## Leituras do segundo ciclo (Issue #15)

- **O padrão de dominância do Desenvolvedor se repete e se intensifica**: $3,94 de $7,02 (~56%) — mesmo
  numa issue *sem* etapa de schema/migration (mais simples que #14), o Desenvolvedor continua sendo o
  papel mais caro por uma margem larga. Isso reforça a leitura da Issue #14: o custo está na geração de
  código e na releitura de arquivos de referência para manter convenção (aqui, principalmente
  `ipc/activities/*` e `quiz-question-manager-dialog.tsx` como modelos a espelhar), não em qualquer
  coisa proporcional ao tamanho da issue em si.
- **O Testador desta issue custou mais que o da Issue #14** ($2,01 vs. $0,90) apesar de a feature ser
  mais simples — provável causa: o Testador desta vez teve que ler bem mais arquivos de referência
  para aprender os padrões a espelhar (IPC de `activities`, dois pares diálogo-gerenciador/diálogo-form
  de Quiz) antes de escrever qualquer teste, já que Flashcard não tinha nenhum RED phase herdado de uma
  sessão anterior como a Quiz tinha. Sugere que o custo do Testador é mais sensível a "quantos exemplos
  precisa ler para aprender a convenção" do que ao tamanho do que efetivamente escreve.
- **Reaproveitar os terminais entre issues tem um custo de medição, não só um benefício de setup**:
  como o `/cost` é cumulativo por sessão, cada issue subsequente exige calcular um delta manualmente em
  vez de ler o número direto — um lembrete prático de que, se esse hábito de instrumentação continuar,
  vale considerar pedir a cada terminal para anotar seu próprio "checkpoint de custo" ao final de cada
  issue (ou dispensar e recriar os terminais por issue, trocando o benefício de contexto quente por
  leitura de métrica mais simples).
