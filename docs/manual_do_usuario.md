# Manual do Usuário — Validador Siconfi

> **Versão 3.3.0** · Atualizado em 2026-06-26  
> **Aplicação:** https://andersonspita.github.io/validador-siconfi/

---

## O que é o Validador Siconfi?

O Validador Siconfi é uma ferramenta que **simula localmente as verificações do SICONFI da Secretaria do Tesouro Nacional (STN)**, permitindo que o contador do município identifique e corrija erros nos arquivos fiscais **antes** de enviá-los ao portal oficial.

### Para que serve?

O Siconfi utiliza um sistema de pontuação chamado **Ranking da Qualidade da Informação**, dividido em quatro dimensões:

| Dimensão | Nome | O que avalia |
|---|---|---|
| D1 | Gestão da Informação | Entrega, completude e qualidade dos arquivos enviados |
| D2 | Consistência Contábil | Coerência interna dos saldos contábeis (MSC) |
| D3 | Fiscal | Igualdade de valores entre demonstrativos (RREO, RGF) |
| D4 | Cruzamento | Coerência entre MSC e demonstrativos fiscais |

Problemas nessas dimensões afetam diretamente a nota **CAPAG** do município — a Capacidade de Pagamento avaliada pelo Tesouro Nacional, que influencia o acesso a crédito e transferências voluntárias.

### Vantagens

- **Sigilo total:** os arquivos são processados dentro do seu navegador. Nenhum dado financeiro é enviado para servidores próprios.
- **Gratuito e acessível:** funciona em qualquer computador com browser moderno (Chrome, Edge ou Firefox).
- **Antecipação de erros:** corrija os problemas antes que o Siconfi penalize o município.
- **Relatório PDF completo:** documento pronto para impressão com o plano de ação corretiva e os **lançamentos contábeis PCASP sugeridos** para cada inconsistência.

---

## Acesso ao Sistema

1. Abra o navegador (Chrome, Edge ou Firefox recomendados)
2. Acesse: **https://andersonspita.github.io/validador-siconfi/**

> A aplicação pode funcionar com ou sem login, dependendo da configuração do seu município. Se aparecer tela de login, use suas credenciais cadastradas. Se abrir direto na tela de upload, é só começar.

---

## Tela Principal

Ao acessar você verá a tela de upload. No canto superior direito há:

| Ícone | Função |
|---|---|
| ☀️ / 🌙 | Alternar entre modo claro e escuro |
| 🔑 | Alterar senha (quando autenticado) |
| ↩️ | Sair (quando autenticado) |

---

## Como Validar Seus Arquivos

### Passo 1 — Obter os arquivos no sistema contábil

Exporte os seguintes arquivos do seu sistema de contabilidade pública:

| Arquivo | Formato | Quando usar |
|---|---|---|
| **MSC** — Matriz de Saldos Contábeis | `.csv` (separador `;`) ou `.zip` | Sempre (obrigatório para D1/D2) |
| **RREO** — Relatório Resumido de Execução Orçamentária | `.xls`, `.xlsx`, `.xml` ou `.zip` | Para validações D3/D4 |
| **RGF** — Relatório de Gestão Fiscal | `.xls`, `.xlsx`, `.xml` ou `.zip` | Para validações D3 (RCL, DCL) |
| **DCA** — Declaração de Contas Anuais | `.xls`, `.xlsx`, `.xml` ou `.zip` | Validações D2 avançadas |

> **Dica:** Para a maior cobertura de validações, envie a MSC + RREO + RGF juntos.

> **Arquivo ZIP:** o sistema abre automaticamente arquivos `.zip` e extrai os CSV, XML e XLS/XLSX internos.

### Passo 2 — Fazer o upload

Você pode:
- **Arrastar e soltar** os arquivos diretamente na área de upload, ou
- **Clicar** na área para abrir o seletor de arquivos

É possível enviar múltiplos arquivos de uma só vez (ex.: MSC + RREO + RGF ao mesmo tempo).

> **Para validar múltiplos meses:** envie os CSVs de vários meses juntos. O sistema detecta o período de cada MSC pelo cabeçalho `YYYY-MM` e valida **cada mês separadamente**.

### Passo 3 — Aguardar o processamento

O sistema executa automaticamente:
1. Leitura dos arquivos (com detecção de encoding: UTF-8, Windows-1252, ISO-8859-1)
2. Consulta à API do Siconfi (quando detecta o código IBGE e o exercício na MSC)
3. Aplicação das 99 regras de validação D1–D4
4. Geração dos lançamentos contábeis corretivos sugeridos
5. Montagem do painel de resultados

O processamento leva alguns segundos dependendo do tamanho dos arquivos.

---

## Entendendo os Resultados

### Painel de Resumo

No topo do painel você verá cinco cartões:

