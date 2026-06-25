# Status do Projeto — Validador Siconfi

> Documento de continuidade para retomada do desenvolvimento.
>
> **Última atualização:** 25 de Junho de 2026  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Resumo executivo

O **Validador Siconfi** é uma SPA React/TypeScript que executa validações fiscais e contábeis **no navegador**, replicando regras D1–D4 do SICONFI (STN). Nenhum arquivo financeiro é enviado a servidores próprios — o processamento é 100% client-side.

Após auditoria QA (jun/2026), o motor foi corrigido em pontos críticos: equilíbrio D=C, validação MSC **por período**, DDR (7211×8211), parser com encoding legado, exportação PDF e testes automatizados.

---

## 2. O que está pronto

| Área | Status |
|------|--------|
| Upload MSC / RREO / RGF / DCA / ZIP | ✅ |
| Parser MSC (UTF-8, Windows-1252, IBGE 7 dígitos, múltiplos meses) | ✅ |
| Validação D1 (qualidade MSC, entrega, encerramento) | ✅ |
| Validação D2 (consistência patrimonial, DCA, equilíbrio D=C) | ✅ |
| Validação D3 (RREO, RGF, CAPAG) | ✅ |
| Validação D4 (cruzamentos MSC × RREO/RGF/DCA) | ✅ |
| Extratores XLS (`xmlExtractors.ts`) | ✅ |
| Metadados das regras (`Descricao_verificacoes.csv`) | ✅ |
| API Siconfi — extrato de entregas (D1_00001) | ✅ parcial |
| Relatório PDF + CSV | ✅ |
| Testes Vitest (parser + utils) | ✅ |
| Deploy GitHub Pages | ✅ |
| Autenticação Firebase | ✅ |

---

## 3. Arquivos críticos

| Arquivo | Função |
|---------|--------|
| `src/core/parsers.ts` | Leitura CSV/XLS/XML/ZIP → `ParsedData` |
| `src/core/pcaspRules.ts` | Constantes PCASP externalizadas (MDF 15ª ed.) |
| `src/core/validators/index.ts` | Orquestrador `runValidations()` |
| `src/core/validators/rulesD1.ts` … `rulesD4.ts` | Implementação das regras por dimensão |
| `src/core/validators/utils.ts` | Helpers: equilíbrio D=C, somas, comparações |
| `src/core/xmlExtractors.ts` | Extração de valores de planilhas RREO/RGF/DCA |
| `src/core/pdfGenerator.ts` | Relatório PDF |
| `src/core/rulesMetadata.ts` | Carrega descrições oficiais das regras |
| `src/services/siconfiApi.ts` | API STN (extrato de entregas) |
| `scripts/run-local-validation.mts` | Teste local via CLI (ZIP/MSC) |
| `public/data/Descricao_verificacoes.csv` | Catálogo oficial STN (~197 regras) |

---

## 4. Cobertura de regras (visão honesta)

O CSV oficial lista **~197 verificações**. O validador cobre a maior parte das regras **passíveis de execução offline** com os arquivos disponíveis.

| Categoria | Comportamento |
|-----------|---------------|
| Regras com lógica matemática/contábil | Implementadas em `rulesD1`–`rulesD4` |
| Regras que exigem metadados do servidor SICONFI | Emitidas como `[ORIENTAÇÃO]` (`info`) — ex.: D1_00002–15 |
| Regras que exigem DCA/RREO/RGF ausentes no upload | Não executadas ou aviso de arquivo faltante |
| Equilíbrio geral MSC D=C | `D2_MSC_EQUILIBRIO` (por tipo de saldo) |

**Referência normativa configurável:** `MDF 15ª edição` em `pcaspRules.ts`.

### Verificação local

```bash
npm test
npx tsx scripts/run-local-validation.mts "arquivo.zip"
```

---

## 5. Melhorias recentes (auditoria QA — jun/2026)

1. **Equilíbrio D=C** — `validateEquilibrioGeral()` verifica `SUM(D)=SUM(C)` por `beginning_balance`, `period_change` e `ending_balance`.
2. **MSC por período** — regras D1/D2 rodam sobre cada mês em `mscByPeriod`, não sobre dados concatenados.
3. **DDR** — D2_00083 usa subgrupos `7211` × `8211` (exclui garantias/avais 722/823).
4. **D1_00021** — exclui depreciação acumulada (`1238101`, `1238102`).
5. **D1_00026** — exclui deduções do PL com natureza D legítima.
6. **D2_00081** — provisões `211110102`, `211110103`, `211110104` no `ending_balance`.
7. **D4** — cruzamentos de receita usam campo **CO** (natureza da receita), não D/C.
8. **Parser** — fallback encoding; normalização IBGE; `anoReferencia` para API.
9. **PDF** — nome com ente/período, `detailedItems`, versão MDF.
10. **Removidas** regras D2 fictícias que marcavam “validado” sem lógica real.

---

## 6. Pendências conhecidas

| Item | Prioridade | Notas |
|------|------------|-------|
| Regras D2 de encerramento ainda não implementadas (ex.: D2_00069–74 MSC×DCA) | Média | Requer extratores DCA + MSC encerramento |
| Tempestividade exata (prazos LRF por bimestre) | Baixa | API retorna homologação, não prazo legal |
| D1_00038 — volume de avisos em contas 5/6 | Baixa | Expandir lista de exceções em `pcaspRules.ts` |
| Performance MSC > 50k linhas | Baixa | Monitorar no browser |
| CI/CD com testes no GitHub Actions | Baixa | `npm test` manual hoje |
| Firebase no GitHub Pages | Média | Variáveis `VITE_*` no build de deploy |

---

## 7. Contexto de negócio

- **Cliente:** Lopes Consultoria Contábil
- **Público-alvo:** Contadores de prefeituras
- **Motivação:** Antecipar erros SICONFI e proteger nota **CAPAG**
- **Deploy:** GitHub Pages (`npm run deploy`)

---

## 8. Comandos úteis

```bash
npm run dev       # desenvolvimento
npm test          # Vitest
npm run build     # produção
npm run deploy    # GitHub Pages
```
