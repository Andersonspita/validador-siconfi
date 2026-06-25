# Documentação Técnica — Validador Siconfi

> **Versão:** 3.0 · **Data:** 2026-06-25 · **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Visão Geral

O Validador Siconfi é uma **Single Page Application (SPA)** que executa validações fiscais e contábeis inteiramente no navegador do usuário — os arquivos nunca saem da máquina do cliente. A aplicação replica localmente as verificações D1–D4 do sistema SICONFI da STN (Secretaria do Tesouro Nacional), permitindo que municípios antecipem erros antes do envio oficial.

### Por que Client-Side?

| Critério | Decisão |
|---|---|
| Privacidade dos dados fiscais | Nenhum dado trafega em rede (exceto consulta opcional à API STN de entregas) |
| Custo de infraestrutura | Hospedagem estática gratuita (GitHub Pages) |
| Desempenho em volumes típicos | Parsing e validação são rápidos no browser para arquivos municipais |
| Segurança | Sem backend = sem vetor de ataque server-side |

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework UI | React | 19.x |
| Linguagem | TypeScript | 6.x |
| Bundler | Vite | 8.x |
| Parser CSV | PapaParse | 5.x |
| Parser XLS/XLSX | SheetJS (xlsx) | 0.18.x |
| Parser XML | fast-xml-parser | 5.x |
| Parser ZIP | JSZip | 3.x |
| PDF | jsPDF + jspdf-autotable | 4.x / 5.x |
| Ícones | lucide-react | 1.x |
| Autenticação | Firebase Auth | 12.x |
| Testes | Vitest | 3.x |
| Deploy | gh-pages | — |

---

## 3. Estrutura de Diretórios

```
validador-siconfi/
├── src/
│   ├── core/                         ← Lógica de negócio (sem dependência de React)
│   │   ├── types.ts                  ← Interfaces TypeScript
│   │   ├── parsers.ts                ← Leitura e conversão de arquivos
│   │   ├── pcaspRules.ts             ← Constantes PCASP externalizadas (MDF 15ª ed.)
│   │   ├── pdfGenerator.ts           ← Exportação de relatório PDF
│   │   ├── validatorEngine.ts        ← Re-export de runValidations (compatibilidade)
│   │   ├── xmlExtractors.ts          ← Extratores de valores dos demonstrativos XLS/XML
│   │   ├── rulesMetadata.ts          ← Carrega metadados das regras do CSV público
│   │   ├── parsers.test.ts           ← Testes unitários do parser
│   │   └── validators/
│   │       ├── index.ts              ← Orquestrador runValidations()
│   │       ├── rulesD1.ts            ← D1: qualidade MSC, entrega, encerramento
│   │       ├── rulesD2.ts            ← D2: consistência patrimonial, DCA
│   │       ├── rulesD3.ts            ← D3: RREO, RGF, CAPAG
│   │       ├── rulesD4.ts            ← D4: cruzamentos MSC × demonstrativos
│   │       ├── utils.ts              ← Helpers: equilíbrio D=C, somas, comparações
│   │       └── utils.test.ts         ← Testes unitários dos helpers
│   ├── components/
│   │   ├── Dropzone.tsx              ← Upload de arquivos (drag-and-drop)
│   │   ├── ReportDashboard.tsx       ← Painel de resultados, filtros e exportação
│   │   ├── Login.tsx                 ← Tela de autenticação Firebase
│   │   └── ChangePasswordModal.tsx
│   ├── services/
│   │   └── siconfiApi.ts             ← API STN (extrato de entregas)
│   ├── styles/index.css
│   ├── firebase.ts                   ← Configuração Firebase (via env vars)
│   ├── App.tsx                       ← Root component, roteamento de estados
│   └── main.tsx
├── scripts/
│   └── run-local-validation.mts      ← Validação local via CLI (ZIP/MSC)
├── public/
│   └── data/
│       ├── Descricao_verificacoes.csv    ← ~197 regras oficiais (STN)
│       └── Aplicabilidade_verificacoes.csv
├── docs/                             ← Documentação
└── dist/                             ← Build de produção (gerado)
```