| Cartão | Significado |
|---|---|
| **Inconsistências (Erros + Avisos)** | Total de problemas que reduzem a qualidade ou impedem homologação |
| **Erros Críticos** | Problemas graves — impedem envio ou causam rejeição pelo Siconfi |
| **Avisos** | Alertas que merecem correção antes do envio |
| **Informativos** | Orientações para conferência manual (não reduzem nota) |
| **Riscos CAPAG** | Problemas que afetam a nota CAPAG do município |

### Tipos de resultado

| Ícone | Severidade | Quando ocorre |
|---|---|---|
| 🔴 ✗ | **Erro** | Viola regra obrigatória do Siconfi (ex.: desequilíbrio D≠C, DDR incorreto) |
| 🟡 ⚠ | **Aviso** | Reduz nota de qualidade (ex.: conta do ativo com natureza credora) |
| 🔵 ℹ | **Informativo** | Verificação dependente do servidor Siconfi — não pode ser validada offline |

### Prioridade CAPAG

Cards com a badge **CAPAG** em vermelho indicam problemas que afetam diretamente a nota do município no Tesouro Nacional. Devem ser corrigidos com **máxima prioridade**. Desde a Portaria MF nº 1.583/2023, inconsistências contábeis graves podem bloquear a elegibilidade para operações de crédito com garantia da União.

---

## Filtros

Use os botões de filtro para focar no que importa:

| Filtro | Mostra |
|---|---|
| **Todas as Regras** | Todos os resultados |
| **Erros** | Apenas erros críticos que impedem a homologação |
| **Avisos** | Alertas e potenciais falhas de preenchimento |
| **Informativos** | Orientações para conferência no portal Siconfi |
| **🛡 Riscos CAPAG** | Apenas regras com impacto na nota CAPAG |

> ⚠️ **Atenção ao exportar PDF:** o relatório PDF inclui apenas os resultados **visíveis no filtro ativo**. Para gerar o relatório completo, selecione **"Todas as Regras"** antes de clicar em "Gerar Relatório Oficial (PDF)".

---

## Detalhamento das Inconsistências

Cada card de resultado contém:

- **ID da regra** (ex.: `D2_00083`) — código oficial do Siconfi
- **Dimensão** (D1, D2, D3 ou D4)
- **Período** — mês da MSC quando aplicável (ex.: `[2026-01]`)
- **Badge CAPAG** — se a regra impacta a nota
- **Descrição** — nome oficial da regra conforme a STN
- **Mensagem** — explicação detalhada do problema com os valores exatos encontrados
- **Contas afetadas** — lista de códigos PCASP
- **Ver lançamentos** — expande amostra de até 4 lançamentos detalhados

---

## Exportar o Relatório

### Relatório PDF

Clique em **"Gerar Relatório Oficial (PDF)"** para baixar o documento completo. O relatório contém:

1. **Cabeçalho** — ente IBGE, período, data de geração e versão do MDF
2. **Resumo colorido** — contadores de impeditivos, avisos e orientações
3. **Erros Críticos** — tabela com regra, descrição `[IMPEDITIVO]` e plano de ação
4. **Avisos** — tabela com regra, descrição `[AVISO]` e recomendação
5. **Orientações** — lista compacta das regras dependentes do servidor Siconfi
6. **Plano de Correção Contábil** — lançamentos PCASP D/C sugeridos para cada erro, com débito, crédito, valor calculado e referência normativa (MCASP)

> Os lançamentos contábeis são sugestões. Verifique os valores com o contador responsável antes de registrar.

### Exportar CSV

Baixa um arquivo `.csv` com todos os campos para análise no Excel:

```
Regra | Dimensão | Severidade | Risco CAPAG | Descrição | Mensagem | Conta | PO | FR | CO | Valor | Detalhe
```

---

## Começar Nova Validação

Para validar um novo conjunto de arquivos, clique em **"← Voltar e Enviar Outros"**.

---

## Principais Regras — Guia Rápido

### D1 — Qualidade da MSC

| Regra | Problema | Como corrigir |
|---|---|---|
| D1_00001 | RREO/RGF/DCA não entregues no Siconfi | Envie os demonstrativos pendentes no portal |
| D1_00017 | Valores negativos na MSC | Corrija no sistema contábil — o Siconfi não aceita negativos |
| D1_00018 | SI + MOV ≠ SF | Saldo inicial + movimentação ≠ saldo final. Revisar lançamentos ou verificar reclassificação de IC |
| D1_00021 | Contas do ativo com natureza credora | Grupos 1111/1121/1125/1231/1232 devem ter natureza D. Exceção: depreciação acumulada (1238101/1238102) |
| D1_00025 | Contas do passivo com natureza devedora | Passivo circulante/não-circulante deve ter natureza C |
| D1_00027 | Atributo F sem Fonte de Recurso | Contas com superávit financeiro (FP=F) precisam de FR preenchido |
| D1_00029 | Receita sem Fonte de Recurso | Contas 6211/6212/6213 precisam do campo FR |
| D1_00031 | Despesa sem natureza de despesa | Contas 62213 precisam do campo ND (IC5) |
| D1_00032 | Despesa sem função/subfunção | Contas 622xxx precisam do campo FS (IC2) |
| D1_00036 | VPA/VPD com saldo no encerramento | Classes 3 e 4 devem ser zeradas no encerramento do exercício |
| D1_00037 | Fontes de recurso da União (001–499) | Municípios devem usar fontes ≥ 500 |

