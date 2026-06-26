# Diário de Implementação — Validador Siconfi

Registro cronológico das decisões técnicas e evoluções do projeto.

---

## 2026-06-26 — v3.4.0 — Relatórios de Execução Orçamentária

**Contexto:** o usuário apresentou prints de um sistema SIOPE mostrando despesas agrupadas por Função e com drill-down por Subfunção e Fonte de Recurso. A ideia foi replicar esse comportamento usando os dados já presentes na MSC — as contas Classe 6 (622xxx) contêm toda a execução orçamentária com ICs de Função/Subfunção (FS), Fonte (FR) e Natureza de Despesa (ND).

**Análise do mapeamento PCASP:**
- `622130100` (net C−D) = Créditos Empenhados a Liquidar → **Empenhado**
- `622130200/300/400` (net C−D) = estágios de liquidação/pagamento → **Liquidado**
- `622130300/400` (net C−D) = créditos efetivamente pagos → **Pago**

O toggle "Movimentação / Acumulado" usa `period_change` (o que ocorreu no mês) ou `ending_balance` (saldo acumulado), permitindo análise mensal ou anual.

**Implementação:**
- `reportEngine.ts`: função `gerarRelatorio()` pura (sem React) que filtra contas 622xxx, agrupa pelo IC escolhido e calcula os três estágios
- `proximoNivel()`: determina o próximo agrupamento no drill-down (Função → Subfunção → Fonte)
- `ReportView.tsx`: componente com `stack` de níveis para o breadcrumb, `useMemo` para recalcular só quando necessário
- `ReportDashboard.tsx`: salva `parsedMsc` e `mscPeriods` no state após `parseFiles()`, ativa a aba quando há dados

---

## 2026-06-26 — v3.3.0 — Firebase opcional e CAPAG do DDR

**Firebase opcional:** o app crashava silenciosamente no GitHub Pages porque `firebase.ts` tentava `initializeApp()` com credenciais `undefined`. A correção verificou `isFirebaseConfigured` antes do init e exportou `auth` como `null` quando não configurado. `App.tsx` passou a pular o `onAuthStateChanged` quando Firebase ausente.

**D2_00083 e CAPAG:** após pesquisa da Portaria MF nº 1.583/2023 e da metodologia CAPAG, confirmou-se que o DDR impacta o CAPAG por dois canais: (1) distorção do Indicador de Liquidez (IL) que usa apenas fontes não vinculadas; (2) degradação do Ranking ICF que desde 2023 bloqueia elegibilidade para crédito. A flag `impactsCapag` foi corrigida de `false` para `true`.

---

## 2026-06-26 — v3.2.0 — Lançamentos Contábeis Corretivos

**Contexto:** o relatório PDF existia mas não sugeria como corrigir os problemas encontrados. A decisão foi criar `correctiveEntries.ts` mapeando cada regra a lançamentos PCASP D/C com valores calculados automaticamente quando possível (diferença exata do DDR, estimativa de 8% para férias, alíquotas RPPS/RGPS sobre a folha extraída da MSC).

A interface `SuggestedEntry` foi adicionada a `types.ts` e `suggestedEntries?` a `ValidationResult`. O `pdfGenerator.ts` ganhou uma seção "Plano de Correção Contábil" com tabela de 5 colunas (descrição, débito, crédito, valor, obs).

Para regras onde não há lançamento (D1_00029–33: ICs ausentes), a orientação explica que a correção é no sistema de origem.

---

## 2026-06-25 — v3.1.0 — Auditoria QA

**Contexto:** auditoria completa com Claude Sonnet 4.6 (Lopes Consultoria) identificou 11 achados. O crítico (QA-001) era `CONTA.startsWith('62213.01')` com ponto em `rulesD2.ts` — códigos PCASP são puramente numéricos, então a condição nunca era satisfeita, forçando `mscDespesasEmpenhadas = R$0` e gerando falso erro impeditivo permanente na D2_00050.

**Bugs de alto impacto no parser de ZIP:** CSV sem detecção de encoding (`zipEntry.async('string')` assume UTF-8), XLS/XLSX silenciosamente ignorados, fallback sem validar cabeçalho `CONTA;`.

**PDF:** `buildDoc()` unificado eliminou 160 linhas de código duplicado entre `generatePDF` (browser) e `generatePDFBuffer` (Node/CLI). Layout A4 corrigido com cálculo explícito de margens (22+80+80=182mm, zero overflow). Orientações de servidor agrupadas em 1 linha.

**Testes:** de 8 para 33 testes, com cobertura das regras D1/D2 críticas.

---

## 2026-06-25 — v3.0.0 — Base atual

**Validação por período (`mscByPeriod`):** antes, múltiplos meses eram concatenados em `msc[]` gerando falsos positivos (ex.: D1_00018 acusava inconsistências entre SI de um mês e SF de outro). Agora cada mês é validado isoladamente.

**DDR:** ajustado de `721` para subgrupos `7211` × `8211` (excluindo garantias 722/822). Testado com arquivo real da PM Teixeira de Freitas (16.037 linhas) — divergência de R$87,1M detectada e confirmada ao centavo.

**API Siconfi:** integração com `getExtratoEntregas()` em D1_00001 para verificar homologação real quando o código IBGE é detectado na MSC.
