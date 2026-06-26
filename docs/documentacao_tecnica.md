# Documentação Técnica — Validador Siconfi

> **Versão:** 3.3.0 · **Data:** 2026-06-26  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Visão Geral

O Validador Siconfi é uma **SPA React/TypeScript** que executa validações fiscais e contábeis inteiramente no navegador — os arquivos nunca saem da máquina do cliente. Replica localmente as verificações D1–D4 do SICONFI da STN, permitindo que municípios antecipem erros antes do envio oficial.

### Por que Client-Side?

| Critério | Decisão |
|---|---|
| Privacidade dos dados fiscais | Nenhum dado trafega em rede (exceto consulta opcional à API STN) |
| Custo de infraestrutura | Hospedagem estática gratuita (GitHub Pages) |
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
│   ├── core/                          ← Lógica de negócio (sem dependência de React)
│   │   ├── types.ts                   ← Interfaces TypeScript (incl. SuggestedEntry)
│   │   ├── parsers.ts                 ← Leitura CSV/XLS/XML/ZIP → ParsedData
│   │   ├── pcaspRules.ts              ← Constantes PCASP externalizadas (MDF 15ª ed.)
│   │   ├── correctiveEntries.ts       ← Lançamentos PCASP D/C sugeridos por regra
│   │   ├── pdfGenerator.ts            ← Relatório PDF (buildDoc unificado)
│   │   ├── rulesMetadata.ts           ← Carrega metadados do CSV oficial da STN
│   │   ├── xmlExtractors.ts           ← Extratores de valores RREO/RGF/DCA
│   │   ├── validatorEngine.ts         ← Re-export de runValidations (compatibilidade)
│   │   ├── parsers.test.ts            ← Testes unitários do parser (3 testes)
│   │   └── validators/
│   │       ├── index.ts               ← Orquestrador runValidations()
│   │       ├── rulesD1.ts             ← D1: qualidade MSC, entrega, encerramento
│   │       ├── rulesD2.ts             ← D2: consistência patrimonial, DCA
│   │       ├── rulesD3.ts             ← D3: RREO, RGF, CAPAG
│   │       ├── rulesD4.ts             ← D4: cruzamentos MSC × demonstrativos
│   │       ├── utils.ts               ← Helpers: equilíbrio D=C, somas, comparações
│   │       ├── utils.test.ts          ← 6 testes dos helpers
│   │       ├── rulesD1.test.ts        ← 14 testes das regras D1
│   │       └── rulesD2.test.ts        ← 10 testes das regras D2
│   ├── components/
│   │   ├── Dropzone.tsx               ← Upload drag-and-drop
│   │   ├── ReportDashboard.tsx        ← Painel de resultados, filtros e exportação
│   │   ├── Login.tsx                  ← Tela de autenticação (só quando Firebase ativo)
│   │   └── ChangePasswordModal.tsx
│   ├── services/
│   │   └── siconfiApi.ts              ← API STN — extrato de entregas
│   ├── firebase.ts                    ← Init condicional (sem env vars = sem crash)
│   ├── App.tsx                        ← Root: auth condicional, carregamento de regras
│   └── main.tsx
├── scripts/
│   ├── run-local-validation.mts       ← CLI simples (saída no terminal)
│   └── test-and-pdf.mts               ← CLI completo: valida ZIP + gera PDF
├── public/
│   └── data/
│       └── Descricao_verificacoes.csv ← ~197 regras oficiais STN (não versionado)
└── docs/
    ├── STATUS_PROJETO.md
    ├── documentacao_tecnica.md        ← este arquivo
    ├── manual_do_usuario.md
    └── diario_de_implementacao.md
```

---

## 4. Fluxo de Dados

```
File[] (upload)
    └── parseFiles()          ← parsers.ts
        ├── CSV → parseMSCWithMeta()   (detecção encoding: UTF-8 → cp1252 → iso-8859-1)
        ├── ZIP → extrai CSV/XML/XLS   (QA-002/003: encoding + XLS em ZIP)
        ├── XLS/XLSX → SheetJS.read()  (cellDates: true)
        └── XML → fast-xml-parser
            ↓
        ParsedData { msc, mscByPeriod, rreo, rgf, dca, enteId, anoReferencia }
            └── runValidations()       ← validators/index.ts
                ├── validateD1_Entrega()   API STN opcional
                ├── validateD1_MSC()       por período em mscByPeriod
                ├── validateD2_MSC()       por período
                ├── validateD3_RREO/Fiscal()
                ├── validateD4_Cruzamentos()
                ├── enriquecer com rulesMap (descrições oficiais)
                └── enrichWithCorrectiveEntries()   ← correctiveEntries.ts
                    ↓
            ValidationResult[]
                ├── ReportDashboard (UI + filtros + exportação)
                └── generatePDF() / generatePDFBuffer()   ← pdfGenerator.ts
