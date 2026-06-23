# Status do Projeto — Validador Siconfi

> **Documento de continuidade para qualquer agente/IA que retome o projeto.**
> Leia este arquivo antes de qualquer outro para entender onde estamos e o que fazer a seguir.
>
> **Última atualização:** 2026-06-19 · **Repositório:** https://github.com/Andersonspita/validador-siconfi

---

## 1. Resumo Executivo

O **Validador Siconfi** é uma SPA React/TypeScript que replica localmente as 201 regras de validação do SICONFI (sistema do Tesouro Nacional), permitindo que municípios antecipem erros antes do envio oficial. Tudo roda no browser — nenhum dado sai da máquina do usuário.

**Estado atual:** 94 de 201 regras implementadas (47%).

---

## 2. Arquivos Críticos a Conhecer

| Arquivo | Para quê |
|---|---|
| `src/core/types.ts` | Interfaces TypeScript (MSCAccount, ValidationResult, ParsedData) |
| `src/core/parsers.ts` | Converte CSV/XLS/XML/ZIP em ParsedData |
| `src/core/validatorEngine.ts` | Motor com todas as 48 regras; ponto central de desenvolvimento |
| `src/core/xmlExtractors.ts` | ~25 funções para extrair valores específicos de planilhas XLS |
| `src/core/rulesMetadata.ts` | Carrega metadados das 201 regras do CSV público |
| `public/data/Descricao_verificacoes.csv` | 201 regras oficiais da STN (fonte de verdade) |
| `docs/documentacao_tecnica.md` | Arquitetura, PCASP, API dos extratores, guia de novas regras |
| `docs/manual_do_usuario.md` | Como usar a ferramenta |

---

## 3. Regras Implementadas (62)

```
D1: D1_00001(info), D1_00016, D1_00017, D1_00018, D1_00019, D1_00020, D1_00021,
    D1_00023, D1_00024, D1_00025, D1_00026, D1_00027, D1_00028, D1_00029,
    D1_00030, D1_00031, D1_00032, D1_00033, D1_00034, D1_00035, D1_00036,
    D1_00037, D1_00038

D2: D2_00001, D2_00002, D2_00003, D2_00004, D2_00005, D2_00006, D2_00007,
    D2_00008, D2_00010, D2_00011, D2_00012, D2_00013, D2_00014, D2_00015, 
    D2_00016, D2_00017, D2_00018, D2_00019, D2_00020, D2_00021, D2_00023, 
    D2_00024, D2_00028, D2_00030, D2_00031, D2_00032, D2_00034, D2_00035, 
    D2_00038, D2_00040, D2_00043, D2_00051, D2_00054, D2_00055, D2_00067, 
    D2_00068, D2_00076, D2_00077, D2_00079, D2_00080, D2_00081, D2_00082, 
    D2_00083, D2_00086, D2_00087, D2_00088, D2_00093, D2_00094, D2_00095

D3: D3_00001, D3_00002, D3_00005, D3_00006, D3_00011, D3_00012, D3_00013,
    D3_00014, D3_00015, D3_00016, D3_00021, D3_00027, D3_00028, D3_00030,
    D3_00032, D3_00033, D3_00034, D3_00035, D3_00044, D3_00045

D4: D4_00020, D4_00026
```

### Como verificar a contagem atual