---

## 4. Fluxo de Dados

```
Usuário faz upload de arquivo(s)
        ↓
parseFiles()  [parsers.ts]
  ├─ .csv  → parseMSCWithMeta()   → MSCAccount[] + período YYYY-MM + IBGE + anoReferencia
  │          (fallback encoding: UTF-8 → Windows-1252 → ISO-8859-1)
  ├─ .zip  → descomprime → processa cada entrada (CSV/XML)
  ├─ .xls  → SheetJS → XLSReport { nome_aba: rows[][] }
  └─ .xml  → fast-xml-parser → objeto hierárquico
        ↓
ParsedData { msc, mscByPeriod, mscPeriods, rreo, rgf, dca, ente, anoReferencia }
        ↓
runValidations()  [validators/index.ts]
  ├─ validateD1_Entrega()              — API Siconfi: entregas RREO/RGF/DCA (D1_00001)
  ├─ validateD1_MSC() × período        — qualidade interna da MSC (por mês)
  ├─ validateD2_MSC() × período        — consistência patrimonial + D2_MSC_EQUILIBRIO
  ├─ validateD1_Encerramento()         — VPA/VPD zerados (MSC de encerramento)
  ├─ validateD2_MSC_Encerramento_DCA() — regras de encerramento D2
  ├─ validateMultiMonth()              — regras multi-mês (D1_00016, D1_00020, etc.)
  ├─ validateMSC_CAPAG()               — regras D3 aplicáveis à MSC
  ├─ validateD2_DCA()                  — regras D2 com DCA
  ├─ validateD3_RREO()                 — verificações internas do RREO
  ├─ validateD3_Fiscal()               — cruzamentos RREO × RGF
  └─ validateD4_Cruzamentos()          — cruzamentos MSC × RREO (campo CO)
        ↓
ValidationResult[]
  → enriquece com metadados do CSV (description, impactsCapag, dimension)
        ↓
ReportDashboard — cards, filtros, exportação CSV/PDF
```

---

## 5. Formato da MSC (Matriz de Saldos Contábeis)

### Estrutura do CSV

```
2931350EX;2026-01                              ← linha 1: IBGE + exercício; período YYYY-MM
CONTA;IC1;TIPO1;IC2;TIPO2;IC3;TIPO3;IC4;TIPO4;IC5;TIPO5;IC6;TIPO6;Valor;Tipo_valor;Natureza_valor
111110100;01000;PO;F;FP;1500;FR;0000;CO;;;;;;;1500000.00;ending_balance;D
```

### Mapeamento de colunas por tipo de conta

| Coluna | TIPO | Contas patrimoniais (1xx–4xx, 7xx–8xx) | Contas de despesa (622xxx) |
|---|---|---|---|
| IC1 | PO | Poder/Órgão (5 dígitos) | Poder/Órgão (5 dígitos) |
| IC2 | FP ou FS | FP: atributo superávit financeiro (F/NF/P) | FS: função/subfunção (5 dígitos) |
| IC3 | FR | Fonte/Destinação de Recurso (4 dígitos) | Fonte/Destinação de Recurso (4 dígitos) |
| IC4 | CO | Complemento (4 dígitos) | Complemento (4 dígitos) |
| IC5 | ND | — (ausente) | Natureza da Despesa (8 dígitos) |

> **Importante:** O parser usa as colunas TIPO2 e TIPO5 para desambiguar IC2 e IC5. Se o CSV não contiver colunas TIPO (formato antigo), o parser infere pelo prefixo da CONTA: `622xxx` → FS+ND, demais → FP.

### Interface MSCAccount

