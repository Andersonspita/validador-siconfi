# Documentação Técnica — Validador Siconfi

> **Versão:** 2.0 · **Data:** 2026-06-19 · **Repositório:** https://github.com/Andersonspita/validador-siconfi

---

## 1. Visão Geral

O Validador Siconfi é uma **Single Page Application (SPA)** que executa validações fiscais e contábeis inteiramente no navegador do usuário — os arquivos nunca saem da máquina do cliente. A aplicação replica localmente as verificações D1–D4 do sistema SICONFI da STN (Secretaria do Tesouro Nacional), permitindo que municípios antecipem erros antes do envio oficial.

### Por que Client-Side?

| Critério | Decisão |
|---|---|
| Privacidade dos dados fiscais | Nenhum dado trafega em rede |
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
| Ícones | lucide-react | 1.x |
| Autenticação | Firebase Auth | 12.x |
| Deploy | gh-pages | — |

---

## 3. Estrutura de Diretórios

```
validador-siconfi/
├── src/
│   ├── core/                    ← Lógica de negócio (sem dependência de React)
│   │   ├── types.ts             ← Interfaces TypeScript
│   │   ├── parsers.ts           ← Leitura e conversão de arquivos
│   │   ├── validatorEngine.ts   ← Motor de validação: 48 regras D1–D4
│   │   ├── xmlExtractors.ts     ← Extratores de valores dos demonstrativos XLS/XML
│   │   └── rulesMetadata.ts     ← Carrega metadados das regras do CSV público
│   ├── components/
│   │   ├── Dropzone.tsx         ← Upload de arquivos (drag-and-drop)
│   │   ├── ReportDashboard.tsx  ← Painel de resultados, filtros e exportação
│   │   ├── Login.tsx            ← Tela de autenticação Firebase
│   │   └── ChangePasswordModal.tsx
│   ├── styles/index.css
│   ├── firebase.ts              ← Configuração Firebase (via env vars)
│   ├── App.tsx                  ← Root component, roteamento de estados
│   └── main.tsx
├── public/
│   └── data/
│       ├── Descricao_verificacoes.csv    ← 201 regras oficiais (STN)
│       └── Aplicabilidade_verificacoes.csv
├── docs/                        ← Esta documentação
└── dist/                        ← Build de produção (gerado)
```

---

## 4. Fluxo de Dados

```
Usuário faz upload de arquivo(s)
        ↓
parseFiles()  [parsers.ts]
  ├─ .csv  → parseMSCWithMeta()   → MSCAccount[] + período YYYY-MM
  ├─ .zip  → descomprime → processa cada entrada (CSV/XML)
  ├─ .xls  → SheetJS → XLSReport { nome_aba: rows[][] }
  └─ .xml  → fast-xml-parser → objeto hierárquico
        ↓
ParsedData { msc, mscPeriods, rreo, rgf, dca }
        ↓
runValidations()  [validatorEngine.ts]
  ├─ validateD1_Entrega()       — presença de documentos, D1_00016
  ├─ validateD1_MSC()           — qualidade interna da MSC
  ├─ validateD1_Encerramento()  — VPA/VPD zerados (se MSC de encerramento)
  ├─ validateD2_MSC()           — consistência patrimonial
  ├─ validateMSC_CAPAG()        — regras D3 aplicáveis à MSC
  ├─ validateD3_RREO()          — verificações internas do RREO
  ├─ validateD3_Fiscal()        — cruzamentos RREO × RGF
  └─ validateD4_Cruzamentos()   — cruzamentos MSC × RREO
        ↓
ValidationResult[]
  → enriquece com metadados do CSV (description, impactsCapag, dimension)
        ↓
ReportDashboard — cards, filtros, exportação CSV
```

---

## 5. Formato da MSC (Matriz de Saldos Contábeis)

### Estrutura do CSV

```
Codigo de Instituicao Siconfi;YYYY-MM          ← linha 1: metadados (período extraído aqui)
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
  CO?:   string;          // complemento
  ND?:   string;          // natureza da despesa (apenas contas 622xxx)
  Valor: number;          // sempre >= 0 (negativos = erro D1_00017)
  Tipo_valor:     'beginning_balance' | 'period_change' | 'ending_balance';
  Natureza_valor: 'D' | 'C';
}
```

### Período da MSC

O cabeçalho da linha 1 contém o período no formato `YYYY-MM`. O parser extrai esse valor e o armazena em `ParsedData.mscPeriods[]`. Período com mês > 12 (ex: `2025-13`) ou = `0` indica MSC de encerramento.

---

## 6. Estrutura PCASP

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

### Grupos de contas relevantes para as validações

