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

## Issue #16 — Motor FSRS: sessão de revisão do Baralho

- **Branch:** `feature/16-motor-fsrs-sessao-revisao`
- **Time reaproveitado** (mesmos quatro terminais desde a Issue #14) — valores abaixo são novamente o
  **delta** sobre o acumulado ao final da Issue #15.
- **Issue tecnicamente mais densa até aqui**: integra uma biblioteca externa real (`ts-fsrs`) com um
  modelo de dados (`Card`) mais rico do que o schema persistia, exigindo desenho de migration nova +
  módulo de conversão puro, não só CRUD espelhando um padrão já existente.

| Papel | Terminal | Custo acumulado (após #16) | Custo acumulado (após #15) | **Delta (#16)** |
|---|---|---|---|---|
| Testador | Sentinela | $6,39 | $2,91 | **$3,48** |
| Desenvolvedor | Cinzel | $14,16 | $8,81 | **$5,35** |
| Revisor | Lupa | $1,89 | $1,35 | **$0,54** |
| Redator de Docs | Cronista | $1,08 | $0,72 | **$0,36** |
| **Total do ciclo (#16)** | | | | **~$9,73** |

## Leituras do terceiro ciclo (Issue #16)

- **O ciclo mais caro até agora** (~$9,73, contra ~$6,77 da #14 e ~$7,02 da #15) — mas proporcionalmente
  alinhado com a complexidade real: esta é a primeira issue com uma biblioteca externa de domínio
  (`ts-fsrs`) cujo modelo de dados não cabia no schema existente, exigindo desenhar a migration e um
  módulo de tradução (`src/utils/fsrs.ts`) do zero, não apenas espelhar um CRUD já resolvido em Link/
  PDF/Quiz/Flashcard. O custo acompanhou a complexidade genuína da tarefa, não cresceu
  desproporcionalmente — sinal de que o pipeline escala razoavelmente com dificuldade real.
- **Testador e Desenvolvedor cresceram juntos desta vez** ($3,48 e $5,35, ambos os maiores valores do
  papel até agora) — diferente da Issue #15, onde só o Testador tinha custado mais que o padrão. Aqui
  os dois precisaram ler a documentação da biblioteca (`node_modules/ts-fsrs/README.md`) e entender uma
  API nova antes de produzir qualquer teste/código, não só espelhar convenções internas do projeto —
  sugere que "aprender uma biblioteca externa" é um driver de custo genuinamente distinto de "seguir um
  padrão interno já estabelecido".
- **A disciplina de escopo se manteve mesmo sob complexidade maior**: o Revisor confirmou explicitamente
  que `elapsed_days` nunca foi persistido e que `fsrs()` nunca recebeu parâmetros customizados — as duas
  armadilhas mais fáceis de cair ao integrar uma biblioteca de algoritmo (over-engineering de
  configuração, ou persistir campo deprecated "por via das dúvidas") foram evitadas, confirmando que o
  spec detalhado (com a fronteira explícita do que NÃO fazer) continua compensando o esforço de escrevê-lo.

## Issue #18 — Calendário (EventCalendar da ReUI)

- **Branch:** `feature/18-calendario`
- **Time reaproveitado** (mesmos quatro terminais desde a Issue #14) — valores abaixo são o delta
  sobre o acumulado ao final da Issue #16.
- **O ciclo mais caro até agora, por uma margem grande** — envolveu: instalação de uma biblioteca de
  UI externa nova (ReUI), uma colisão de overwrite não prevista no spec (button/dropdown-menu/tooltip
  já customizados), a descoberta de um bug pré-existente de precisão de timestamp (Issue #64,
  investigado e corretamente desviado, não corrigido), e — fora do próprio pipeline dos 4 terminais —
  uma rodada de depuração visual feita pelo orquestrador (esta sessão) contra um build empacotado real,
  que achou e descreveu com precisão um segundo bug (`defaultEvents` vs. `events`/`onEventsChange`)
  antes mesmo do Revisor entrar em cena.

| Papel | Terminal | Custo acumulado (após #18) | Custo acumulado (após #16) | **Delta (#18)** |
|---|---|---|---|---|
| Testador | Sentinela | $13,36 | $6,39 | **$6,97** |
| Desenvolvedor | Cinzel | $28,75 | $14,16 | **$14,59** |
| Revisor | Lupa | $3,11 | $1,89 | **$1,22** |
| Redator de Docs | Cronista | $1,67 | $1,08 | **$0,59** |
| **Total do ciclo (#18, só os 4 terminais)** | | | | **~$23,37** |

## Leituras do quarto ciclo (Issue #18)

- **O Desenvolvedor sozinho custou mais que o ciclo INTEIRO da Issue #14** ($14,59 vs. ~$6,77) — o
  maior salto de custo de papel único registrado até aqui. A causa não foi "biblioteca externa" por si
  só (a Issue #16 já tinha isso, com `ts-fsrs`, e custou bem menos) — foi a **combinação** de instalar
  uma biblioteca de UI de terceiros (que trouxe consigo uma colisão real com componentes já
  customizados do projeto, exigindo investigação e uma decisão de produto no meio da implementação) com
  dois ciclos de descoberta-de-bug-e-correção que cada um exigiu reler documentação, testar hipóteses, e
  esperar validação externa antes de prosseguir.
- **A instrumentação de tokens não captura o custo real do ciclo** — esta tabela mede só os 4 terminais
  do pipeline; não inclui o trabalho do orquestrador (esta sessão), que nesta issue foi
  desproporcionalmente maior que nas anteriores: pesquisa da API real via `mcp__reui__*` (várias
  chamadas, incluindo instalar-e-descartar um exemplo só para ler código-fonte real do registry),
  duas rodadas de teste visual contra build empacotado (a segunda encontrando e diagnosticando o bug de
  `defaultEvents`/`events` ANTES de qualquer terminal do pipeline), e toda a coordenação entre eles. Um
  número de "custo total do ciclo" que só soma os 4 terminais subestima sistematicamente o custo real
  de issues como esta, onde o orquestrador faz trabalho de investigação pesado. Vale registrar isso
  como limitação conhecida desta instrumentação, não como um dado a mais a interpretar.
- **Encontrar um bug de UI real exigiu rodar o app de verdade, não só os testes** — os testes unitários
  desta issue mockam o componente ReUI inteiro (decisão correta do Testador, documentada no próprio RED:
  "isso é responsabilidade da própria lib"), o que significa que nenhuma bateria de testes unitários
  jamais teria pego o bug de `defaultEvents`. Só apareceu ao empacotar o app e olhar a tela. Isso
  reforça, com um exemplo concreto e não-hipotético, a mesma lição já registrada no PR #61 (Issue #60):
  há uma classe de bug — integração real com uma biblioteca de terceiros, comportamento controlado vs.
  não-controlado, timing assíncrono — que só aparece rodando o software de verdade.