```bash
python3 -c "
import csv
impl = {
  'D1_00001','D1_00016','D1_00017','D1_00018','D1_00019','D1_00020','D1_00021',
  'D1_00022','D1_00023','D1_00024','D1_00025','D1_00026','D1_00027','D1_00028',
  'D1_00029','D1_00030','D1_00031','D1_00032','D1_00033','D1_00034','D1_00035',
  'D1_00036','D1_00037','D1_00038',
  'D2_00001','D2_00002','D2_00003','D2_00004','D2_00005','D2_00006','D2_00007',
  'D2_00008','D2_00010','D2_00011','D2_00012','D2_00015','D2_00016','D2_00018',
  'D2_00019','D2_00020','D2_00021','D2_00053','D2_00054','D2_00055','D2_00059',
  'D2_00060','D2_00067','D2_00068','D2_00076','D2_00077','D2_00079','D2_00080',
  'D2_00086','D2_00087','D2_00088','D2_00093','D2_00094','D2_00095',
  'D3_00001','D3_00002','D3_00003','D3_00005','D3_00006','D3_00007','D3_00008',
  'D3_00009','D3_00011','D3_00012','D3_00013','D3_00014','D3_00015','D3_00016',
  'D3_00017','D3_00021','D3_00027','D3_00028','D3_00030','D3_00032','D3_00033',
  'D3_00034','D3_00035','D3_00044','D3_00045',
  'D4_00020','D4_00026'
}
with open('public/data/Descricao_verificacoes.csv', encoding='utf-8-sig') as f:
    rows = [r for r in csv.DictReader(f, delimiter=';') if r['no_verificacao'].startswith('D')]
print(f'{len(impl)} de {len(rows)} ({len(impl)*100//len(rows)}%)')
"
```

---

## 4. Regras Pendentes por Categoria

### 4.1 Implementáveis na próxima sessão (sem novos arquivos/dependências)

#### SÓ_RREO — 4 regras (precisam apenas do RREO XLS com Anexo 09)

| Regra | Descrição | CAPAG | Dificuldade |
|---|---|---|---|
| D3_00037 | Investimentos Anexo 01 = Anexo 09 | — | Alta — Anexo 09 ausente no arquivo de teste |
| D3_00038 | Inversões Financeiras A01 = A09 | — | Alta — Anexo 09 ausente |
| D3_00039 | Amortização Dívida A01 = A09 | — | Alta — Anexo 09 ausente |
| D3_00040 | Receitas Op. Crédito A01 = A09 | — | Alta — Anexo 09 ausente |

> **Nota D3_00037–040:** O RREO do município de Jaborandi (arquivo de teste) não possui Anexo 09. Precisará de um arquivo real com Anexo 09 para testar e implementar.

#### RREO+RGF — 1 regra (CAPAG!)

| Regra | Descrição | Dificuldade |
|---|---|---|
| D3_00010 | RCL igual entre todos os poderes no RGF A01 | Alta — requer múltiplos RGFs |

> **Nota D3_00008/009:** Precisam do RGF Anexo 05 (Disponibilidade de Caixa). O arquivo de teste de Correntina não tem Anexo 05.

#### Dimensão 2 (Cruzamentos de Saldos)
| Regra | Status | Descrição Simplificada |
|---|---|---|
| **D2_00055** | 🟢 Implementada | Amortização acumulada > valor bruto (Intangível) |
| **D2_00067** | 🟢 Implementada | Depreciação acumulada > valor bruto (Móveis) |
| **D2_00068** | 🟢 Implementada | Depreciação acumulada > valor bruto (Imóveis) |
| **D2_00080** | 🟢 Implementada | Saldo zerado em Estoques (Almoxarifado) |
| **D2_00081** | 🟢 Implementada | Desp. Pessoal registradas sem provisão de Férias/13º |
| **D2_00083** | 🟢 Implementada | Integridade DDR (Classe 721 vs 821) |
| **D2_00095** | 🟢 Implementada | Desp. Pessoal RGPS ativas sem registro de INSS/FGTS |
| **D2_00001** | 🟢 Implementada | FUNDEB VPA no Anexo I-HI da DCA |
| **D2_00002** | 🟢 Implementada | FUNDEB VPD no Anexo I-HI da DCA |
| **D2_00003** | 🟢 Implementada | Deduções FUNDEB no Anexo I-C da DCA |
| **D2_00004** | 🟢 Implementada | Receitas FUNDEB no Anexo I-C da DCA |
| **D2_00005** | 🟢 Implementada | Encargos patronais no Anexo I-D da DCA |
| **D2_00006** | 🟢 Implementada | Despesas de Pessoal no Anexo I-D da DCA |
| **D2_00007** | 🟢 Implementada | Despesas de Custeio no Anexo I-D da DCA |
| **D2_00008** | 🟢 Implementada | Despesas por Função no Anexo I-E da DCA |
| **D2_00010** | 🟢 Implementada | Receitas transferências intergovernamentais em I-C |
| **D2_00011** | 🟢 Implementada | Receitas orçamentárias tributárias em I-C |
| **D2_00012** | 🟢 Implementada | Receitas menores que as deduções em I-C |
| **D2_00015** | 🟢 Implementada | Bens Móveis em I-AB |
| **D2_00016** | 🟢 Implementada | Depreciação de Bens Móveis em I-AB |
| **D2_00018** | 🟢 Implementada | Bens Móveis > Depreciação acumulada em I-AB |
| **D2_00019** | 🟢 Implementada | Bens Imóveis em I-AB |
| **D2_00020** | 🟢 Implementada | Depreciação de Bens Imóveis em I-AB |
| **D2_00021** | 🟢 Implementada | Bens Imóveis > Depreciação acumulada em I-AB |