| Grupo | Contas | Natureza |
|---|---|---|
| Bens Móveis | 1231xxxxx | D |
| Bens Imóveis | 1232xxxxx | D |
| Depreciação Móveis | 1238101xx | C (contra-ativo) |
| Depreciação Imóveis | 1238102xx | C (contra-ativo) |
| Intangíveis | 124xxxxxx (excl. 1248) | D |
| Amortização Intangível | 1248xxxxx | C |
| Estoques/Almoxarifado | 1156xxxxx | D |
| Investimentos Permanentes | 122xxxxxx | D |
| Restos a Pagar Processados | 212xxxxxx | C |
| Restos a Pagar Não-Processados | 213xxxxxx | C |
| Receita Orçamentária Arrecadada | 6212xxxxx | C |
| Despesa Orçamentária Executada | 62213xxxx | D |

---

## 7. Motor de Validação — Detalhamento

### Regras implementadas (48 de 201)

#### D1 — Gestão da Informação (19 regras)

| Regra | Arquivo | Descrição |
|---|---|---|
| D1_00001 | — | Aviso informativo: D1_00002–15 verificáveis apenas no portal Siconfi |
| D1_00016 | MSC (múltiplas) | Completude das MSCs do exercício (13 esperadas: jan–dez + encerramento) |
| D1_00017 | MSC | Valores negativos (Siconfi rejeita) |
| D1_00018 | MSC | SI + MOV ≠ SF por chave CONTA-PO-FR-CO |
| D1_00021 | MSC | Ativo (grupos 1111/1121/1125/1231/1232) com natureza Credora (C) |
| D1_00025 | MSC | Passivo circulante/não-circulante (grupos 2111–2126, 213–215, 221–223) com natureza D |
| D1_00026 | MSC | Patrimônio Líquido (grupos 2311/2312, 232–236) com natureza D |
| D1_00027 | MSC | Contas com FP='F' (superávit financeiro) sem FR preenchido |
| D1_00028 | MSC | Classes 1–6 ausentes (warning) · Classes 7–8 ausentes (info) |
| D1_00029 | MSC | Grupos 6211/6212/6213 sem FR |
| D1_00030 | MSC | Grupos 6211/6212/6213 sem natureza de receita (CO/IC4) |
| D1_00031 | MSC | Grupos 62213 sem natureza de despesa (ND/IC5) |
| D1_00032 | MSC | Grupos 622xxx sem função/subfunção (FS/IC2) |
| D1_00033 | MSC | Grupos 62213 sem Fonte de Recurso (FR/IC3) |
| D1_00034 | MSC | VPD (grupos 311–363) com natureza C |
| D1_00035 | MSC | VPA (classe 4) com natureza D |
| D1_00036 | MSC encerramento | VPA/VPD (classes 3/4) com saldo final ≠ 0 |
| D1_00037 | MSC | FR 001–499 (fontes da União) usado em MSC de município/estado |
| D1_00038 | MSC | Grupos 511/621 com natureza D; grupos 512/622 com natureza C |

#### D2 — Consistência Contábil (10 regras)

| Regra | O que verifica |
|---|---|
| D2_00054 | VPA/VPD de equivalência patrimonial (442/362) sem investimentos permanentes (122) |
| D2_00055 | Amortização acumulada intangíveis (1248) > valor bruto (124 excl. 1248) |
| D2_00067 | Depreciação bens móveis (1238101) > valor bruto bens móveis (1231) |
| D2_00068 | Depreciação bens imóveis (1238102) > valor bruto bens imóveis (1232) |
| D2_00080 | Estoques/almoxarifado (11561) com saldo zero sem justificativa |
| D2_00081 | Pessoal sem provisão mensal de férias (211110102) ou 13º (211110103) |
| D2_00083 | DDR: saldo final contas 721xxx ≠ saldo final contas 821xxx |
| D2_00093 | Almoxarifado (11561) com saldo mas sem movimentação de consumo |
| D2_00094 | Pessoal RPPS (311110101) sem contribuição patronal (312120100) |
| D2_00095 | Pessoal RGPS (311210101) sem INSS (312210100) / FGTS (312230100) |

#### D3 — Fiscal (19 regras)

