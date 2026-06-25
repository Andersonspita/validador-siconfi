# Manual do Usuário — Validador Siconfi

> Versão 3.0 · Atualizado em 2026-06-25  
> **Aplicação:** https://andersonspita.github.io/validador-siconfi/

---

## O que é o Validador Siconfi?

O Validador Siconfi é uma ferramenta que **simula localmente as verificações do sistema SICONFI da Secretaria do Tesouro Nacional (STN)**, permitindo que o contador do município identifique e corrija erros nos arquivos fiscais **antes** de enviá-los ao portal.

### Para que serve?

O Siconfi utiliza um sistema de pontuação chamado **Ranking da Qualidade da Informação**, dividido em quatro dimensões:

| Dimensão | Nome | O que avalia |
|---|---|---|
| D1 | Gestão da Informação | Entrega, completude e qualidade dos arquivos enviados |
| D2 | Consistência Contábil | Coerência interna dos saldos contábeis (MSC) |
| D3 | Fiscal | Igualdade de valores entre demonstrativos (RREO, RGF) |
| D4 | Cruzamento | Coerência entre MSC e demonstrativos fiscais |

Uma parte dessas verificações (Dimensão D3/D4) afeta diretamente a nota **CAPAG** do município — a Capacidade de Pagamento avaliada pelo Tesouro Nacional, que influencia o acesso a crédito e transferências.

### Vantagens

- **Sigilo total:** os arquivos são processados dentro do seu navegador. Nenhum dado financeiro é enviado para servidores próprios.
- **Gratuito e acessível:** funciona em qualquer computador com browser moderno.
- **Antecipação de erros:** corrija os problemas antes que o Siconfi penalize o município.
- **Relatório PDF:** documento pronto para impressão com plano de ação corretiva.

---

## Acesso ao Sistema

1. Abra o navegador (Chrome, Edge ou Firefox recomendados)
2. Acesse: **https://andersonspita.github.io/validador-siconfi/**
3. Faça login com seu e-mail e senha cadastrados

> **Esqueceu a senha?** Entre em contato com o administrador do sistema para redefinição via Firebase.
>
> **Alterar senha:** após o login, clique no ícone de chave (🔑) no canto superior direito.

---

## Tela Principal

Após o login você verá a tela de upload com uma mensagem de boas-vindas. No canto superior direito há:

| Ícone | Função |
|---|---|
| ☀️ / 🌙 | Alternar entre modo claro e escuro |
| 🔑 | Alterar senha |
| ↩️ | Sair (logout) |

---

## Como Validar Seus Arquivos

### Passo 1 — Obter os arquivos no seu sistema contábil

Exporte os seguintes arquivos do seu sistema de contabilidade pública:

| Arquivo | Formato | Quando usar |
|---|---|---|
| **MSC** — Matriz de Saldos Contábeis | `.csv` (separador `;`) | Sempre (obrigatório para validações D1/D2) |
| **RREO** — Relatório Resumido de Execução Orçamentária | `.xls`, `.xlsx`, `.xml` ou `.zip` | Para validações D3/D4 |
| **RGF** — Relatório de Gestão Fiscal | `.xls`, `.xlsx`, `.xml` ou `.zip` | Para validações D3 (RCL, DCL) |
| **DCA** — Declaração de Contas Anuais | `.xls`, `.xlsx`, `.xml` ou `.zip` | Validações D2 avançadas |

> **Dica:** Para a maior cobertura de validações, envie a MSC + RREO + RGF juntos.
>
> **Arquivo ZIP:** o sistema abre automaticamente arquivos `.zip` gerados pelo Siconfi e extrai o CSV/XML interno.

### Passo 2 — Fazer o upload

Você pode:
- **Arrastar e soltar** os arquivos diretamente na área de upload, ou
- **Clicar** na área para abrir o seletor de arquivos

É possível enviar múltiplos arquivos de uma só vez (ex: MSC + RREO + RGF ao mesmo tempo).