### D2 — Consistência Patrimonial

| Regra | Problema | Como corrigir |
|---|---|---|
| D2_MSC_EQUILIBRIO | Desequilíbrio D≠C na MSC | A soma dos débitos deve ser igual à dos créditos (SI, movimentação, SF) |
| D2_00067 | Depreciação bens móveis > valor bruto | Estornar o excesso. Ref.: NBC TSP 07 |
| D2_00068 | Depreciação bens imóveis > valor bruto | Idem para imóveis |
| D2_00081 | Sem provisão de férias/13º salário | Registrar D 311210103 / C 211110102 e D 311210104 / C 211110103 mensalmente |
| **D2_00083** | **DDR desequilibrado** ⚠️ CAPAG | **Ajuste D 721110000 / C 821110000 pelo valor da divergência. Impacta Indicador de Liquidez e Ranking ICF** |
| D2_00094 | RPPS sem encargo patronal | Registrar D 312120100 / C 211110200 (alíquota patronal vigente) |
| D2_00095 | RGPS sem INSS/FGTS | Registrar INSS (20%) e FGTS (8%) sobre a folha |

### D3 — Demonstrativos Fiscais

| Regra | Problema | Como corrigir |
|---|---|---|
| D3_00005 | RCL diverge entre RREO e RGF | O valor deve ser igual no RREO Anexo 03 e no RGF Anexo 01 |
| D3_00008 | DCL diverge entre demonstrativos | Verificar a Dívida Consolidada Líquida em ambos os relatórios |

---

## Erros Comuns e Soluções

### A página ficou em branco ao abrir
Tente limpar o cache do navegador com **Ctrl+Shift+R** (Windows) ou **Cmd+Shift+R** (Mac) e acessar novamente.

### O PDF saiu com poucos resultados
Verifique o filtro ativo no painel. Se "Riscos CAPAG" ou "Erros" estava selecionado, o PDF inclui apenas os resultados desse filtro. Selecione **"Todas as Regras"** antes de exportar para o relatório completo.

### O sistema não mostrou resultados de RREO/RGF
Verifique se:
1. O arquivo foi aceito no upload
2. O **nome do arquivo** contém "rreo" ou "rgf" — o sistema usa o nome para identificar o tipo
3. O formato é XLS/XLSX exportado pelo Siconfi (não PDF)

### Caracteres estranhos na MSC (acentos corrompidos)
O sistema tenta UTF-8, Windows-1252 e ISO-8859-1 automaticamente. Se ainda houver problemas, reexporte a MSC em UTF-8 pelo sistema contábil.

### A regra D1_00018 disparou muitos avisos
Essa regra detecta quando Saldo Inicial + Movimentação ≠ Saldo Final para uma mesma combinação de conta e indicadores. Reclassificações de Fonte de Recurso ou Natureza de Despesa entre períodos geram esse aviso de forma legítima — verifique apenas os lançamentos com diferença acima de R$ 1.000.

---

## Perguntas Frequentes

**Meus dados estão seguros?**  
Sim. Todo o processamento acontece no seu navegador. Nenhum dado financeiro é enviado para servidores próprios. A única consulta externa é à API pública do Siconfi (extrato de entregas).

**O validador substitui o envio no SICONFI?**  
Não. É uma ferramenta de pré-validação. O envio oficial deve ser feito pelo portal siconfi.tesouro.gov.br.

**Por que a regra D2_00083 (DDR) é risco CAPAG?**  
O CAPAG calcula o Indicador de Liquidez (IL) usando apenas disponibilidades de fontes não vinculadas. O DDR (contas 721/821) é o mecanismo contábil que faz essa separação. Um desequilíbrio distorce o IL e, desde a Portaria MF nº 1.583/2023, também degrada o Ranking ICF — o que pode bloquear a elegibilidade para crédito com garantia da União.

**Os lançamentos do PDF são definitivos?**  
São sugestões baseadas nas inconsistências detectadas, com valores calculados a partir dos dados da MSC. Verifique sempre com o contador responsável antes de registrar qualquer lançamento.

**Quantas regras o sistema valida?**  
99 regras implementadas (D1 a D4). O catálogo oficial da STN lista ~197. As não implementadas são as que exigem metadados exclusivos do servidor Siconfi (aparecem como orientação `info`) ou as de encerramento anual MSC×DCA.

**Posso enviar vários meses de MSC de uma vez?**  
Sim. O sistema detecta o período de cada MSC pelo cabeçalho e valida cada mês separadamente, verificando também a completude do exercício (D1_00016).

**O arquivo ZIP do Siconfi funciona?**  
Sim. O sistema abre ZIPs automaticamente e extrai CSV, XML e XLS/XLSX internos.