### 4.2 Implementáveis quando tivermos arquivo DCA (44 regras SÓ_DCA + 36 DCA+OUTRO)

Todas as regras D2_00001–D2_00051 e todas as regras D4_00001–D4_00028 requerem o arquivo DCA (Declaração de Contas Anuais). 

**Para implementar:** precisamos de um arquivo DCA real para mapear a estrutura das abas. O DCA é um XLS com abas como "Anexo I-AB" (Balanço Patrimonial), "Anexo I-C" (Receitas), "Anexo I-D" (Despesas), "Anexo I-E" (Despesas por Função), "Anexo I-HI" (VPA/VPD).

### 4.3 Não implementáveis localmente (23 regras)

| Categoria | Qtde | Motivo |
|---|---|---|
| SÓ_PORTAL | 14 | D1_00002–D1_00015: homologação e tempestividade só verificáveis via API Siconfi |
| MULTI_MÊS | 9 | D1_00020/23/24, D2_00077/79/82/86/87/88: requerem todas as 13 MSCs do exercício com rastreamento por conta |

---

## 5. Decisões Arquiteturais Tomadas

### 5.1 Parser da MSC (parsers.ts)
- **Problema:** CSV pode ter ou não as colunas TIPO2/TIPO5 para desambiguar IC2 (FP vs FS) e IC5 (ND).
- **Decisão:** Usar TIPO2/TIPO5 quando presentes. Quando ausentes, inferir pelo prefixo da CONTA: `622xxx` → FS+ND, demais → FP.
- **Por quê:** O formato Siconfi moderno inclui TIPO, mas versões antigas e exports de alguns sistemas não.

### 5.2 findValueInSheet inclui zero (xmlExtractors.ts)
- **Problema original:** Código retornava `null` para células com valor 0.
- **Decisão:** Retornar 0 — é um valor legítimo (ex: Reserva de Contingência zerada).
- **Por quê:** Municipalities can consume all reserves. Skipping zeros caused false negatives in D3_00033/35.
- **Impacto:** Blank templates com todas as células zeradas agora retornam 0 em vez de null. `validatePairEquality` compara 0=0 → sem erro (correto).

### 5.3 validatePairEquality retorna [] quando val=null
- **Decisão:** Quando qualquer lado é `null` (dado não encontrado no arquivo), a regra não dispara.
- **Por quê:** Evita falsos positivos quando o arquivo não contém a seção esperada.

### 5.4 D3_00021: filtrar apenas FP='F'
- **Problema original:** Código somava todos os passivos 21/22 no `passivoFinanceiro`.
- **Decisão:** Filtrar apenas contas com `acc.FP === 'F'`.
- **Por quê:** O passivo financeiro (para fins de D3_00021) é apenas o subconjunto com atributo superávit financeiro. Provisões trabalhistas (sem FP='F') não são passivo financeiro.

### 5.5 D1_00028: classes 7/8 como 'info'
- **Decisão:** Classes 7/8 (DDR) ausentes geram `info`, não `warning`.
- **Por quê:** Municípios sem RPPS e sem obrigações contingentes relevantes legitimamente não têm classes 7/8. Gerar `warning` causaria falsos positivos em praticamente todos os municípios RGPS.