> **Para validar múltiplos meses:** envie os CSVs de vários meses juntos. O sistema detecta o período de cada MSC (cabeçalho `YYYY-MM`) e valida **cada mês separadamente**, além de verificar a completude do exercício (regra D1_00016).

### Passo 3 — Aguardar o processamento

O sistema exibe um indicador de carregamento enquanto:
1. Lê e interpreta os arquivos (com detecção automática de encoding)
2. Consulta a API do Siconfi (quando o código IBGE e o exercício são detectados na MSC)
3. Executa as regras de validação D1–D4
4. Monta o painel de resultados

O processamento leva alguns segundos, dependendo do tamanho dos arquivos.

> **Erro de leitura:** se algum arquivo não puder ser interpretado, uma mensagem de erro aparece no topo do painel de resultados, indicando qual arquivo falhou.

---

## Entendendo os Resultados

### Painel de Resumo

No topo do painel você verá cinco cartões:

| Cartão | Significado |
|---|---|
| **Inconsistências (Erros + Avisos)** | Total de problemas que reduzem a qualidade ou impedem homologação |
| **Erros Críticos** | Problemas graves que podem impedir o envio ou causar rejeição pelo Siconfi |
| **Avisos** | Alertas que merecem correção antes do envio |
| **Informativos** | Orientações e dados para conferência manual (não reduzem nota) |
| **Riscos CAPAG** | Problemas que afetam a nota CAPAG do município |

### Tipos de resultado

| Ícone | Severidade | Quando ocorre |
|---|---|---|
| 🔴 ✗ | **Erro** | Viola uma regra obrigatória do Siconfi (ex: valores negativos na MSC, desequilíbrio D≠C) |
| 🟡 ⚠ | **Aviso** | Possível problema que reduz a nota de qualidade (ex: conta do ativo com natureza credora) |
| 🔵 ℹ | **Informação** | Não é um erro, mas merece atenção (ex: entrega pendente no portal, classes ausentes legítimas) |

### Identificando problemas de CAPAG

Cards com a badge **CAPAG** em vermelho indicam problemas que afetam diretamente a nota do município no Tesouro Nacional. Esses devem ser corrigidos com **máxima prioridade**.

---

## Filtros

Use os botões de filtro para focar no que importa:

| Filtro | Mostra |
|---|---|
| **Todas as Regras** | Todos os resultados |
| **Erros** | Apenas erros críticos que impedem a homologação |
| **Avisos** | Alertas e potenciais falhas de preenchimento |
| **Informativos** | Orientações e dados para conferência manual |
| **🛡 Riscos CAPAG** | Apenas regras com impacto na nota CAPAG |

---

## Detalhamento das Inconsistências

Cada card de resultado contém:

- **ID da regra** (ex: `D1_00017`) — código oficial do Siconfi
- **Dimensão** (D1, D2, D3 ou D4)
- **Período** — mês da MSC quando aplicável (ex: `2026-01`)
- **Badge CAPAG** — se a regra impacta a nota
- **Descrição** — nome oficial da regra conforme a STN
- **Mensagem** — explicação detalhada do problema encontrado
- **Contas afetadas** — lista de códigos PCASP que apresentaram o problema

### Ver detalhes de lançamentos

Em muitas regras você pode clicar em **"Ver os N lançamentos detalhados"** para expandir uma tabela com:

| Coluna | Conteúdo |
|---|---|
| Conta | Código PCASP do lançamento |
| PO | Poder/Órgão |
| FR | Fonte de Recurso |
| Valor | Valor monetário (R$) |
| Detalhe | Informação adicional (natureza, tipo, etc.) |

---

## Exportar o Relatório

Você possui duas opções de exportação:

1. **Gerar Relatório Oficial (PDF):** Gera um documento formatado e pronto para impressão, separando Erros Críticos de Avisos. O relatório PDF inclui:
   - Tags `[IMPEDITIVO]` e `[RISCO CAPAG]` junto à descrição
   - Coluna de **Plano de Ação Corretiva** sugerindo como corrigir o problema
   - Metadados do ente (código IBGE) e período no nome do arquivo
   - Versão do Manual de Demonstrações Fiscais (MDF) utilizada

