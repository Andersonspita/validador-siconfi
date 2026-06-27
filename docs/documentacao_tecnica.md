# Documentação Técnica — Validador Siconfi

> **Versão:** 3.5.0 · **Data:** 2026-06-26  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Visão Geral

SPA React/TypeScript que executa validações D1–D4 do SICONFI e gera relatórios analíticos de execução orçamentária, inteiramente no navegador — nenhum dado financeiro sai da máquina do usuário.

### Por que Client-Side?

| Critério | Decisão |
|---|---|
| Privacidade | Nenhum dado trafega em rede (exceto consulta opcional à API STN) |
| Custo | Hospedagem estática gratuita (GitHub Pages) |
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
| Autenticação | Firebase Auth (opcional) | 12.x |
| Testes | Vitest | 3.x |
| Deploy | gh-pages | — |

---

## 3. Estrutura de Diretórios

```
validador-siconfi/
├── src/
│   ├── core/
│   │   ├── types.ts                   ← Interfaces TypeScript (incl. SuggestedEntry)
│   │   ├── parsers.ts                 ← Leitura CSV/XLS/XML/ZIP → ParsedData
│   │   ├── pcaspRules.ts              ← Constantes PCASP (MDF 15ª ed.)
│   │   ├── correctiveEntries.ts       ← Lançamentos PCASP D/C sugeridos por regra
│   │   ├── reportEngine.ts            ← Motor de relatórios de execução orçamentária
│   │   ├── pdfGenerator.ts            ← Relatório PDF (buildDoc unificado)
│   │   ├── rulesMetadata.ts           ← Metadados do CSV oficial STN (opcional)
│   │   ├── xmlExtractors.ts           ← Extratores de valores RREO/RGF/DCA
│   │   ├── validatorEngine.ts         ← Re-export de runValidations (compatibilidade)
│   │   ├── parsers.test.ts            ← 3 testes do parser
│   │   └── validators/
│   │       ├── index.ts               ← Orquestrador runValidations()
│   │       ├── rulesD1.ts             ← D1: qualidade MSC, entrega, encerramento
│   │       ├── rulesD2.ts             ← D2: consistência patrimonial, DCA
│   │       ├── rulesD3.ts             ← D3: RREO, RGF, CAPAG
│   │       ├── rulesD4.ts             ← D4: cruzamentos MSC × demonstrativos
│   │       ├── utils.ts               ← Helpers: equilíbrio D=C, somas
│   │       ├── utils.test.ts          ← 6 testes dos helpers
│   │       ├── rulesD1.test.ts        ← 14 testes das regras D1
│   │       └── rulesD2.test.ts        ← 10 testes das regras D2
│   ├── components/
│   │   ├── Dropzone.tsx               ← Upload com painel de cobertura por arquivo
│   │   ├── ReportDashboard.tsx        ← Painel principal (abas Validações + Relatórios)
│   │   ├── ReportView.tsx             ← Tabela de relatórios com drill-down
│   │   ├── ReportView.css
│   │   ├── ReportDashboard.css
│   │   ├── Login.tsx                  ← Autenticação (só quando Firebase ativo)
│   │   └── ChangePasswordModal.tsx
│   ├── services/
│   │   └── siconfiApi.ts              ← API STN — extrato de entregas
│   ├── firebase.ts                    ← Init condicional (sem env vars = sem crash)
│   ├── App.tsx                        ← Root: auth condicional, carregamento de regras
│   └── main.tsx
├── scripts/
│   ├── run-local-validation.mts       ← CLI simples (terminal)
│   └── test-and-pdf.mts               ← CLI: valida ZIP + gera PDF
├── public/
│   └── data/
│       └── Descricao_verificacoes.csv ← ~197 regras STN (não versionado)
└── docs/
    ├── STATUS_PROJETO.md
    ├── documentacao_tecnica.md
    ├── manual_do_usuario.md
    └── diario_de_implementacao.md
```

---

## 4. Fluxo de Dados

