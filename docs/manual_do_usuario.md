# Manual do Usuário — Validador Siconfi

> **Versão 3.5.0** · Atualizado em 2026-06-26  
> **Aplicação:** https://andersonspita.github.io/validador-siconfi/

---

## O que é o Validador Siconfi?

O Validador Siconfi é uma ferramenta que **simula localmente as verificações do SICONFI da STN**, gera **relatórios analíticos de execução orçamentária** e estima a **nota CAPAG** do município, tudo dentro do seu navegador — nenhum dado financeiro é enviado para servidores externos.

---

## Acesso ao Sistema

1. Acesse: **https://andersonspita.github.io/validador-siconfi/**
2. Faça login com e-mail e senha cadastrados no Firebase
3. A sessão dura enquanto a aba estiver aberta — fechar a aba encerra a sessão automaticamente
4. Após 30 minutos sem interação o sistema desloga automaticamente

---

## Como Validar os Arquivos

### Quais arquivos enviar

O sistema aceita quatro tipos de arquivo. A MSC é obrigatória; os demais são opcionais e cada um habilita novos cruzamentos:

| Arquivo | Formato aceito | Obrigatório | O que habilita |
|---|---|---|---|
| **MSC** — Matriz de Saldos Contábeis | `.csv` ou `.zip` | ✅ Sim | D1 + D2 + Relatórios de Execução + CAPAG estimado |
| **RREO** — Rel. Resumido de Exec. Orçamentária | `.xls`, `.xlsx`, `.xml`, `.zip` | Opcional | D3 + D4 (cruzamento com MSC) |
| **RGF** — Relatório de Gestão Fiscal | `.xls`, `.xlsx`, `.xml`, `.zip` | Opcional | D3 fiscal — RCL e DCL cruzados entre RREO e RGF |
| **DCA** — Declaração de Contas Anuais | `.xls`, `.xlsx`, `.xml`, `.zip` | Opcional | D2 avançado — cruzamento MSC × DCA anual |

> 💡 **Dica:** selecione os quatro arquivos de uma vez na mesma janela de upload — o sistema identifica cada um automaticamente pelo nome e executa todos os cruzamentos disponíveis. Para cobertura máxima das 99 regras, envie MSC + RREO + RGF + DCA juntos.

### Como o sistema identifica cada arquivo

O parser lê o nome do arquivo: se contiver "rreo" → trata como RREO; "rgf" → RGF; "dca" → DCA; qualquer `.csv` → MSC. Arquivos ZIP são abertos e o conteúdo interno é classificado da mesma forma.

### Cruzamentos entre arquivos (D3 e D4)

Alguns erros só são detectáveis com múltiplos arquivos:

| Regra | Exige |
|---|---|
| D3_00005 — RCL igual entre RREO e RGF | RREO **e** RGF |
| D3_00008 — DCL igual entre demonstrativos | RREO **e** RGF |
| D4 — valores MSC × RREO | MSC **e** RREO |
| D2_DCA — saldos MSC × DCA | MSC **e** DCA |

Se você enviar só a MSC, as validações D3 e D4 são ignoradas sem erro — o sistema valida o que puder com o que recebeu.

### Passo a passo

1. Arraste os arquivos para a área de upload (ou clique em "Selecionar Arquivos")
2. Aguarde o processamento (alguns segundos)
3. Navegue pelas abas: **Validações**, **Relatórios de Execução**, **CAPAG & CAUC**

---

## As Três Abas do Painel

### Aba "Validações"

Exibe os resultados das regras D1–D4 com filtros e exportação.

**Painel de resumo:**

| Cartão | Significado |
|---|---|
| Inconsistências (Erros + Avisos) | Total de problemas que reduzem a qualidade |
| Erros Críticos | Impedem homologação no Siconfi |
| Avisos | Merecem correção antes do envio |
| Informativos | Verificações do servidor — conferir no portal |
| Riscos CAPAG | Impactam diretamente a nota do município |

**Filtros:** Todas as Regras · Erros · Avisos · Informativos · 🛡 Riscos CAPAG

> ⚠️ O PDF inclui apenas os resultados do filtro ativo. Selecione **"Todas as Regras"** para o relatório completo.

### Aba "Relatórios de Execução"

Agrega despesas da MSC (contas 622xxx) por Função, Subfunção, Fonte de Recurso, Natureza de Despesa ou Órgão, com drill-down interativo:

```
Função (ex.: 12 - Educação)
    ↓ clique
Subfunção (ex.: 12361, 12365...)
    ↓ clique
Fonte de Recurso (ex.: 1500, 1540...)
```

Toggle **Movimentação** (dados do mês) × **Acumulado** (saldo final). Export CSV da visão atual.

### Aba "CAPAG & CAUC"

**CAPAG estimado** — calcula os 3 indicadores diretamente da MSC:
- Endividamento (DCL / RCL) → nota A/B/C
- Poupança Corrente (Despesas / Receitas Correntes) → nota A/B/C
- Liquidez (Obrigações / Disponibilidade fontes livres) → nota A/B/C
- Nota geral estimada

> ⚠️ Estimativa baseada em MSC mensal. O CAPAG oficial usa DCA anual e RGF semestral.

