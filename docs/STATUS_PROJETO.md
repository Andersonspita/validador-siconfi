# Status do Projeto — Validador Siconfi

> **Última atualização:** 26 de Junho de 2026 (v3.3.0)  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Resumo executivo

O **Validador Siconfi** é uma SPA React/TypeScript que executa validações fiscais e contábeis **no navegador**, replicando regras D1–D4 do SICONFI (STN). Nenhum arquivo financeiro é enviado a servidores próprios. A aplicação detecta automaticamente se o Firebase está configurado — sem credenciais, funciona em modo aberto (sem login).

---

## 2. O que está pronto

| Área | Status |
|------|--------|
| Upload MSC / RREO / RGF / DCA / ZIP | ✅ |
| Parser MSC (UTF-8, Windows-1252, IBGE 7 dígitos, múltiplos meses) | ✅ |
| XLS/XLSX dentro de ZIP | ✅ v3.1.0 |
| Detecção de encoding para CSV em ZIP | ✅ v3.1.0 |
| Validação D1 (qualidade MSC, entrega, encerramento) | ✅ 24 regras |
| Validação D2 (consistência patrimonial, DCA) | ✅ 38 regras |
| Validação D3 (RREO, RGF, CAPAG) | ✅ 11 regras |
| Validação D4 (cruzamentos MSC × RREO/RGF/DCA) | ✅ 10 regras |
| **Total: 99 regras implementadas** | ✅ |
| Equilíbrio geral MSC D=C (beginning / period / ending) | ✅ |
| DDR (7211 × 8211) com flag `impactsCapag: true` | ✅ v3.3.0 |
| Lançamentos PCASP corretivos por regra | ✅ v3.2.0 |
| Relatório PDF com seção "Plano de Correção Contábil" | ✅ v3.2.0 |
| Exportação CSV | ✅ |
| API Siconfi — extrato de entregas (D1_00001) | ✅ parcial |
| Testes Vitest (parser + utils + rulesD1 + rulesD2) | ✅ 33 testes |
| Script CLI `test-and-pdf.mts` | ✅ v3.2.0 |
| Deploy GitHub Pages | ✅ |
| Firebase opcional (app abre sem .env) | ✅ v3.3.0 |

---

## 3. Arquivos críticos

| Arquivo | Função |
|---------|--------|
| `src/core/parsers.ts` | Leitura CSV/XLS/XML/ZIP → `ParsedData` |
| `src/core/pcaspRules.ts` | Constantes PCASP externalizadas (MDF 15ª ed.) |
| `src/core/types.ts` | Interfaces TypeScript (incl. `SuggestedEntry`) |
| `src/core/correctiveEntries.ts` | Lançamentos PCASP D/C sugeridos por regra |
| `src/core/pdfGenerator.ts` | Relatório PDF com `buildDoc()` unificado |
| `src/core/validators/index.ts` | Orquestrador `runValidations()` |
| `src/core/validators/rulesD1.ts` … `rulesD4.ts` | Implementação das regras por dimensão |
| `src/core/validators/utils.ts` | Helpers: equilíbrio D=C, somas, comparações |
| `src/core/xmlExtractors.ts` | Extração de valores de planilhas RREO/RGF/DCA |
| `src/core/rulesMetadata.ts` | Carrega descrições oficiais das regras (CSV) |
| `src/services/siconfiApi.ts` | API STN (extrato de entregas) |
| `src/firebase.ts` | Firebase opcional (init condicional) |
| `scripts/test-and-pdf.mts` | Teste local via CLI: valida ZIP e gera PDF |

---

## 4. Cobertura de regras

O CSV oficial lista **~197 verificações**. O validador cobre **99 regras** (as passíveis de execução offline).

| Categoria | Comportamento |
|-----------|---------------|
| Regras com lógica matemática/contábil | Implementadas em `rulesD1`–`rulesD4` |
| Regras que exigem metadados do servidor SICONFI | Emitidas como `[ORIENTAÇÃO]` (`info`) |
| Regras de encerramento D2_00069–74 | ❌ Pendentes (ver seção 6) |