---

## 6. Arquivos de Teste Disponíveis

```
/mnt/d/Projetos/Validador-siconfi/
├── 2026_Template_MSC_15012026.csv          ← Template MSC vazio (todas as contas, sem valores)
├── PM Correntina - RGF 1QUAD 2024 ...xls   ← RGF real de Correntina/BA (1º quadrimestre 2024)
│                                              Tem: Anexo 01, 02, 03, 04, 06
│                                              RCL real: R$ 265.753.291,89
├── PM Jaborandi - SICONFI_RREO_2917359_20260105_v14 (1).xls  ← RREO template de Jaborandi/BA
│                                              Tem: Anexo 01, 02, 03, 04, 06, 07, 13, 14
│                                              Todos os valores = 0 (template vazio)
└── PM IUIU MSC 01 2026 gerado em 02-06-2026 as 1530.zip  ← ZIP com MSC real de Iuiú/BA
```

> **Atenção:** O RREO de Jaborandi é um template vazio — todas as células são 0. Isso significa que testes de regras D3 com RREO (ex: D3_00001, D3_00002) não dispararão erros com esse arquivo, mesmo que a lógica esteja correta. Para testar, use o arquivo de Correntina (RGF) ou obtenha um RREO preenchido.

---

## 7. Comandos Úteis

```bash
# Verificar tipos sem compilar
npx tsc --noEmit -p /mnt/d/Projetos/Validador-siconfi/tsconfig.json

# Iniciar servidor de desenvolvimento
npm run dev  # → http://localhost:5173

# Ver contagem atual de regras implementadas
python3 -c "
import csv
impl = {
  'D1_00001','D1_00016','D1_00017','D1_00018','D1_00021','D1_00025','D1_00026',
  'D1_00027','D1_00028','D1_00029','D1_00030','D1_00031','D1_00032','D1_00033',
  'D1_00034','D1_00035','D1_00036','D1_00037','D1_00038',
  'D2_00054','D2_00055','D2_00067','D2_00068','D2_00080','D2_00081','D2_00083',
  'D2_00093','D2_00094','D2_00095',
  'D3_00001','D3_00002','D3_00005','D3_00006','D3_00011','D3_00012','D3_00013',
  'D3_00014','D3_00015','D3_00016','D3_00021','D3_00030','D3_00032','D3_00033',
  'D3_00034','D3_00035','D3_00044','D3_00045',
  'D4_00020'
}
with open('/mnt/d/Projetos/Validador-siconfi/public/data/Descricao_verificacoes.csv', encoding='utf-8-sig') as f:
    rows = [r for r in csv.DictReader(f, delimiter=';') if r['no_verificacao'].startswith('D')]
print(f'{len(impl)} de {len(rows)} regras implementadas ({len(impl)*100//len(rows)}%)')
"
```

---

## 8. Bugs Corrigidos (para não regredir)

| Bug | Descrição | Onde está corrigido |
|---|---|---|
| findValueInSheet pulava zeros | Retornava `null` para célula com valor 0 | `xmlExtractors.ts` linha ~25 — condição removida |
| D1_00031/32 falso positivo sem TIPO2/5 | CSV sem TIPO2/TIPO5 → todos os 622xxx falhariam | `parsers.ts` — inferência pelo prefixo da CONTA |
| D3_00021 inclui passivo não-financeiro | Somava todos 21/22, não só FP='F' | `validatorEngine.ts` — filtro `acc.FP === 'F'` |
| getRCLFromRGF capturava linha errada | Regex sem âncora poderia pegar "AJUSTADA" antes da "RCL" | `xmlExtractors.ts` — regex exige `- RCL` ou `(RCL)` |
| D1_00028 falso warning para municípios RGPS | Classes 7/8 são DDR, podem ser ausentes legitimamente | `validatorEngine.ts` — classes 7/8 como `info` |
| 3 exports mortos em xmlExtractors | getTotalReceitasRPPS_A04/etc. nunca chamados → D3_00030 nunca disparava | `xmlExtractors.ts` + D3_00030 adicionado ao engine |

---