2. **Exportar CSV:** Baixa um arquivo `.csv` bruto que pode ser aberto no Excel para análise mais granular. Contém as colunas:

```
Regra | Dimensão | Severidade | Risco CAPAG | Descrição | Mensagem | Conta | PO | FR | CO | Valor | Detalhe
```

> **Dica:** Filtre por "Riscos CAPAG" ou "Erros" na tela antes de exportar o CSV caso queira analisar apenas um tipo específico de problema.

---

## Começar Nova Validação

Para validar um novo conjunto de arquivos, clique no botão **"← Voltar e Enviar Outros"** no topo do painel de resultados.

---

## Descrição das Principais Regras

### D1 — Qualidade da MSC

| Regra | Problema | Como corrigir |
|---|---|---|
| D1_00001 | RREO/RGF/DCA não entregues no Siconfi | Envie os demonstrativos pendentes no portal Siconfi |
| D1_00017 | Valores negativos na MSC | O Siconfi não aceita valores negativos. Verifique os lançamentos e corrija no sistema contábil |
| D1_00018 | SI + MOV ≠ SF | O saldo inicial mais a movimentação do período não resulta no saldo final. Revise os lançamentos da conta indicada |
| D1_00021 | Contas do ativo com natureza credora | Contas dos grupos 1111, 1121, 1125, 1231 e 1232 devem ter natureza Devedora (D). Depreciação acumulada (1238101/1238102) é exceção legítima |
| D1_00025 | Contas do passivo com natureza devedora | Contas de passivo circulante e não-circulante devem ter natureza Credora (C) |
| D1_00027 | Atributo F sem Fonte de Recurso | Toda conta com atributo de superávit financeiro (FP=F) deve ter a fonte de recurso (FR) preenchida |
| D1_00028 | Classes de contas ausentes | A MSC deve conter lançamentos em todas as 8 classes do PCASP |
| D1_00029 | Receita sem Fonte de Recurso | Contas 6211/6212/6213 precisam do campo FR preenchido |
| D1_00031 | Despesa sem natureza de despesa | Contas 62213 precisam da natureza de despesa (campo ND/IC5) preenchida |
| D1_00032 | Despesa sem função/subfunção | Contas 622xxx precisam do campo função/subfunção (FS/IC2) preenchido |
| D1_00036 | VPA/VPD com saldo na MSC de encerramento | No encerramento do exercício, as contas de variação patrimonial (classes 3 e 4) devem ser zeradas |
| D1_00037 | Fontes de recurso da União (001–499) | Municípios e estados não devem usar fontes de recurso reservadas à União |

### D2 — Consistência Patrimonial

| Regra | Problema | Como corrigir |
|---|---|---|
| D2_MSC_EQUILIBRIO | Desequilíbrio D≠C na MSC | A soma dos débitos deve ser igual à soma dos créditos em cada tipo de saldo (SI, movimentação, SF) |
| D2_00067 | Depreciação bens móveis > valor dos bens | A depreciação acumulada não pode superar o valor bruto do ativo |
| D2_00068 | Depreciação bens imóveis > valor dos bens | Idem para bens imóveis |
| D2_00080 | Estoques zerados | Verifique se o almoxarifado foi devidamente registrado |
| D2_00081 | Sem provisão de férias/13º salário | A competência exige provisão mensal (contas 211110102, 211110103, 211110104) |
| D2_00083 | DDR desequilibrado | Os saldos finais das contas de controle **7211** (devedora) e **8211** (credora) devem ser iguais |
| D2_00094 | RPPS sem encargo patronal | Se há despesa com pessoal RPPS, deve haver contribuição patronal registrada |

### D3 — Igualdade entre Demonstrativos