```typescript
interface MSCAccount {
  CONTA: string;          // código PCASP 9 dígitos (ex: "111110100")
  PO?:   string;          // Poder/Órgão
  FP?:   string;          // atributo superávit financeiro ('F', 'NF', 'P')
  FS?:   string;          // função/subfunção (apenas contas 622xxx)
  FR?:   string;          // fonte ou destinação de recurso
  CO?:   string;          // complemento / natureza da receita
  ND?:   string;          // natureza da despesa (apenas contas 622xxx)
  Valor: number;          // sempre >= 0 (negativos = erro D1_00017)
  Tipo_valor:     'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
```

### Período e metadados

- **Período:** extraído do cabeçalho linha 1 (`YYYY-MM`). Mês > 12 ou = `0` indica MSC de encerramento.
- **Código IBGE:** 7 dígitos do cabeçalho (ex: `2931350EX` → `2931350`).
- **Ano de referência:** usado na consulta à API Siconfi (`D1_00001`).
- **mscByPeriod:** mapa `{ "2026-01": MSCAccount[], ... }` — base para validação por período.

### Encoding

O parser tenta, em ordem: UTF-8 → Windows-1252 → ISO-8859-1. Valores numéricos aceitam formato BR (`1.234,56`) e notação científica.

---

## 6. Estrutura PCASP e pcaspRules.ts

Constantes externalizadas em `src/core/pcaspRules.ts` (referência: **MDF 15ª edição**):

| Constante | Uso |
|---|---|
| `ATIVO_NATUREZA_D_PREFIXES` | D1_00021 — ativo com natureza D |
| `ATIVO_RETIFICADORA_PREFIXES` | D1_00021 — exceção depreciação (1238101/1238102) |
| `PASSIVO_NATUREZA_C_PREFIXES` | D1_00025 |
| `PL_NATUREZA_C_PREFIXES` / `PL_DEDUCAO_PREFIXES` | D1_00026 |
| `ORCAM_NATUREZA_EXCEPTION_PREFIXES` | D1_00038 — cancelamentos/estornos |
| `DDR_DEVEDORA_PREFIXES` / `DDR_CREDORA_PREFIXES` | D2_00083 — subgrupos 7211 × 8211 |
| `PROVISAO_FERIAS_13_CONTAS` | D2_00081 — 211110102/103/104 |
| `TOLERANCIA_REAIS` | Tolerância de arredondamento (R$ 0,01) |

### Classes PCASP

| Classe | Descrição | Natureza padrão |
|---|---|---|
| 1 | Ativo | Devedora (D) |
| 2 | Passivo e Patrimônio Líquido | Credora (C) |
| 3 | VPD — Variação Patrimonial Diminutiva | Devedora (D) |
| 4 | VPA — Variação Patrimonial Aumentativa | Credora (C) |
| 5 | Controles de Aprovação Orçamentária | D (despesa) / C (receita) |
| 6 | Controles de Execução Orçamentária | D (despesa) / C (receita) |
| 7 | Controles Devedores (DDR) | Devedora (D) |
| 8 | Controles Credores (DDR) | Credora (C) |

---

## 7. Motor de Validação

### Orquestração (`validators/index.ts`)

A função `runValidations(data, rulesMap)`:

1. Executa `validateD1_Entrega` (async — API Siconfi).
2. Itera `mscByPeriod`: para cada mês regular, roda D1 e D2 **isoladamente**.
3. Detecta período de encerramento e roda regras específicas.
4. Agrega MSC para regras CAPAG e multi-mês.
5. Executa D2/D3/D4 conforme arquivos disponíveis.
6. Enriquece resultados com metadados do CSV oficial.

### Regra adicional: D2_MSC_EQUILIBRIO

Implementada em `utils.ts` → `validateEquilibrioGeral()`:

- Verifica `SUM(D) = SUM(C)` por `beginning_balance`, `period_change` e `ending_balance`.
- Emite `error` se desequilibrado.

### Dimensões e arquivos

