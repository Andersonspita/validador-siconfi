# Manual do Usuário — Validador Siconfi

> **Versão 3.4.0** · Atualizado em 2026-06-26  
> **Aplicação:** https://andersonspita.github.io/validador-siconfi/

---

## O que é o Validador Siconfi?

O Validador Siconfi é uma ferramenta que **simula localmente as verificações do SICONFI da STN** e gera **relatórios analíticos de execução orçamentária** a partir dos arquivos fiscais do município, tudo dentro do seu navegador — nenhum dado financeiro é enviado para servidores externos.

### Para que serve?

| Funcionalidade | Descrição |
|---|---|
| **Validação D1–D4** | Antecipa erros antes do envio ao SICONFI, protegendo o Ranking ICF e a nota CAPAG |
| **Relatório PDF** | Gera documento com plano de ação e lançamentos PCASP corretivos |
| **Relatórios de Execução** | Agrega despesas da MSC por Função, Subfunção, Fonte de Recurso e Natureza, com drill-down interativo |

---

## Acesso ao Sistema

1. Abra o navegador (Chrome, Edge ou Firefox)
2. Acesse: **https://andersonspita.github.io/validador-siconfi/**

> O sistema pode funcionar com ou sem login dependendo da configuração do município. Se não aparecer tela de login, é só enviar os arquivos.

---

## Como Validar os Arquivos

### Passo 1 — Obter os arquivos

| Arquivo | Formato | Para que serve |
|---|---|---|
| **MSC** — Matriz de Saldos Contábeis | `.csv` ou `.zip` | Validações D1/D2 e Relatórios de Execução |
| **RREO** | `.xls`, `.xlsx`, `.xml` ou `.zip` | Validações D3/D4 |
| **RGF** | `.xls`, `.xlsx`, `.xml` ou `.zip` | Validações D3 (RCL, DCL) |
| **DCA** | `.xls`, `.xlsx`, `.xml` ou `.zip` | Validações D2 avançadas |

> **Dica:** Para máxima cobertura, envie MSC + RREO + RGF juntos.

### Passo 2 — Fazer o upload

Arraste os arquivos para a área de upload ou clique para selecionar. Múltiplos arquivos e múltiplos meses de MSC são aceitos simultaneamente.

> **ZIP:** aberto automaticamente. O sistema extrai CSV, XML e XLS/XLSX internos.

### Passo 3 — Aguardar o processamento

O sistema executa automaticamente:
1. Leitura com detecção de encoding (UTF-8, Windows-1252, ISO-8859-1)
2. Consulta à API do Siconfi (quando detecta código IBGE na MSC)
3. 99 regras de validação D1–D4
4. Geração de lançamentos PCASP corretivos
5. Preparação dos dados para relatórios de execução

---

## As Duas Abas do Painel

Após o processamento, o painel exibe duas abas:

### Aba "Validações"

Exibe os resultados das regras D1–D4 com filtros e opções de exportação.

**Painel de resumo:**

| Cartão | Significado |
|---|---|
| Inconsistências (Erros + Avisos) | Total de problemas que reduzem a qualidade |
| Erros Críticos | Impedem homologação no Siconfi |
| Avisos | Merecem correção antes do envio |
| Informativos | Verificações do servidor — conferir no portal |
| Riscos CAPAG | Impactam diretamente a nota do município |

**Tipos de resultado:**

| | Severidade | Quando ocorre |
|---|---|---|
| 🔴 | Erro | Viola regra obrigatória (ex.: DDR desequilibrado) |
| 🟡 | Aviso | Reduz nota de qualidade (ex.: conta do ativo invertida) |
| 🔵 | Informativo | Verificação dependente do servidor Siconfi |

**Filtros disponíveis:**
- Todas as Regras · Erros · Avisos · Informativos · 🛡 Riscos CAPAG

> ⚠️ **Importante:** o PDF inclui apenas os resultados do filtro ativo. Selecione **"Todas as Regras"** antes de exportar o relatório completo.

### Aba "Relatórios de Execução"

> Disponível apenas quando a MSC contém contas de despesa orçamentária (622xxx).

Exibe a execução das despesas extraída diretamente da MSC, com agrupamentos e drill-down, similar ao RREO Anexo 02.

---

## Relatórios de Execução — Guia Completo

### Agrupamentos disponíveis

| Agrupamento | O que mostra | Exemplo |
|---|---|---|
| **Função** | Total por função orçamentária | 10 - Saúde, 12 - Educação |
| **Função/Subfunção** | Detalhamento por subfunção | 12361 (Ensino Fundamental) |
| **Fonte de Recurso** | Total por fonte (FR) | 1500, 1540, 1550 |
| **Natureza de Despesa** | Total por natureza (ND) | 339030, 319013 |
| **Órgão/Poder** | Total por órgão (PO) | Secretarias, Câmara |

### Colunas do relatório

| Coluna | Contas PCASP | Descrição |
|---|---|---|
| **Empenhado** | 622130100 | Total comprometido com fornecedores |
| **Liquidado** | 622130200/300/400 | Confirmado o recebimento do bem/serviço |
| **Pago** | 622130300/400 | Efetivamente pago |

### Toggle Movimentação / Acumulado

| Opção | Usa | Quando usar |
|---|---|---|
| **Movimentação** | `period_change` | Análise do que ocorreu no mês da MSC |
| **Acumulado** | `ending_balance` | Saldo final acumulado até a data da MSC |

### Drill-down interativo

Clique em qualquer linha para aprofundar a análise:

```
Função (ex.: 12 - Educação)
    ↓ clique
Subfunção (ex.: 12361, 12365, 12367...)
    ↓ clique
Fonte de Recurso (ex.: 1500, 1540, 1550...)
```

