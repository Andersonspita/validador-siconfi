## [3.4.0] — 2026-06-26

### Relatórios de Execução Orçamentária (feature)

- **`reportEngine.ts`** — motor de relatórios que extrai e agrega dados de despesa
  da MSC (contas 622xxx) por 5 dimensões: Função, Função/Subfunção, Fonte de Recurso,
  Natureza de Despesa, Órgão/Poder. Mapeamento PCASP:
  Empenhado = 622130100, Liquidado = 622130200/300/400, Pago = 622130300/400.
  Toggle Movimentação (`period_change`) × Acumulado (`ending_balance`).
  Drill-down: Função → Subfunção → Fonte (com filtros encadeados).
- **`ReportView.tsx` + `ReportView.css`** — tabela interativa com seletor de
  agrupamento (segmented control), breadcrumb navegável, linha de TOTAL no rodapé
  e export CSV da visão atual.
- **`ReportDashboard.tsx`** — nova aba "Relatórios de Execução" ao lado de
  "Validações"; `parsedMsc` e `mscPeriods` salvos no state após processamento.

---

## [3.2.0] — 2026-06-26

### Lançamentos Contábeis Corretivos (feature)

- **`correctiveEntries.ts`** — novo módulo que mapeia 14 regras de validação a
  lançamentos PCASP D/C sugeridos para corrigir cada inconsistência:
  D2_00083 (DDR), D2_00081 (férias/13º), D2_00067/68 (depreciação),
  D2_00055 (amortização), D2_00053 (estoques), D2_00059/60 (créditos),
  D2_00030/31/34/40 (saldos negativos), D2_00094/95 (RPPS/RGPS),
  D1_00021 (ativo invertido), D1_00025 (passivo invertido),
  D1_00029-33 (ICs ausentes — não há lançamento, orienta atualizar no sistema),
  D2_00080 (estoques), D2_00054 (equivalência patrimonial).
- **`types.ts`** — nova interface `SuggestedEntry` e campo `suggestedEntries?`
  em `ValidationResult`.
- **`validators/index.ts`** — chama `enrichWithCorrectiveEntries()` após
  `runValidations()` para popular automaticamente os lançamentos sugeridos.
- **`pdfGenerator.ts`** — nova seção "Plano de Correção Contábil" no PDF com
  tabela D/C por regra, valores calculados automaticamente quando possível
  (ex.: diferença DDR, estimativa 8% para férias, 20%+8% para RGPS).

### Melhorias no PDF
- `buildDoc()` unificado (browser + CLI)
- Orientações de servidor compactadas em 1 linha com link siconfi.tesouro.gov.br
- Caixas coloridas de resumo no cabeçalho
- Colunas calculadas para zero overflow em A4 (22+80+80 = 182mm)

# Changelog — Validador Siconfi

## [3.1.0] — 2026-06-25

### Correções QA (auditoria Lopes Consultoria)

#### 🔴 Crítico
- **QA-001 / D2_00050** (`rulesD2.ts`): corrigido filtro de despesas empenhadas na MSC de encerramento que usava `CONTA.startsWith('62213.01')` — com ponto, que nunca ocorre em códigos PCASP puramente numéricos. A condição jamais era satisfeita, forçando `mscDespesasEmpenhadas = R$ 0` e gerando falso erro impeditivo em todo ente com DCA preenchida. Corrigido para `CONTA.startsWith('62213')`.

#### 🟠 Alto
- **QA-002** (`parsers.ts`): CSVs extraídos de ZIPs agora passam por detecção de encoding (`decodeTextFromBytes`) em vez de assumir UTF-8. Cobre sistemas legados municipais (Elotech, Betha) que exportam em `windows-1252`.
- **QA-003** (`parsers.ts`): arquivos XLS/XLSX dentro de ZIPs agora são processados corretamente. Antes eram silenciosamente ignorados — qualquer RREO/DCA em XLS zipado resultava em "arquivo ausente" no relatório.
- **QA-004** (`parsers.ts`): o fallback final de `readTextWithEncoding` agora lança `Error` explícito quando o conteúdo não contém o cabeçalho `CONTA;`, evitando que arquivos binários ou PDFs enviados por engano sejam parseados como CSVs corrompidos sem nenhuma mensagem de erro.

#### 🔵 Médio
- **QA-005 / D1_00018** (`rulesD1.ts`): mensagem melhorada para explicar que reclassificações de Indicador de Conta (FR, CO, ND) entre períodos geram diferenças SI+MOV≠SF de forma legítima. Adicionado `actionPlan` com orientação de priorização por threshold de R$ 1.000.
- **QA-006 / D1_00023 + D1_00024** (`rulesD1.ts`): comparação de MSCs idênticas entre meses migrada de índice posicional para `Map` por `mscAccountKey`. Antes, arquivos com os mesmos dados em ordem diferente (comum em exportações de datas distintas) geravam falso negativo — MSCs idênticas não eram detectadas.
- **QA-007** (novos arquivos): adicionados `rulesD1.test.ts` e `rulesD2.test.ts` com 18 testes unitários cobrindo D1_00017, D1_00018, D1_00021, D1_00022, D1_00023, D1_00024, D1_00031, D2_00050, D2_00055, D2_00081 e D2_00083.

#### 🟢 Baixo
- **QA-010 / D2_00083** (`rulesD2.ts`): `affectedAccounts` agora usa `DDR_DEVEDORA_PREFIXES` e `DDR_CREDORA_PREFIXES` importadas de `pcaspRules.ts` em vez de strings hardcoded `['7211', '8211']`.
- **QA-011** (`parsers.ts`): `XLSX.read` recebe `cellDates: true, dateNF: 'dd/mm/yyyy'` para evitar que datas em planilhas RREO/DCA virem número serial Excel (ex.: `46021` em vez de `"28/02/2026"`).

### Novas funções públicas
- `decodeTextFromBytes(bytes: Uint8Array): string` — exportada de `parsers.ts` para reutilização e testabilidade.

---

## [3.0.0] — 2026-06-25 (auditoria QA anterior)

- Equilíbrio D=C por tipo de saldo (`validateEquilibrioGeral`)
- MSC por período (`mscByPeriod`)
- DDR com subgrupos 7211 × 8211
- D1_00021 excluindo depreciação acumulada
- D2_00081 com 13º proporcional (211110104)
- Parser com fallback de encoding
- Relatório PDF com ente/período/MDF version
- Remoção de regras D2 fictícias sem lógica real