| Dimensão | Arquivo | Escopo |
|---|---|---|
| D1 | `rulesD1.ts` | Qualidade MSC, entrega (API), encerramento, multi-mês |
| D2 | `rulesD2.ts` | Consistência patrimonial, equilíbrio D=C, DCA |
| D3 | `rulesD3.ts` | RREO, RGF, CAPAG, cruzamentos fiscais |
| D4 | `rulesD4.ts` | Cruzamentos MSC × RREO (receita via campo **CO**) |

### Cobertura

O CSV oficial (`Descricao_verificacoes.csv`) lista ~197 verificações. O validador implementa a maior parte das regras **executáveis offline**. Regras que dependem exclusivamente de metadados do servidor Siconfi (D1_00002–15) são emitidas como orientação (`info`).

Principais regras por dimensão — ver `docs/STATUS_PROJETO.md` para lista completa e pendências.

---

## 8. xmlExtractors.ts — API de Referência

### Funções base

```typescript
findValueInSheet(sheet, term, offset?)
findValueInSection(sheet, sectionTerm, valueTerm, maxLines?)
getSheet(report, candidates[])
extractFromReport(report, sheetCandidates, searchTerm, colOffset?)
```

### Extratores exportados (amostra)

```typescript
// RCL / DCL
getRCLFromRREO(rreo) / getRCLFromRGF(rgf)
getDCL_RREO_A06(rreo) / getDCL_RGF_A02(rgf)

// Equilíbrio orçamentário (D3_00001)
getEquilibrioOrcamentario(rreo)

// Despesas (D3_00002)
getTotalDespesasAnexo01(rreo) / getDespesasAnexo02(rreo)

// RPPS, transferências, valores negativos
getTotalReceitasRPPS_A04(rreo)
getTransfEmendasIndividuais_RREO_A03(rreo)
findNegativeValues(report)
findNegativosRP_A07(rreo)

// Metadados
extractXLSMetadata(report)  // { ente, periodo, exercicio }
```

---

## 9. Helpers de Comparação (`validators/utils.ts`)

| Função | Uso |
|---|---|
| `validateEquilibrioGeral(msc, period?)` | D2_MSC_EQUILIBRIO — SUM(D)=SUM(C) |
| `validatePairEquality(...)` | Compara dois valores; retorna `[]` se algum for `null` |
| `validateTripleEquality(...)` | Compara três fontes |
| `sumByTipoValor(msc, tipo, natureza?)` | Soma contábil por tipo de saldo |
| `isRegularMonthPeriod(period)` | Distingue mês regular de encerramento |
| `findEncerramentoPeriod(mscByPeriod)` | Localiza chave de encerramento |

---

## 10. Exportação PDF (`pdfGenerator.ts`)

Gera relatório via jsPDF com:

- Separação Erros / Avisos / Informativos
- Tags `[IMPEDITIVO]` e `[RISCO CAPAG]`
- Coluna **Plano de Ação Corretiva**
- `detailedItems` expandidos quando disponíveis
- Nome do arquivo: `relatorio_{IBGE}_{periodo}_{timestamp}.pdf`
- Rodapé com `MDF_VERSION` de `pcaspRules.ts`

---

## 11. API Siconfi (`services/siconfiApi.ts`)

Usada por `validateD1_Entrega` (D1_00001):

- Endpoint: `apidatalake.tesouro.gov.br` (extrato de entregas)
- Proxy CORS: `corsproxy.io` (necessário em ambiente client-side)
- Entrada: código IBGE (7 dígitos) + exercício (`anoReferencia` da MSC)
- Saída: verificação de entrega de RREO, RGF, DCA, MSC

---

## 12. Como Adicionar uma Nova Regra

1. **Identifique** o ID em `public/data/Descricao_verificacoes.csv`
2. **Verifique** o campo `no_declaracao` para saber quais arquivos são necessários
3. **Se precisar extrair valor de XLS**, adicione extrator em `xmlExtractors.ts`
4. **Implemente a regra** no arquivo correto:
   - MSC pura → `rulesD1.ts` ou `rulesD2.ts`
   - MSC encerramento → `validateD1_Encerramento()` / `validateD2_MSC_Encerramento_DCA()`
   - Apenas RREO → `rulesD3.ts`
   - RREO + RGF → `validateD3_Fiscal()` em `rulesD3.ts`
   - MSC + RREO → `rulesD4.ts`