| Regra | Arquivos | Descrição | CAPAG |
|---|---|---|---|
| D3_00001 | RREO | TOTAL COM DÉFICIT (VII) = TOTAL COM SUPERÁVIT (XIV) no Anexo 01 | — |
| D3_00002 | RREO | Despesas: Anexo 01 Subtotal X = Anexo 02 Total I | — |
| D3_00005 | RREO+RGF | RCL: RREO Anexo 03 = RGF Anexo 01 | ✓ |
| D3_00006 | RREO+RGF | DCL: RREO Anexo 06 = RGF Anexo 02 | ✓ |
| D3_00011 | RGF | Dedução inativos/pensionistas ≤ total inativos no Anexo 01 | — |
| D3_00012 | RREO | Valores negativos em qualquer célula | — |
| D3_00013 | RGF | Valores negativos em qualquer célula | — |
| D3_00014 | RGF | Transferências emendas individuais: A01 = A02 | ✓ |
| D3_00015 | RREO+RGF | Transferências emendas individuais: RREO A03 = RGF A01 | ✓ |
| D3_00016 | RREO+RGF | Transferências emendas de bancada: RREO A03 = RGF A01 | ✓ |
| D3_00021 | MSC | Passivo financeiro (FP='F') ≥ Restos a Pagar | ✓ |
| D3_00030 | RREO | Receitas RPPS: Anexo 04 = Anexo 06 | ✓ |
| D3_00032 | RREO | Recursos RPPS exercícios anteriores: A01 = A04 = A06 | — |
| D3_00033 | RREO | Superávit financeiro créditos adicionais: A01 = A06 | — |
| D3_00034 | RREO | Reserva RPPS: A01 = A04 = A06 | — |
| D3_00035 | RREO | Reserva de Contingência: A01 = A06 | — |
| D3_00044 | RREO+RGF | Transferências agentes comunitários de saúde: RREO A03 = RGF A01 | ✓ |
| D3_00045 | RREO | Valores negativos nos Restos a Pagar (Anexo 07) | ✓ |

#### D4 — Cruzamentos MSC × Demonstrativos (1 regra)

| Regra | Descrição | CAPAG |
|---|---|---|
| D4_00020 | Receitas arrecadadas MSC (6212) = RREO Anexo 01 | ✓ |

---

## 8. xmlExtractors.ts — API de Referência

### Funções base (não exportadas)

```typescript
findValueInSheet(sheet, term, offset?)
  // Retorna o primeiro valor numérico na linha que contém `term` (regex).
  // Inclui zero. Retorna null se não encontrado.

findValueInSection(sheet, sectionTerm, valueTerm, maxLines?)
  // Para planilhas onde o valor está em linha separada abaixo do cabeçalho.
  // Ex: Anexo 04 RPPS: cabeçalho "Recursos RPPS..." → linha "  VALOR"

getSheet(report, candidates[])
  // Retorna a primeira aba encontrada dentre os candidatos de nome.
```

### Extratores exportados por categoria

```typescript
// RCL
getRCLFromRREO(rreo)        // RREO Anexo 03: "RECEITA CORRENTE LÍQUIDA (III)"
getRCLFromRGF(rgf)          // RGF Anexo 01:  "RECEITA CORRENTE LIQUIDA - RCL (IV)"

// Equilíbrio orçamentário (D3_00001)
getEquilibrioOrcamentario(rreo)  // { comDeficit, comSuperavit }

// Despesas (D3_00002)
getTotalDespesasAnexo01(rreo)    // "SUBTOTAL DAS DESPESAS (X)"
getDespesasAnexo02(rreo)         // "DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)"

// RPPS (D3_00030/32/34)
getTotalReceitasRPPS_A04(rreo)   // "TOTAL DAS RECEITAS DO FUNDO EM CAPITALIZAÇÃO (IV)"
getReceitasRPPS_A06(rreo)        // "RECEITAS PRIMÁRIAS CORRENTES (COM FONTES RPPS) (V)"
getRPPSExercAnt_A01/A04/A06(rreo)
getReservaRPPS_A01/A04/A06(rreo)

// Superávit financeiro (D3_00033)
getSuperavitFinanceiro_A01/A06(rreo)

// Reserva Contingência (D3_00035)
getReservaContingencia_A01/A06(rreo)

// DCL (D3_00006)
getDCL_RREO_A06(rreo)           // "DÍVIDA CONSOLIDADA LÍQUIDA (XLII)"
getDCL_RGF_A02(rgf)             // "DÍVIDA CONSOLIDADA LÍQUIDA (DCL) (III)"

// Transferências
getTransfEmendasIndividuais_RREO_A03(rreo)
getTransfEmendasIndividuais_RGF_A01/A02(rgf)
getTransfEmendasBancada_RREO_A03(rreo)
getTransfEmendasBancada_RGF_A01(rgf)
getTransfAgentesSaude_RREO_A03(rreo)
getTransfAgentesSaude_RGF_A01(rgf)

// Valores negativos
findNegativeValues(report)        // Todas as abas
findNegativosRP_A07(rreo)         // Apenas Anexo 07

// Metadados
extractXLSMetadata(report)        // { ente, periodo, exercicio }
```

### Extrator genérico

```typescript
extractFromReport(report, sheetCandidates, searchTerm, colOffset?)
// Combina getSheet + findValueInSheet.
// Exemplo:
const val = extractFromReport(rreo, ['RREO-Anexo 01'], 'RESERVA DE CONTINGÊNCIA');
```