**CAUC** — o extrato diário não possui API pública (Instrução Normativa STN/MF nº 8/2025). A aba fornece links diretos para:
- Novo CAUC em `sti.tesouro.gov.br`
- TransfereGov.br
- Dados Abertos semanais (Tesouro Transparente)

---

## Assistente IA 🤖

O botão 🤖 no canto inferior direito abre o Assistente Fiscal IA, disponível em todas as telas.

**Sem arquivo carregado:** responde perguntas gerais sobre SICONFI, PCASP, LRF, CAPAG, MDF e contabilidade pública.

**Com arquivo carregado:** recebe o contexto completo das inconsistências encontradas e sugere automaticamente como resolver cada problema. O chat abre sozinho ao carregar o arquivo.

**Configurar:** na primeira abertura, cole sua chave OpenAI (gerada em platform.openai.com/api-keys). A chave fica apenas na sessão do navegador — nunca é salva permanentemente.

---

## Exportar o Relatório PDF

Clique em **"Gerar Relatório Oficial (PDF)"** na aba Validações. O PDF contém:

1. Cabeçalho com ente, período, data e versão do MDF
2. Resumo colorido (impeditivos / avisos / orientações)
3. Erros Críticos `[IMPEDITIVO]` com plano de ação
4. Avisos `[AVISO]` com recomendação
5. Orientações do servidor (link para portal Siconfi)
6. **Plano de Correção Contábil** — lançamentos PCASP D/C com valores calculados automaticamente e referência normativa completa (texto integral)

---

## Principais Regras — Referência Rápida

### D1 — Qualidade da MSC

| Regra | Problema | Correção |
|---|---|---|
| D1_00001 | RREO/RGF/DCA não entregues | Enviar no portal Siconfi |
| D1_00017 | Valores negativos | Corrigir no sistema contábil |
| D1_00018 | SI + MOV ≠ SF | Revisar lançamentos ou reclassificações de IC |
| D1_00021 | Ativo com natureza credora | Verificar se é depreciação acumulada (exceção legítima) |
| D1_00025 | Passivo com natureza devedora | Revisar pagamentos sem liquidação prévia |
| D1_00029–33 | ICs ausentes (FR, ND, FS) | Preencher indicadores de conta no sistema contábil |

### D2 — Consistência Patrimonial

| Regra | Problema | Correção |
|---|---|---|
| D2_MSC_EQUILIBRIO | Desequilíbrio D≠C | Corrigir lançamentos invertidos |
| D2_00067/68 | Depreciação > valor bruto | Estornar excesso (NBC TSP 07) |
| D2_00081 | Sem provisão de férias/13º | D 311210103 / C 211110102 mensalmente |
| **D2_00083** ⚠️ CAPAG | **DDR desequilibrado** | **D 721110000 / C 821110000 pela diferença exata** |
| D2_00094/95 | Sem encargo patronal RPPS/RGPS | Registrar INSS e FGTS sobre a folha |
| D2_LRF_PESSOAL | Pessoal > 60% / 54% / 6% RCL | Adotar medidas do art. 23 LRF |
| D2_LRF_ARO | ARO > 7% RCL | Verificar prazo e liquidação da antecipação |
| D2_LRF_OP_CREDITO | Op. Crédito > 16% RCL | Suspender novas operações |

### D3 — Demonstrativos Fiscais (requer RREO e/ou RGF)

| Regra | Problema |
|---|---|
| D3_00005 | RCL diverge entre RREO e RGF |
| D3_00008 | DCL diverge entre demonstrativos |

---

## Erros Comuns

| Situação | Solução |
|---|---|
| Página em branco ao abrir | **Ctrl+Shift+R** para limpar cache |
| PDF com poucos resultados | Selecionar "Todas as Regras" antes de exportar |
| RREO/RGF não processado | Verificar se o nome do arquivo contém "rreo" ou "rgf" |
| D1_00018 com muitos avisos | Reclassificações de IC são legítimas — verificar apenas diferenças > R$ 1.000 |
| IA não responde | Verificar se a chave OpenAI foi configurada e é válida |
| Aba "Relatórios" não aparece | Enviar arquivo MSC com contas 622xxx e campo FS preenchido |

---

## Perguntas Frequentes

**Meus dados estão seguros?**  
Sim. Todo o processamento é no seu navegador. A única conexão externa é à API pública do Siconfi (extrato de entregas para D1_00001).

**Preciso enviar os quatro arquivos?**  
Não. A MSC é o único obrigatório. Cada arquivo adicional habilita mais cruzamentos — envie o que tiver disponível.

**Por que D2_00083 (DDR) é risco CAPAG?**  
O DDR separa disponibilidades vinculadas de não vinculadas. O Indicador de Liquidez do CAPAG usa apenas fontes não vinculadas — um DDR desequilibrado distorce esse cálculo. Além disso, degrada o Ranking ICF que desde a Portaria MF 1.583/2023 pode bloquear operações de crédito.

**O validador substitui o envio no SICONFI?**  
Não. É pré-validação. O envio oficial continua em siconfi.tesouro.gov.br.

**Posso enviar vários meses de MSC?**  
Sim. O sistema valida cada mês separadamente e verifica a completude do exercício.

**O arquivo ZIP do Siconfi funciona?**  
Sim. O sistema extrai CSV, XML e XLS/XLSX internos automaticamente.