```
File[] (upload)
    └── parseFiles()              ← parsers.ts
        ├── CSV → parseMSCWithMeta()   (encoding: UTF-8 → cp1252 → iso-8859-1)
        ├── ZIP → extrai CSV/XML/XLS   (com encoding detection)
        ├── XLS/XLSX → SheetJS.read()  (cellDates: true)
        └── XML → fast-xml-parser
            ↓
        ParsedData { msc, mscByPeriod, mscPeriods, rreo, rgf, dca, enteId }
            ├── runValidations()       ← validators/index.ts
            │   ├── D1: entrega, qualidade MSC, encerramento
            │   ├── D2: consistência patrimonial, DCA, equilíbrio D=C
            │   ├── D3: RREO, RGF, CAPAG
            │   ├── D4: cruzamentos MSC × demonstrativos
            │   ├── enriquecer com rulesMap (descrições STN)
            │   └── enrichWithCorrectiveEntries()  ← correctiveEntries.ts
            │       ↓
            │   ValidationResult[]
            │       ├── ReportDashboard → aba "Validações"
            │       └── generatePDF() / generatePDFBuffer()
            │
            └── gerarRelatorio()       ← reportEngine.ts (aba "Relatórios")
                ├── Filtra contas 622xxx com FS preenchido
                ├── Agrupa por Função / Subfunção / Fonte / ND / Órgão
                ├── Calcula Empenhado / Liquidado / Pago
                └── ReportView (tabela + drill-down)
```

---

## 5. Tipos Principais (`types.ts`)

### `MSCAccount`
```typescript
interface MSCAccount {
  CONTA: string;           // Código PCASP (ex.: '111111900')
  PO?: string;             // IC1: Poder/Órgão
  FP?: string;             // IC2: Fundo Previdenciário
  FS?: string;             // IC2: Função/Subfunção (ex.: '12361')
  FR?: string;             // IC3: Fonte de Recurso (ex.: '1500')
  CO?: string;             // IC4: Classificação Orçamentária
  ND?: string;             // IC5: Natureza de Despesa
  Valor: number;
  Tipo_valor: 'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
```

### `ValidationResult`
```typescript
interface ValidationResult {
  ruleId: string;
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  description: string;
  severity: 'error' | 'warning' | 'info';
  impactsCapag: boolean;
  affectedAccounts?: string[];
  detailedItems?: DetailedItem[];
  message: string;
  actionPlan?: string;
  suggestedEntries?: SuggestedEntry[];   // lançamentos PCASP corretivos
}
```

### `SuggestedEntry`
```typescript
interface SuggestedEntry {
  descricao: string;
  debito:  { conta: string; descricao: string };
  credito: { conta: string; descricao: string };
  valor?: number;
  obs?: string;
}
```

### `ReportRow` (reportEngine)
```typescript
interface ReportRow {
  chave: string;        // valor do agrupamento (ex.: '12', '12361', '1500')
  label: string;        // descrição legível
  empenhado: number;
  liquidado: number;
  pago: number;
  hasChildren: boolean; // se tem drill-down disponível
}
```

---

## 6. Parser MSC (`parsers.ts`)

| Função | Descrição |
|--------|-----------|
| `parseFiles(files)` | Ponto de entrada: `File[]` → `ParsedData` |
| `parseMSCWithMeta(csvText)` | Parser CSV com extração de período e enteId |
| `readTextWithEncoding(file)` | Lê `File` com fallback UTF-8 → cp1252 → iso-8859-1 |
| `decodeTextFromBytes(bytes)` | Variante para `Uint8Array` (ZIP e testes) |

**Detecção de encoding:** tenta três encodings em sequência verificando `CONTA;`. Se nenhum funcionar, lança `Error` explícito.

**Arquivos em ZIP:** `.csv` via `decodeTextFromBytes()`, `.xls/.xlsx` via SheetJS `{ type:'array', cellDates:true }`, `.xml` via `fast-xml-parser`.

---

## 7. Motor de Relatórios (`reportEngine.ts`)

### Função principal

```typescript
gerarRelatorio(
  msc: MSCAccount[],
  agrupamento: Agrupamento,       // 'funcao' | 'subfuncao' | 'fonte' | 'natureza' | 'orgao'
  tipoSaldo: TipoSaldo,           // 'period_change' | 'ending_balance'
  filtros?: { funcao?, subfuncao?, fonte?, orgao? }
): ReportResult
```

### Mapeamento de contas PCASP

| Estágio | Contas |
|---------|--------|
| Empenhado | `622130100` (net C−D) |
| Liquidado | `622130200`, `622130300`, `622130400` (net C−D) |
| Pago | `622130300`, `622130400` (net C−D) |

### Drill-down

```
Função (2 dígitos FS)
  └── Subfunção (5 dígitos FS)
        └── Fonte de Recurso (FR)
```