O **breadcrumb** no topo permite voltar a qualquer nível anterior.

### Exportar o relatório

Clique em **"⬇ Exportar CSV"** para baixar a visão atual (agrupamento e filtros ativos) como planilha.

---

## Exportar o Relatório de Validações (PDF)

Clique em **"Gerar Relatório Oficial (PDF)"** na aba Validações. O PDF contém:

1. Cabeçalho — ente, período, data e versão do MDF
2. Caixas de resumo coloridas
3. Tabela de Erros Críticos `[IMPEDITIVO]`
4. Tabela de Avisos `[AVISO]`
5. Orientações compactadas (link para siconfi.tesouro.gov.br)
6. **Plano de Correção Contábil** — lançamentos PCASP D/C com valores e referência normativa

> Os lançamentos são sugestões. Confirme os valores com o contador antes de registrar.

---

## Principais Regras — Referência Rápida

### D1 — Qualidade da MSC

| Regra | Problema | Correção |
|---|---|---|
| D1_00001 | RREO/RGF/DCA não entregues | Enviar no portal Siconfi |
| D1_00017 | Valores negativos na MSC | Corrigir no sistema contábil |
| D1_00018 | SI + MOV ≠ SF | Revisar lançamentos ou reclassificações de IC |
| D1_00021 | Ativo com natureza credora | Verificar depreciação acumulada (exceção legítima) |
| D1_00025 | Passivo com natureza devedora | Revisar pagamentos sem liquidação prévia |
| D1_00029 | Receita sem Fonte de Recurso | Preencher campo FR nas contas 6211/6212/6213 |
| D1_00031 | Despesa sem natureza de despesa | Preencher campo ND nas contas 62213 |
| D1_00032 | Despesa sem função/subfunção | Preencher campo FS nas contas 622xxx |

### D2 — Consistência Patrimonial

| Regra | Problema | Correção |
|---|---|---|
| D2_MSC_EQUILIBRIO | Desequilíbrio D≠C | Corrigir lançamentos com natureza D/C invertida |
| D2_00067/68 | Depreciação > valor bruto | Estornar excesso (NBC TSP 07) |
| D2_00081 | Sem provisão de férias/13º | D 311210103 / C 211110102 mensalmente |
| **D2_00083** ⚠️ CAPAG | **DDR desequilibrado** | **D 721110000 / C 821110000 pela diferença apurada** |
| D2_00094 | RPPS sem encargo patronal | D 312120100 / C 211110200 |
| D2_00095 | RGPS sem INSS/FGTS | Registrar INSS (20%) e FGTS (8%) |

> **D2_00083 é risco CAPAG** porque o DDR é o mecanismo contábil que separa disponibilidades vinculadas de não vinculadas. Um desequilíbrio distorce o Indicador de Liquidez (IL) do CAPAG e degrada o Ranking ICF — podendo bloquear a elegibilidade para crédito com garantia da União (Portaria MF nº 1.583/2023).

### D3 — Demonstrativos Fiscais

| Regra | Problema | Correção |
|---|---|---|
| D3_00005 | RCL diverge entre RREO e RGF | Equalizar RREO Anexo 03 e RGF Anexo 01 |
| D3_00008 | DCL diverge entre demonstrativos | Verificar Dívida Consolidada Líquida |

---

## Erros Comuns e Soluções

### Página em branco ao abrir
Limpar o cache: **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac).

### Aba "Relatórios de Execução" não aparece
A aba só aparece quando a MSC contém contas 622xxx com Função/Subfunção (FS) preenchida. Verifique se o arquivo foi carregado corretamente.

### Relatório de Execução com valores zerados
Use o toggle **"Acumulado"** em vez de "Movimentação" — pode ser que o `period_change` esteja zerado mas o `ending_balance` tenha os saldos acumulados.

### PDF com poucos resultados
Verifique o filtro ativo. "Riscos CAPAG" exibe apenas 2–5 regras. Selecione **"Todas as Regras"** para o relatório completo.

### Sistema não mostrou resultados de RREO/RGF
Verifique se o nome do arquivo contém "rreo" ou "rgf" — o sistema usa o nome para identificar o tipo.

### D1_00018 disparou muitos avisos
Reclassificações de IC (Fonte de Recurso, Natureza de Despesa) entre períodos geram esse aviso legitimamente. Verifique apenas registros com diferença > R$ 1.000.

---

## Perguntas Frequentes

**Meus dados estão seguros?**  
Sim. Todo o processamento é no seu navegador. A única conexão externa é à API pública do Siconfi (extrato de entregas).

**Os Relatórios de Execução substituem o RREO Anexo 02?**  
Não — são gerados diretamente da MSC e servem para análise e conferência. O RREO Anexo 02 é o demonstrativo oficial. Use os relatórios para cruzar e identificar divergências antes do envio.

**Por que D2_00083 (DDR) é risco CAPAG?**  
O CAPAG Indicador de Liquidez usa apenas disponibilidades de fontes não vinculadas. O DDR faz essa separação — um desequilíbrio distorce o IL e degrada o Ranking ICF, podendo bloquear o município para crédito com garantia da União.

**O validador substitui o envio no SICONFI?**  
Não. É pré-validação. O envio oficial continua sendo feito em siconfi.tesouro.gov.br.

**Quantas regras o sistema valida?**  
99 regras implementadas (D1–D4) das ~197 do catálogo oficial STN.

**Posso enviar vários meses de MSC de uma vez?**  
Sim. O sistema valida cada mês separadamente e verifica a completude do exercício (D1_00016).
