# Status do Projeto — Validador Siconfi

> **Última atualização:** 26 de Junho de 2026 (v3.5.0)  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Resumo executivo

O **Validador Siconfi** é uma SPA React/TypeScript que executa validações fiscais e contábeis **no navegador**, replicando regras D1–D4 do SICONFI (STN) e gerando relatórios analíticos de execução orçamentária. Nenhum arquivo financeiro sai da máquina do usuário. Firebase é opcional — sem credenciais, o app abre diretamente sem login.

---

## 2. O que está pronto

| Área | Status |
|------|--------|
| Upload MSC / RREO / RGF / DCA / ZIP | ✅ |
| Parser MSC (UTF-8, Windows-1252, IBGE 7 dígitos, múltiplos meses) | ✅ |
| XLS/XLSX dentro de ZIP | ✅ v3.1.0 |
| Detecção de encoding para CSV em ZIP | ✅ v3.1.0 |
| Validação D1 — 24 regras | ✅ |
| Validação D2 — 38 regras | ✅ |
| Validação D3 — 11 regras | ✅ |
| Validação D4 — 10 regras | ✅ |
| **Total: 99 regras implementadas** | ✅ |
| Equilíbrio geral MSC D=C (beginning / period / ending) | ✅ |
| D2_00083 DDR com `impactsCapag: true` + justificativa normativa | ✅ v3.3.0 |
| Lançamentos PCASP corretivos por regra (`correctiveEntries.ts`) | ✅ v3.2.0 |
| Relatório PDF com seção "Plano de Correção Contábil" | ✅ v3.2.0 |
| **Relatórios de Execução Orçamentária com drill-down** | ✅ v3.4.0 |
| Upload multi-arquivo com painel de cobertura por tipo | ✅ v3.5.0 |
| Segurança: browserSessionPersistence + inatividade 30min | ✅ v3.5.0 |
| Assistente IA (OpenAI) com contexto dinâmico | ✅ v3.5.0 |
| CAPAG estimado A/B/C (3 indicadores) | ✅ v3.5.0 |
| CAUC com links para portais oficiais | ✅ v3.5.0 |
| Limites LRF: Pessoal, ARO, Op. Crédito | ✅ v3.5.0 |
| Exportação CSV (validações e relatórios) | ✅ |
| API Siconfi — extrato de entregas (D1_00001) | ✅ parcial |
| Testes Vitest — 33 testes (4 arquivos) | ✅ |
| Script CLI `test-and-pdf.mts` | ✅ v3.2.0 |
| Deploy GitHub Pages | ✅ |
| Firebase opcional (sem .env = sem crash) | ✅ v3.3.0 |

---

## 3. Arquivos críticos

| Arquivo | Função |
|---------|--------|
| `src/core/parsers.ts` | Leitura CSV/XLS/XML/ZIP → `ParsedData` |
| `src/core/pcaspRules.ts` | Constantes PCASP externalizadas (MDF 15ª ed.) |
| `src/core/types.ts` | Interfaces TypeScript (incl. `SuggestedEntry`) |
| `src/core/correctiveEntries.ts` | Lançamentos PCASP D/C sugeridos por regra |
| `src/core/reportEngine.ts` | Motor de relatórios de execução orçamentária |
| `src/core/pdfGenerator.ts` | Relatório PDF com `buildDoc()` unificado |
| `src/core/validators/index.ts` | Orquestrador `runValidations()` |
| `src/core/validators/rulesD1.ts` … `rulesD4.ts` | Regras por dimensão |
| `src/core/validators/utils.ts` | Helpers: equilíbrio D=C, somas, comparações |
| `src/core/xmlExtractors.ts` | Extração de valores RREO/RGF/DCA |
| `src/core/rulesMetadata.ts` | Carrega descrições oficiais (CSV opcional) |
| `src/services/siconfiApi.ts` | API STN — extrato de entregas |
| `src/firebase.ts` | Firebase opcional (init condicional) |
| `src/components/ReportDashboard.tsx` | Painel principal com abas |
| `src/components/ReportView.tsx` | Tabela de relatórios com drill-down |
| `scripts/test-and-pdf.mts` | CLI: valida ZIP + gera PDF |

---

## 4. Cobertura de regras

O CSV oficial lista **~197 verificações**. O validador cobre **99 regras** (as passíveis de execução offline).

| Categoria | Comportamento |
|-----------|---------------|
| Regras com lógica matemática/contábil | Implementadas em `rulesD1`–`rulesD4` |
| Regras que exigem metadados do servidor SICONFI | Emitidas como `[ORIENTAÇÃO]` (`info`) |
| Regras de encerramento D2_00069–74 | ❌ Pendentes |

---