### Mapa de Funções

Tabela de 28 funções orçamentárias brasileiras (01-Legislativa … 28-Encargos Especiais) definida em `FUNCOES` no `reportEngine.ts`.

---

## 8. Constantes PCASP (`pcaspRules.ts`)

```typescript
MDF_VERSION                    = 'MDF 15ª edição'
ATIVO_NATUREZA_D_PREFIXES      = ['1111','1121','1125','1231','1232']
ATIVO_RETIFICADORA_PREFIXES    = ['1238101','1238102','1238']
PASSIVO_NATUREZA_C_PREFIXES    = ['2111','2112',...]
PL_DEDUCAO_PREFIXES            = ['2312','2321',...]
ORCAM_NATUREZA_EXCEPTION_PREFIXES = ['6213201','6229201',...]
DDR_DEVEDORA_PREFIXES          = ['7211']
DDR_CREDORA_PREFIXES           = ['8211']
PROVISAO_FERIAS_13_CONTAS      = ['211110102','211110103','211110104']
TOLERANCIA_REAIS               = 0.01
```

---

## 9. Motor de Validação (`validators/index.ts`)

`runValidations()` executa em sequência:

1. `validateD1_Entrega()` — API STN opcional
2. Por período em `mscByPeriod`: `validateD1_MSC()` + `validateD2_MSC()`
3. Se encerramento: `validateD1_Encerramento()`, `validateD2_MSC_Encerramento_DCA()`
4. `validateMSC_CAPAG()`
5. `validateMultiMonth()` — D1_00020/23/24 + D2_00077
6. `validateD2_DCA()` — se DCA presente
7. `validateD3_RREO()`, `validateD3_Fiscal()`
8. `validateD4_Cruzamentos()`
9. Enriquecer com `rulesMap`
10. `enrichWithCorrectiveEntries()` — lançamentos PCASP

---

## 10. Lançamentos Corretivos (`correctiveEntries.ts`)

| Regra | Lançamento |
|-------|-----------|
| D2_00083 | D 721110000 / C 821110000 pelo valor exato da divergência DDR |
| D2_00081 | D 311210103 / C 211110102 (férias); estimativa 8% folha |
| D2_00067/68 | Estorno excesso depreciação bens móveis/imóveis |
| D2_00055 | Estorno excesso amortização intangível |
| D2_00094 | INSS patronal RPPS estimativa 22% |
| D2_00095 | INSS 20% + FGTS 8% sobre folha RGPS |
| D1_00021 | Orientação: reclassificar para conta retificadora |
| D1_00025 | Orientação: regularizar saldo D no passivo |
| D1_00029–33 | Orientação: atualizar IC no sistema contábil |
| D2_00030/31 | Estorno do lançamento com saldo negativo |

---

## 11. Gerador de PDF (`pdfGenerator.ts`)

`buildDoc()` — função interna unificada:

1. Cabeçalho com ente, período, MDF version
2. Caixas coloridas (impeditivos / avisos / orientações)
3. Tabela de Erros Críticos `[IMPEDITIVO]`
4. Tabela de Avisos `[AVISO]`
5. Orientações de servidor compactadas (1 linha + link siconfi.tesouro.gov.br)
6. **Seção "Plano de Correção Contábil"** — lançamentos D/C por regra

**Layout A4:** `22 + 80 + 80 = 182mm` (zero overflow).

| Função | Uso |
|--------|-----|
| `generatePDF(results, meta)` | Browser: download automático |
| `generatePDFBuffer(results, meta)` | Node/CLI: retorna `ArrayBuffer` |

> O PDF inclui apenas os resultados visíveis no filtro ativo do dashboard. Selecionar "Todas as Regras" para relatório completo.

---

## 12. D2_00083 — DDR e CAPAG

`impactsCapag: true` por dois canais:

**Canal 1 — Indicador de Liquidez (IL):** O CAPAG usa apenas disponibilidades de fontes não vinculadas. As contas 721/821 fazem essa separação — DDR desequilibrado distorce o IL diretamente.

**Canal 2 — Ranking ICF (Portaria MF 1.583/2023):** Erros impeditivos degradam o Ranking. Entes com nota Eicf já estão bloqueados; Dicf bloqueado a partir de 2026.

---

## 13. Firebase (`firebase.ts`)