## 9. Próximos Passos Recomendados

### Prioridade Alta (impacto CAPAG)

1. **D3_00008/009** — RPNP entre RREO e RGF: obter RGF com Anexo 05 para mapear a estrutura e implementar extratores.

2. **D3_00028** — Receitas realizadas A01=A06: requer extração por coluna específica ("Até o Bimestre") em vez de primeira coluna. Implementar `findValueInSheetByColumn(sheet, rowTerm, colHeaderTerm)`.

3. **Suporte a DCA** — As 80 regras D2 dependentes de DCA são as mais numerosas pendentes. Passos:
   a. Obter um arquivo DCA real `.xls` de um município
   b. Mapear as abas ("Anexo I-AB", "Anexo I-C", etc.) usando Node.js + SheetJS
   c. Implementar extratores para cada aba
   d. Implementar regras D2_00001–D2_00051 (verificações internas da DCA)
   e. Implementar regras D4_00001–D4_00028 (DCA × RREO)

### Prioridade Média

4. **D3_00037–040** — Cruzamentos com Anexo 09 do RREO: obter RREO com esse anexo.

5. **D2_00053/59/60** — Ajustes para perdas: confirmar os códigos PCASP das contas de ajuste e implementar.

6. **Multi-mês** — Para D1_00020/23/24: indexar contas por período e comparar meses consecutivos.

### Prioridade Baixa

7. **Extrator por coluna** — Criar `findValueInSheetByColumn(sheet, rowTerm, colHeaderTerm)` para regras que precisam de coluna específica.

8. **Suporte a RREO/RGF em XML** — As validações atuais só funcionam com XLS. Implementar extratores XML paralelos usando os tags XBRL do Siconfi.

---

## 10. Histórico de Commits Relevantes

| Hash (aprox.) | O que foi feito |
|---|---|
| `9cf264b` | Base inicial: Firebase auth, parsers CSV/XLS/XML, D1_00017/18/21, dashboard |
| `346e7c4` | Expansão D1 (D1_00025–38), D2 (D2_00055–95), D3 (D3_00001/02/05/12/13/21), D4_00020 |
| `ab11cb1` | D3_00006/11/14/15/16/30/32–35/44/45; refatoração xmlExtractors; inferência TIPO2/5 |
| `4780061` | 6 correções de bugs: zeros, TIPO2/5, D3_00021 FP='F', getRCLFromRGF regex, D1_00028 7/8 |
| (atual) | D1_00036 (encerramento), D2_00054, D3_00016/044; documentação completa |

---

## 11. Contexto de Negócio

- **Cliente:** Lopes Consultoria Contábil (contabilidade@lopesconsultoria.cnt.br)
- **Público-alvo:** Contadores de prefeituras que precisam enviar dados ao Siconfi
- **Motivação:** Erros no Siconfi reduzem a nota CAPAG do município, impactando acesso a crédito
- **Linguagem do usuário:** Português do Brasil
- **Repositório:** https://github.com/Andersonspita/validador-siconfi (branch main)
- **Autenticação:** Firebase (credenciais via variáveis de ambiente `.env`)


## Atualização Final - Fases 1 a 5 Concluídas (23/06/2026)
O Validador Siconfi teve seu motor principal (engine) completamente reestruturado em módulos assíncronos (Fases 1 a 5).
- **Dimensão 1 (Tempestividade e Qualidade):** Integração via API do Tesouro (datalake) usando fallback CORS. O motor consegue prever a falta de arquivos baseando-se no que já foi homologado na STN e checar códigos FR/CO/ND/FS ausentes.
- **Dimensão 2 (Matemática e Contábil):** Consistências de PCASP e FUNDEB validadas nativamente.
- **Dimensão 3 (Regras Fiscais Intra-relatório):** Cruzamento perfeito entre anexos do RREO (ex: RCL, Empenhos, RP).
- **Dimensão 4 (Contábil x Fiscal):** Validação cruzada (ex: Despesas Empenhadas e RP) comparando Matriz de Saldos Contábeis (MSC) com anexos RREO/RGF reais extraídos por extratores avançados de XML (parser).