## 5. Relatórios de Execução (v3.4.0)

Motor extraído de `reportEngine.ts` que agrega contas 622xxx da MSC:

| Agrupamento | Descrição |
|-------------|-----------|
| Função | 2 primeiros dígitos do FS (ex.: 10 = Saúde) |
| Função/Subfunção | Código FS completo (ex.: 10301 = Atenção Básica) |
| Fonte de Recurso | Campo FR (ex.: 1500, 1540, 1550) |
| Natureza de Despesa | 6 primeiros dígitos do ND |
| Órgão/Poder | Campo PO |

**Estágios de execução (PCASP):**
- Empenhado = conta `622130100` (net C−D)
- Liquidado = contas `622130200`, `622130300`, `622130400` (net C−D)
- Pago = contas `622130300`, `622130400` (net C−D)

**Drill-down:** Função → Subfunção → Fonte de Recurso (com breadcrumb)  
**Toggle:** Movimentação (`period_change`) × Acumulado (`ending_balance`)

---

## 6. Testes

```bash
npm test      # 33 testes Vitest (4 arquivos)
```

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `parsers.test.ts` | 3 | Encoding, IBGE, notação científica |
| `validators/utils.test.ts` | 6 | Equilíbrio D=C, DDR, contas invertidas |
| `validators/rulesD1.test.ts` | 14 | D1_00017/18/21/22/23/24/31 |
| `validators/rulesD2.test.ts` | 10 | D2_00050/55/81/83 |

---

## 7. Pendências conhecidas

| Item | Prioridade | Notas |
|------|------------|-------|
| Regras D2 de encerramento (D2_00069–74 MSC×DCA) | Média | Requer extratores DCA + MSC encerramento |
| Tempestividade exata (prazos LRF por bimestre) | Baixa | API retorna homologação, não prazo legal |
| Lançamentos corretivos para regras D3/D4 | Baixa | `correctiveEntries.ts` cobre D1/D2 hoje |
| Firebase CI/CD (secrets no GitHub Actions) | Baixa | Funciona sem auth no GitHub Pages |
| CSV `Descricao_verificacoes.csv` no repo | Baixa | Excluído por `*.csv` no .gitignore |
| Relatórios: comparação com RREO Anexo 02 (D4) | Futura | Cross-validação de valores |

---

## 8. Histórico de versões

### v3.5.0 — 2026-06-26
- Dropzone: painel de cobertura explicando quais arquivos enviar e o que cada um habilita
- Segurança: browserSessionPersistence (fechar aba = logout) + timer inatividade 30min
- AIChat: sempre visível (bottom-right), contexto dinâmico, sugestões gerais sem arquivo
- CAPAG: cálculo estimado A/B/C dos 3 indicadores a partir da MSC
- CAUC: painel informativo com links oficiais (sem API pública disponível)
- LRF: 6 novas regras — Pessoal (60%/54%/6%), ARO (7%), Op. Crédito (16%)
- PDF: observações sem truncamento, colunas otimizadas
- Correções tema claro: botões, segmented control, CAUC
- TransfereGov URL corrigida para portal.transferegov.sistema.gov.br

### v3.4.0 — 2026-06-26
- `reportEngine.ts`: motor de relatórios de execução orçamentária
- `ReportView.tsx` + `ReportView.css`: tabela com drill-down e breadcrumb
- `ReportDashboard.tsx`: aba "Relatórios de Execução" ao lado de "Validações"
- Export CSV por visão/agrupamento no relatório

### v3.3.0 — 2026-06-26
- Firebase opcional (init condicional; app abre sem .env)
- D2_00083 `impactsCapag: true` com justificativa normativa (Portaria MF 1.583/2023)
- Tela em branco no GitHub Pages corrigida

### v3.2.0 — 2026-06-26
- `correctiveEntries.ts`: lançamentos PCASP corretivos por regra
- PDF: seção "Plano de Correção Contábil"
- `scripts/test-and-pdf.mts`: CLI completo

### v3.1.0 — 2026-06-25
- 9 correções QA (1 crítico, 3 altos, 5 médios/baixos)
- 33 testes Vitest
- `buildDoc()` unificado; layout A4 sem overflow

### v3.0.0 — 2026-06-25
- Validação por período; equilíbrio D=C; DDR 7211×8211
- Constantes PCASP externalizadas; integração API Siconfi

---

## 9. Comandos úteis

```bash
npm run dev          # desenvolvimento → http://localhost:5173
npm test             # 33 testes Vitest
npx tsc --noEmit     # verificar tipos TypeScript
npm run build        # build de produção → /dist
npm run deploy       # publicar no GitHub Pages
npx tsx scripts/test-and-pdf.mts arquivo.zip   # validar + gerar PDF
```