```typescript
export const isFirebaseConfigured =
  !!VITE_FIREBASE_API_KEY && !!VITE_FIREBASE_PROJECT_ID && !!VITE_FIREBASE_APP_ID;
export const auth = isFirebaseConfigured ? getAuth(app) : null;
```

Sem Firebase: app abre diretamente, botões de logout/senha ocultados.

```env
# .env (não commitar)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## 14. Componente ReportView (`ReportView.tsx`)

| Prop | Tipo | Descrição |
|------|------|-----------|
| `msc` | `MSCAccount[]` | Dados da MSC (todos os períodos concatenados) |
| `periodos` | `string[]` | Lista de períodos detectados (ex.: `['2026-01']`) |

**Estado interno:**
- `agrupamentoBase`: agrupamento selecionado no segmented control
- `tipoSaldo`: `'period_change'` ou `'ending_balance'`
- `stack`: pilha de níveis de drill-down (breadcrumb)

**Comportamento de drill-down:**
```
Função → clique → Subfunção → clique → Fonte de Recurso
                  (breadcrumb permite voltar a qualquer nível)
```

---

## 15. Testes

```bash
npm test                                           # 33 testes Vitest
npx tsc --noEmit                                   # verificar tipos
npx tsx scripts/test-and-pdf.mts arquivo.zip       # E2E + PDF
```

| Arquivo | Testes |
|---------|--------|
| `parsers.test.ts` | 3 |
| `validators/utils.test.ts` | 6 |
| `validators/rulesD1.test.ts` | 14 |
| `validators/rulesD2.test.ts` | 10 |

---

## 16. Build e Deploy

```bash
npm install && npm run dev      # dev → localhost:5173
npm run build                   # produção → /dist
npm run deploy                  # GitHub Pages
```

---

## 17. Limitações Conhecidas

| Limitação | Impacto | Próximo passo |
|---|---|---|
| D2_00069–74 (encerramento MSC×DCA) | Não implementadas | Extratores DCA |
| Relatórios: mapeamento de contas varia por sistema | Valores podem divergir do RREO Anexo 02 | Configuração por sistema contábil |
| CSV de regras não versionado | Descrições em branco no GitHub Pages | Pipeline CI |
| RREO/RGF em XML | Validações XLS não aplicam | Extratores XML |
| MSC > 50k linhas | Performance no browser | Web Workers |
| PDF com filtro ativo | Exporta apenas visíveis | Documentado no manual |

---

## 18. Histórico

### v3.5.0 — Jun/2026
- `Dropzone.tsx`: painel de cobertura com tabela MSC/RREO/RGF/DCA, o que cada um habilita e dica de multi-upload
- `firebase.ts`: browserSessionPersistence — sessão encerra ao fechar aba
- `App.tsx`: timer inatividade 30min (mousedown/mousemove/keydown/scroll/click)
- `AIChat.tsx`: sempre visível (bottom-right fixed), contexto dinâmico via onResultsReady
- `aiService.ts`: system prompt adaptativo (geral sem arquivo, contextual com resultados)
- `capagEngine.ts`: cálculo estimado dos 3 indicadores CAPAG a partir da MSC
- `caucService.ts`: links oficiais (sem API pública disponível)
- `validators/rulesD3.ts`: validateLRF_MSC — Pessoal (60%/54%/6%), ARO (7%), Op. Crédito (16%)
- `CAPAGPanel.tsx`: 3 cards de indicadores + aba CAUC com links
- `pdfGenerator.ts`: obs sem truncamento, colunas otimizadas

### v3.4.0 — Jun/2026
- `reportEngine.ts`: motor de relatórios de execução por Função/Subfunção/Fonte
- `ReportView.tsx`: tabela com drill-down, breadcrumb, toggle saldo, export CSV
- `ReportDashboard.tsx`: aba "Relatórios de Execução" integrada

### v3.3.0 — Jun/2026
- Firebase opcional; tela em branco GitHub Pages corrigida
- D2_00083 `impactsCapag: true`

### v3.2.0 — Jun/2026
- `correctiveEntries.ts`; PDF com Plano de Correção; CLI `test-and-pdf.mts`

### v3.1.0 — Jun/2026
- 9 correções QA; 33 testes; `buildDoc()` unificado; layout A4

### v3.0.0 — Jun/2026
- Validação por período; DDR 7211×8211; constantes PCASP; API Siconfi