5. **Constantes PCASP** → preferir `pcaspRules.ts` em vez de hardcode
6. **Use helpers** de `utils.ts` para comparações e equilíbrio
7. **Adicione teste** em `utils.test.ts` ou `parsers.test.ts` se aplicável
8. **Atualize** `docs/STATUS_PROJETO.md`
9. **Verifique tipos**: `npx tsc --noEmit` · **Testes**: `npm test`

### Severidades

| Valor | Quando usar |
|---|---|
| `'error'` | Viola critério obrigatório — impede envio ou causa rejeição |
| `'warning'` | Possível problema que reduz a nota de qualidade |
| `'info'` | Orientação ou informação sem impacto direto na nota |

---

## 13. Testes

```bash
npm test                    # Vitest — parsers.test.ts + utils.test.ts
npx tsx scripts/run-local-validation.mts "arquivo.zip"   # validação E2E local
```

Cobertura atual:
- Parser MSC: encoding, IBGE, período, formatos numéricos
- Utils: equilíbrio D=C, helpers de comparação

---

## 14. Firebase — Autenticação

Credenciais lidas exclusivamente de variáveis de ambiente Vite (nunca hardcoded):

```env
# arquivo .env (raiz do projeto — NÃO commitar)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Para GitHub Pages, as variáveis precisam estar disponíveis no momento do `npm run build`.

---

## 15. Build e Deploy

```bash
npm install          # instalar dependências
npm run dev          # servidor dev → http://localhost:5173
npm test             # testes unitários
npx tsc --noEmit     # verificar tipos
npm run build        # build produção → /dist
npm run deploy       # publicar no GitHub Pages
```

> **Nota WSL:** O build pode falhar com `EPERM` ao copiar para `dist`.
> Solução: `rm -rf dist && npm run build`.

---

## 16. Limitações Conhecidas

| Limitação | Impacto | Próximo passo |
|---|---|---|
| D1_00002–D1_00015 (tempestividade exata) | Parcial — API retorna homologação, não prazo legal | Expandir lógica de prazos LRF |
| Regras D2 de encerramento MSC×DCA (ex.: D2_00069–74) | Não implementadas | Extratores DCA + MSC encerramento |
| Regras multi-mês avançadas | Parcial — D1_00016/20 implementadas | D2_00077/79/82/86–88 |
| `findValueInSheet` retorna 1ª coluna numérica | Regras com coluna específica ficam imprecisas | Extrator por índice de coluna |
| RREO/RGF em formato XML | Validações XLS não se aplicam | Extratores XML |
| MSC > 50k linhas | Pode degradar performance no browser | Web Workers / chunking |
| Firebase no GitHub Pages | Login depende de env vars no build | Configurar secrets no CI |

---

## 17. Histórico de mudanças arquiteturais

### Jun/2026 — Auditoria QA e refatoração

- Validação **por período** via `mscByPeriod` (evita duplicatas e falsos positivos)
- `validateEquilibrioGeral()` — regra `D2_MSC_EQUILIBRIO`
- DDR corrigido: subgrupos **7211 × 8211** (não 721/821)
- D4: cruzamentos de receita usam campo **CO**, não `Natureza_valor`
- Constantes PCASP externalizadas em `pcaspRules.ts`
- `pdfGenerator.ts` — export PDF com metadados e plano de ação
- Testes Vitest + script CLI `run-local-validation.mts`
- Removidas regras D2 fictícias que marcavam validação sem lógica real
- Integração API Siconfi em `rulesD1.ts` via `siconfiApi.ts`

### Jun/2026 (inicial) — Modularização

- `validatorEngine.ts` delegado para `validators/rulesD1–4.ts`
- Extratores centralizados em `xmlExtractors.ts`
- Metadados IBGE/ano acoplados em `parsers.ts`
