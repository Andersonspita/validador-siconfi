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