| Regra | Problema | Como corrigir |
|---|---|---|
| D3_00005 | RCL diverge entre RREO e RGF | O valor da Receita Corrente Líquida deve ser igual no RREO Anexo 03 e no RGF Anexo 01 |
| D3_00006 | DCL diverge entre RREO e RGF | A Dívida Consolidada Líquida deve ser igual no RREO Anexo 06 e no RGF Anexo 02 |
| D3_00021 | Passivo financeiro < Restos a Pagar | O passivo financeiro (contas 21/22 com atributo F) não pode ser menor que os Restos a Pagar inscritos |
| D3_00012/013 | Valores negativos no RREO/RGF | Os demonstrativos fiscais não devem ter valores negativos (exceto linhas de resultado) |

### D4 — Cruzamentos MSC × Demonstrativos

| Regra | Problema | Como corrigir |
|---|---|---|
| D4_00020 | Receita arrecadada MSC ≠ RREO | O total de receitas arrecadadas na MSC (6212, natureza CO) deve coincidir com o RREO Anexo 01 |

---

## Erros Comuns e Soluções

### "Nenhuma inconsistência encontrada para o filtro selecionado"

Isso é ótimo! Significa que não foram identificados problemas para o filtro ativo. Verifique se carregou os arquivos corretos e tente mudar o filtro para "Todas as Regras".

### O sistema não mostrou resultados de RREO/RGF

Verifique se:
1. O arquivo foi aceito no upload (deve aparecer na lista)
2. O nome do arquivo contém "rreo" ou "rgf" (o sistema usa o nome para identificar o tipo)
3. O formato é XLS exportado pelo portal Siconfi (não PDF)

### A regra D3_00005 (RCL) mostra erro, mas os valores parecem corretos

Isso pode ocorrer se:
- Os arquivos RREO e RGF são de municípios diferentes (verifique os metadados no card)
- O arquivo RREO é um template em branco (sem dados preenchidos)
- O formato de célula no XLS é texto em vez de número

### O validador não encontrou dados no RREO/RGF

O sistema pode exibir uma mensagem `info` informando que não conseguiu extrair dados do arquivo. Isso geralmente indica que:
- O arquivo está em formato XML (não XLS) — algumas regras só funcionam com XLS
- O arquivo é uma versão muito antiga do template Siconfi

### Caracteres estranhos na MSC (acentos corrompidos)

O sistema tenta automaticamente UTF-8, Windows-1252 e ISO-8859-1. Se ainda houver problemas, reexporte a MSC em UTF-8 pelo sistema contábil.

---

## Perguntas Frequentes

**Meus dados estão seguros?**
Sim. Todo o processamento acontece no seu navegador. Nenhum dado financeiro é enviado para servidores próprios. A única consulta externa é à API pública do Siconfi (extrato de entregas), que não envia o conteúdo dos seus arquivos.

**Posso usar o validador para qualquer município?**
Sim. O validador é compatível com qualquer município brasileiro que use o SICONFI.

**O validador substitui o envio no SICONFI?**
Não. O validador é uma ferramenta de pré-validação. O envio oficial deve ser feito pelo portal do Siconfi (siconfi.tesouro.gov.br).

**Por que algumas regras aparecem como "info" e não como "aviso"?**
Regras como D1_00028 (classes 7 e 8 ausentes) são classificadas como `info` porque municípios sem RPPS podem legitimamente não ter essas classes. Um `info` não reduz pontuação — é apenas uma verificação de atenção.

**Quantas regras o sistema valida?**
O catálogo oficial STN lista ~197 verificações. O validador implementa a maior parte das regras passíveis de execução offline com os arquivos disponíveis. Regras que exigem metadados exclusivos do servidor Siconfi aparecem como orientação (`info`).

**O arquivo ZIP do Siconfi funciona?**
Sim. O sistema abre ZIPs automaticamente e extrai os arquivos CSV e XML internos.

**Posso enviar vários meses de MSC de uma vez?**
Sim. O sistema detecta o período de cada MSC pelo cabeçalho e valida cada mês separadamente, além de verificar a completude do exercício (regra D1_00016).