---

## 9. Helpers de Comparação

Em `validatorEngine.ts` há dois helpers que evitam código repetitivo:

### `validatePairEquality`

```typescript
validatePairEquality(
  ruleId: string,
  dimension: 'D1'|'D2'|'D3'|'D4',
  a: { label: string; val: number | null },
  b: { label: string; val: number | null },
  msgBase: string,
  impactsCapag: boolean
): ValidationResult[]
```

Retorna `[]` (sem resultado) quando `a.val === null || b.val === null` — evita falsos positivos quando o dado não estava presente no arquivo.

### `validateTripleEquality`

Igual ao anterior, mas com três fontes. Gera um único `ValidationResult` descrevendo todos os pares divergentes.

---

## 10. Como Adicionar uma Nova Regra

1. **Identifique** o ID em `public/data/Descricao_verificacoes.csv`
2. **Verifique** o campo `no_declaracao` para saber quais arquivos são necessários
3. **Se precisar extrair valor de XLS**, adicione extrator em `xmlExtractors.ts`:
   ```typescript
   export const getMeuValor = (rreo: any): number | null =>
     extractFromReport(rreo, ['RREO-Anexo XX'], 'Texto exato da linha');
   ```
4. **Implemente a regra** na função de validação correta em `validatorEngine.ts`:
   - MSC pura → `validateD1_MSC()` ou `validateD2_MSC()`
   - MSC encerramento → `validateD1_Encerramento()`
   - Apenas RREO → `validateD3_RREO()`
   - RREO + RGF → `validateD3_Fiscal()`
   - MSC + RREO → `validateD4_Cruzamentos()`
5. **Use os helpers** `validatePairEquality` / `validateTripleEquality` para comparações
6. **Atualize** o conjunto `implementadas` no script de contagem e em `docs/STATUS_PROJETO.md`
7. **Compile**: `npx tsc --noEmit`

### Severidades

| Valor | Quando usar |
|---|---|
| `'error'` | Viola critério obrigatório do Siconfi — impede envio ou causa rejeição |
| `'warning'` | Possível problema que reduz a nota de qualidade |
| `'info'` | Informação relevante, sem impacto direto na nota |

---

## 11. Firebase — Autenticação

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

O `.gitignore` já exclui `.env` e `.env.*`.

---

## 12. Build e Deploy

```bash
npm install          # instalar dependências
npm run dev          # servidor dev → http://localhost:5173
npx tsc --noEmit     # verificar tipos sem gerar arquivos
npm run build        # build produção → /dist
npm run deploy       # publicar no GitHub Pages (requer gh-pages configurado)
```

> **Nota WSL:** O build pode falhar com `EPERM` ao copiar para `dist/`.
> Solução: `rm -rf dist && npm run build`.

---

## 13. Limitações Conhecidas

| Limitação | Impacto | Próximo passo |
|---|---|---|
| D1_00002–D1_00015 (homologação/tempestividade) | Só verificável via API Siconfi | Integração futura com API STN |
| Regras multi-mês (D1_00020/23/24, D2_00077/79/82/86–88) | Requerem as 13 MSCs do exercício com rastreamento por período | Indexar contas por período |
| 44 regras D2 que requerem DCA | Aguardam parser e extratores específicos para DCA XLS | Implementar suporte a DCA |
| `findValueInSheet` retorna 1ª coluna numérica | Regras que precisam de coluna específica (ex: "Até o Bimestre") ficam imprecisas | Adicionar extrator por índice de coluna |
| RREO/RGF em formato XML | Validações XLS não se aplicam; usuário recebe aviso info | Implementar extratores XML |
| D3_00021: passivo financeiro com FP='F' | Requer FP corretamente preenchido no CSV da MSC | Já corrigido — depende de dados do cliente |


## Atualização Arquitetural (23/06/2026)
O código-fonte `validatorEngine.ts` agora delega as chamadas para arquivos específicos:
- `rulesD1.ts`: Aciona o `siconfiApi.ts` via `fetch` para verificar remessas (DCA, MSC, RREO, RGF) no data lake (apidatalake.tesouro.gov.br). Utiliza um proxy (`corsproxy.io`) para uso em ambientes sem backend.
- `rulesD2.ts`: Mantém a lógica assíncrona/síncrona de limites e subtotais.
- `rulesD3.ts` e `rulesD4.ts`: Importam helpers de `xmlExtractors.ts` para realizar cruzamentos pesados (ex: Receita Corrente Líquida, Dívida Consolidada) e `utils.ts` para soma contábil.

A extração de metadados das planilhas (Ente IBGE e Ano) está acoplada no `parsers.ts`, garantindo a checagem cruzada da regra D3_00005 (arquivos de Entes misturados).