```

---

## 5. Tipos Principais (`types.ts`)

### `MSCAccount`
Representa um registro da Matriz de Saldos Contábeis.

```typescript
interface MSCAccount {
  CONTA: string;           // Código PCASP (ex.: '111111900')
  PO?: string;             // IC1: Poder/Órgão
  FP?: string;             // IC2: Fundo Previdenciário (quando TIPO2='FP')
  FS?: string;             // IC2: Função/Subfunção (quando TIPO2='FS')
  FR?: string;             // IC3: Fonte de Recurso
  CO?: string;             // IC4: Classificação Orçamentária
  ND?: string;             // IC5: Natureza de Despesa
  Valor: number;
  Tipo_valor: 'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
```

### `ValidationResult`
Resultado de cada regra de validação.

```typescript
interface ValidationResult {
  ruleId: string;                    // ex.: 'D2_00083'
  dimension: 'D1' | 'D2' | 'D3' | 'D4';
  description: string;               // descrição oficial STN
  severity: 'error' | 'warning' | 'info';
  impactsCapag: boolean;             // se afeta nota CAPAG
  affectedAccounts?: string[];       // contas PCASP afetadas
  detailedItems?: DetailedItem[];    // amostra de lançamentos (máx. 4)
  message: string;                   // mensagem com valores exatos
  actionPlan?: string;               // plano de ação corretiva
  suggestedEntries?: SuggestedEntry[]; // lançamentos PCASP D/C sugeridos
}
```

### `SuggestedEntry`
Lançamento contábil PCASP sugerido para correção.

```typescript
interface SuggestedEntry {
  descricao: string;
  debito:  { conta: string; descricao: string };
  credito: { conta: string; descricao: string };
  valor?: number;   // calculado automaticamente quando possível
  obs?: string;     // observações e referência normativa
}
```

---

## 6. Parser MSC (`parsers.ts`)

### Funções exportadas

| Função | Descrição |
|--------|-----------|
| `parseFiles(files)` | Ponto de entrada: processa `File[]` → `ParsedData` |
| `parseMSCWithMeta(csvText)` | Parser CSV com extração de período e enteId |
| `readTextWithEncoding(file)` | Lê `File` com fallback UTF-8 → cp1252 → iso-8859-1 |
| `decodeTextFromBytes(bytes)` | Variante para `Uint8Array` (usada em ZIP e testes) |

### Detecção de encoding
`decodeTextFromBytes()` tenta três encodings em sequência, verificando a presença do cabeçalho `CONTA;`. Se nenhum funcionar, lança `Error` explícito em vez de retornar garbage text silenciosamente.

### Arquivos dentro de ZIP
Ao extrair um ZIP:
- `.csv` → `decodeTextFromBytes()` (QA-002: garante cp1252)
- `.xls` / `.xlsx` → SheetJS com `{ type: 'array', cellDates: true }` (QA-003: não ignorado)
- `.xml` → `fast-xml-parser`

---

## 7. Constantes PCASP (`pcaspRules.ts`)

Todas as constantes que definem grupos de contas e regras são externalizadas aqui para facilitar atualização a cada edição do MDF.

```typescript
MDF_VERSION = 'MDF 15ª edição'

ATIVO_NATUREZA_D_PREFIXES      = ['1111','1121','1125','1231','1232']
ATIVO_RETIFICADORA_PREFIXES    = ['1238101','1238102','1238']
PASSIVO_NATUREZA_C_PREFIXES    = ['2111','2112','2113','2114',...]
PL_DEDUCAO_PREFIXES            = ['2312','2321','2322',...]
ORCAM_NATUREZA_EXCEPTION_PREFIXES = ['6213201','6229201',...]
DDR_DEVEDORA_PREFIXES          = ['7211']   // apenas DDR, exclui garantias
DDR_CREDORA_PREFIXES           = ['8211']
PROVISAO_FERIAS_13_CONTAS      = ['211110102','211110103','211110104']
TOLERANCIA_REAIS               = 0.01
```

---

## 8. Motor de Validação (`validators/index.ts`)

`runValidations()` executa as famílias em sequência:

1. `validateD1_Entrega()` — consulta API STN se enteId detectado
2. Para cada período em `mscByPeriod`:
   - `validateD1_MSC()`
   - `validateD2_MSC()`
3. Se há período de encerramento: `validateD1_Encerramento()`, `validateD2_MSC_Encerramento_DCA()`
4. `validateMSC_CAPAG()` — regras com flag impactsCapag
5. `validateMultiMonth()` — D1_00020/23/24 + D2_00077 entre meses
6. `validateD2_DCA()` — se DCA presente
7. `validateD3_RREO()` — se RREO presente
8. `validateD4_Cruzamentos()` — se MSC + RREO/DCA
9. `validateD3_Fiscal()` — se RREO + RGF
10. Enriquecer com `rulesMap` (descrições oficiais)
11. **`enrichWithCorrectiveEntries()`** — lançamentos PCASP sugeridos

---

## 9. Lançamentos Corretivos (`correctiveEntries.ts`)

Mapeia regras a lançamentos PCASP D/C. Valores calculados automaticamente quando possível.

| Regra | Lançamento sugerido |
|-------|---------------------|
| D2_00083 | D 721110000 / C 821110000 pelo valor exato da divergência DDR |
| D2_00081 | D 311210103 / C 211110102 (férias); D 311210104 / C 211110103 (13º); estimativa 8% da folha |
| D2_00067 | D 123810100 / C 311910100 pelo excesso de depreciação bens móveis |
| D2_00068 | D 123810200 / C 311910200 pelo excesso de depreciação bens imóveis |
| D2_00055 | D 124810000 / C 311910300 pelo excesso de amortização intangível |
| D2_00094 | D 312120100 / C 211110200 estimativa 22% sobre folha RPPS |
| D2_00095 | D 312210100 / C 211110301 (INSS 20%) + D 312230100 / C 211110302 (FGTS 8%) |
| D1_00021 | Orientação: estorno ou reclassificação para conta retificadora |
| D1_00025 | Orientação: regularização do saldo D no passivo |
| D1_00029–33 | Orientação: atualizar IC no sistema contábil (não há lançamento) |
| D2_00030/31 | Estorno do lançamento com saldo negativo |
| D2_00053 | Estorno excesso de ajuste para perdas de estoques |
| D2_00059/60 | Estorno excesso de ajuste para perdas de créditos |
| D2_00080 | Reconhecimento de estoque (D 11561 / C 31xxx) |
| D2_00054 | Registro de investimento permanente (D 122110 / C 441210) |

---

## 10. Gerador de PDF (`pdfGenerator.ts`)

### `buildDoc(results, meta)` — função interna unificada
Constrói o documento jsPDF com:
- Cabeçalho com ente, período, MDF version
- Caixas coloridas de resumo (impeditivos / avisos / orientações)
- Tabela de Erros Críticos `[IMPEDITIVO]`
- Tabela de Avisos e Informativos `[AVISO]`
- Orientações de servidor compactadas em 1 linha + link siconfi.tesouro.gov.br
- **Seção "Plano de Correção Contábil"** — tabela D/C por regra com valores e obs.
- Rodapé com número de página em todas as páginas

### Layout A4
- Largura disponível: `210 - 14 - 14 = 182mm`
- Colunas: `22 + 80 + 80 = 182mm` (zero overflow)

### Exports públicos

| Função | Uso |
|--------|-----|
| `generatePDF(results, meta)` | Browser: `.save()` aciona download |
| `generatePDFBuffer(results, meta)` | Node/CLI: retorna `ArrayBuffer` |

> **Nota:** O filtro ativo no dashboard afeta o que é passado ao PDF. Para relatório completo, selecionar "Todas as Regras" antes de exportar.

---

## 11. Firebase (`firebase.ts`)

Firebase Auth é **opcional**. A aplicação detecta automaticamente se as variáveis estão disponíveis.

```typescript
export const isFirebaseConfigured = !!VITE_FIREBASE_API_KEY && !!VITE_FIREBASE_PROJECT_ID && !!VITE_FIREBASE_APP_ID;
export const auth = isFirebaseConfigured ? getAuth(app) : null;
```

**Comportamento sem Firebase:**
- Sem login — app abre diretamente na tela de upload
- Botões de logout e alterar senha são ocultados automaticamente
- Não há crash nem tela em branco

**Para ativar Firebase:**
```env
# .env (raiz do projeto — NÃO commitar)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Para GitHub Pages, as variáveis precisam estar disponíveis no `npm run build`. Recomenda-se configurar como GitHub Secrets em um workflow de Actions.

---

## 12. Metadados de Regras (`rulesMetadata.ts`)

Carrega o CSV oficial da STN com ~197 descrições de regras via `fetch('./data/Descricao_verificacoes.csv')`.

- Se o CSV não existir (404), retorna `Map` vazio silenciosamente — a validação funciona normalmente, apenas sem as descrições oficiais.
- O arquivo está excluído do repositório por `*.csv` no `.gitignore`. Para usar, coloque em `public/data/` antes do build.

---

## 13. D2_00083 — DDR e CAPAG

O campo `impactsCapag: true` na regra D2_00083 reflete dois canais de impacto:

**Canal 1 — Indicador de Liquidez (IL):**
O CAPAG calcula o IL usando apenas disponibilidades de fontes não vinculadas. As contas 721/821 são o mecanismo contábil que faz essa separação. Um DDR desequilibrado distorce diretamente o IL.

**Canal 2 — Ranking ICF (desde Portaria MF 1.583/2023):**
Erros impeditivos (severity: 'error') degradam o Ranking da Qualidade da Informação Contábil e Fiscal (ICF). Entes com nota Eicf já estão bloqueados para crédito com garantia da União; a partir de 2026, entes com nota Dicf também ficam inelegíveis.

---

## 14. Testes

```bash
npm test                    # 33 testes Vitest
npx tsc --noEmit            # verificar tipos
npx tsx scripts/test-and-pdf.mts arquivo.zip   # validação E2E + PDF
```

| Arquivo | Testes | Cobertura |
|---------|--------|-----------|
| `parsers.test.ts` | 3 | Encoding, IBGE 7 dígitos, notação científica |
| `validators/utils.test.ts` | 6 | Equilíbrio D=C, DDR, contas invertidas |
| `validators/rulesD1.test.ts` | 14 | D1_00017/18/21/22/23/24/31 |
| `validators/rulesD2.test.ts` | 10 | D2_00050/55/81/83 |

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

> **Nota WSL:** O build pode falhar com `EPERM` ao copiar para `dist`. Solução: `rm -rf dist && npm run build`.

---

## 16. Limitações Conhecidas

| Limitação | Impacto | Próximo passo |
|---|---|---|
| D1_00002–D1_00015 (tempestividade exata) | Parcial — API retorna homologação, não prazo LRF | Expandir lógica de prazos |
| D2_00069–74 (encerramento MSC×DCA) | Não implementadas | Extratores DCA + MSC encerramento |
| CSV de regras não versionado | Descrições em branco no GitHub Pages | Configurar no pipeline CI |
| RREO/RGF em XML | Validações XLS não se aplicam | Extratores XML |
| MSC > 50k linhas | Pode degradar performance | Web Workers |
| PDF gerado com filtro ativo | Exporta apenas os resultados visíveis | Comportamento documentado |

---

## 17. Histórico de mudanças arquiteturais

### v3.3.0 — Jun/2026
- Firebase opcional (init condicional; app abre sem .env)
- D2_00083 `impactsCapag: true` com justificativa normativa

### v3.2.0 — Jun/2026
- `correctiveEntries.ts` — lançamentos PCASP por regra
- `SuggestedEntry` em `types.ts`; `suggestedEntries?` em `ValidationResult`
- PDF: seção "Plano de Correção Contábil"
- `scripts/test-and-pdf.mts` — CLI completo

### v3.1.0 — Jun/2026 (Auditoria QA)
- 9 correções (1 crítico, 3 altos, 5 médios/baixos)
- 33 testes Vitest (era 8)
- `buildDoc()` unificado; layout A4 sem overflow
- `decodeTextFromBytes()` exportado para reutilização em ZIP

### v3.0.0 — Jun/2026
- Validação por período; `validateEquilibrioGeral()`; DDR 7211×8211
- Constantes PCASP externalizadas; integração API Siconfi