---

## 5. Testes

```bash
npm test      # 33 testes Vitest (4 arquivos)
```

| Arquivo | Testes | O que cobre |
|---------|--------|-------------|
| `parsers.test.ts` | 3 | Encoding, IBGE, notação científica |
| `validators/utils.test.ts` | 6 | Equilíbrio D=C, DDR, invertidas |
| `validators/rulesD1.test.ts` | 14 | D1_00017/18/21/22/23/24/31 |
| `validators/rulesD2.test.ts` | 10 | D2_00050/55/81/83 |

---

## 6. Pendências conhecidas

| Item | Prioridade | Notas |
|------|------------|-------|
| Regras D2 de encerramento (D2_00069–74 MSC×DCA) | Média | Requer extratores DCA + MSC encerramento |
| Tempestividade exata (prazos LRF por bimestre) | Baixa | API retorna homologação, não prazo legal |
| D1_00038 — volume de avisos em contas 5/6 | Baixa | Expandir lista de exceções em `pcaspRules.ts` |
| Lançamentos corretivos para mais regras D3/D4 | Baixa | `correctiveEntries.ts` cobre D1/D2 hoje |
| Firebase CI/CD (secrets no GitHub Actions) | Baixa | Hoje funciona sem auth no GitHub Pages |
| CSV `Descricao_verificacoes.csv` no repo | Baixa | Excluído por `*.csv` no .gitignore; app funciona sem ele |

---

## 7. Histórico de versões

### v3.3.0 — 2026-06-26
- `firebase.ts`: inicialização condicional — sem env vars, app abre sem login
- `App.tsx`: pula auth quando Firebase não configurado; `rulesMap` inicia como `Map` vazio
- `rulesMetadata.ts`: fetch com `.catch()` → Map vazio se CSV não existe (sem crash)
- `Login.tsx`, `ChangePasswordModal.tsx`: `auth!` non-null assertion onde Firebase garantido
- D2_00083 DDR: `impactsCapag: false` → **`true`** + mensagem explica impacto no IL/CAPAG e Ranking ICF (Portaria MF 1.583/2023)

### v3.2.0 — 2026-06-26
- `correctiveEntries.ts`: 14 regras mapeadas a lançamentos PCASP D/C (DDR, férias, depreciação, RPPS/RGPS, etc.)
- `types.ts`: interface `SuggestedEntry` + campo `suggestedEntries?` em `ValidationResult`
- `pdfGenerator.ts`: seção "Plano de Correção Contábil" com tabela D/C por regra
- `scripts/test-and-pdf.mts`: CLI para validação e geração de PDF sem browser

### v3.1.0 — 2026-06-25
- QA-001 [Crítico]: D2_00050 com ponto no código de conta corrigido
- QA-002/003/004: encoding CSV em ZIP, XLS/XLSX em ZIP, fallback sem validação
- QA-005/006: D1_00018 mensagem melhorada; D1_00023/24 comparação via Map
- QA-007: rulesD1.test.ts + rulesD2.test.ts (33 testes total)
- QA-010/011: affectedAccounts via constantes; cellDates no XLSX.read
- `pdfGenerator.ts`: buildDoc() unificado, layout A4 sem overflow, orientações compactadas

### v3.0.0 — 2026-06-25
- Equilíbrio D=C por tipo de saldo; MSC por período; DDR 7211×8211
- D1_00021 excluindo depreciação; D2_00081 com 13º proporcional
- Parser com fallback de encoding; PDF com MDF version

---

## 8. Comandos úteis

```bash
npm run dev          # desenvolvimento → http://localhost:5173
npm test             # 33 testes Vitest
npx tsc --noEmit     # verificar tipos TypeScript
npm run build        # build de produção → /dist
npm run deploy       # publicar no GitHub Pages
npx tsx scripts/test-and-pdf.mts arquivo.zip  # validar localmente + gerar PDF
```
