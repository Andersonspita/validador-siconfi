# Diário de Implementação — Validador Siconfi

Registro cronológico das principais decisões técnicas e evoluções do projeto.

---

## 2026-06-26 — v3.3.0

**Firebase opcional + Correção de tela em branco no GitHub Pages**

O app crashava silenciosamente no GitHub Pages porque `firebase.ts` tentava `initializeApp()` com todas as credenciais `undefined` (o `.env` não existe no GitHub Pages). A correção torna o Firebase completamente opcional: `isFirebaseConfigured` verifica se as env vars existem antes de inicializar. Sem Firebase, o app abre direto na tela de upload sem login. `rulesMetadata.ts` passou a ter `.catch()` no fetch do CSV para não crashar com 404.

**D2_00083 marcada como risco CAPAG**

Após análise da Portaria MF nº 1.583/2023 e da metodologia de cálculo do Indicador de Liquidez, confirmou-se que um DDR desequilibrado impacta o CAPAG por dois canais: (1) distorção do IL que usa apenas fontes não vinculadas, (2) degradação do Ranking ICF que desde 2023 bloqueia elegibilidade para crédito com garantia da União.

---

## 2026-06-26 — v3.2.0

**Lançamentos contábeis corretivos por regra**

Criado `correctiveEntries.ts` mapeando 14 regras a lançamentos PCASP D/C com valores calculados automaticamente. O módulo é chamado em `validators/index.ts` após `runValidations()` via `enrichWithCorrectiveEntries()`. `SuggestedEntry` adicionada a `types.ts` e `suggestedEntries?` a `ValidationResult`. O PDF ganhou uma seção dedicada "Plano de Correção Contábil". Criado `scripts/test-and-pdf.mts` para uso em CLI.

---

## 2026-06-25 — v3.1.0 (Auditoria QA — Lopes Consultoria)

**9 bugs corrigidos, 25 testes adicionados**

Auditoria com Claude Sonnet 4.6 identificou 11 achados (1 crítico, 3 altos, 5 médios/baixos). O crítico (QA-001) era um filtro `CONTA.startsWith('62213.01')` com ponto — códigos PCASP são puramente numéricos, então a condição nunca era satisfeita, forçando `mscDespesasEmpenhadas = R$0` e gerando falso erro impeditivo permanente na D2_00050.

Os bugs de alto impacto eram todos no parser de ZIP: CSV sem detecção de encoding (windows-1252 corrompido), XLS/XLSX ignorados silenciosamente, e fallback de encoding sem validar presença do cabeçalho `CONTA;`.

`pdfGenerator.ts` foi refatorado com `buildDoc()` unificado eliminando duplicação entre `generatePDF` (browser) e `generatePDFBuffer` (Node/CLI). Layout A4 corrigido (22+80+80 = 182mm, zero overflow). Orientações de servidor compactadas em 1 linha.

---

## 2026-06-25 — v3.0.0

**Validação por período e DDR corrigido**

Revisão pós-testes reais com MSC de PM Teixeira de Freitas (16.037 linhas). O equilíbrio D=C foi confirmado como perfeito (diferença exata de R$0,00) e o DDR desequilibrado (R$87,1M) foi identificado e reportado corretamente. Validação migrada de `msc[]` concatenado para `mscByPeriod` para evitar falsos positivos quando múltiplos meses são enviados. DDR ajustado para usar subgrupos `7211` × `8211` (excluindo garantias 722/822). Integração com API da STN para checar homologação de entregas.
