# Status do Projeto — Validador Siconfi

> **Última atualização:** 15 de Setembro de 2026  
> **Repositório:** https://github.com/Andersonspita/validador-siconfi  
> **GitHub Pages:** https://andersonspita.github.io/validador-siconfi/

---

## 1. Resumo executivo

O **Validador Siconfi** é uma SPA React/TypeScript que executa validações fiscais e contábeis **no navegador**, replicando regras D1–D4 do SICONFI (STN) e gerando relatórios analíticos de execução orçamentária. Nenhum arquivo financeiro sai da máquina do usuário. Firebase é opcional — sem credenciais, o app abre diretamente sem login.

---

## 2. O que está pronto

| Área | Status |
|------|--------|
| Upload MSC / RREO / RGF / DCA / ZIP | ✅ |
| Parser MSC (CSV, XBRL-GL, encoding, múltiplos meses) | ✅ |
| Validação D1–D4 (~99 regras + LRF) | ✅ |
| D2_00069–74 encerramento MSC × DCA (I-E / I-F) | ✅ |
| Lançamentos PCASP corretivos (D1–D4) | ✅ |
| Relatórios de Execução com drill-down | ✅ |
| Ranking STN + Plano de Ação (HTML) | ✅ |
| Relatório PDF na UI | ✅ |
| Scoring com PROPORCAO oficial + infos-orientação | ✅ |
| CAPAG estimado + aba Limites LRF + CAUC | ✅ |
| Assistente IA (OpenAI) | ✅ |
| Layout institucional (header/sidebar) | ✅ |
| Catálogo `public/data/*.csv` versionado | ✅ |
| Testes Vitest | ✅ (~70+) |
| Deploy GitHub Pages | ✅ |
| Firebase opcional | ✅ |

---

## 3. Pendências restantes

| Item | Prioridade | Notas |
|------|------------|-------|
| Refinar layouts DCA muito atípicos (planilhas customizadas) | Baixa | Extratores I-E/I-F já têm fallbacks múltiplos |

Firebase secrets no GitHub Actions: já suportados no `deploy.yml` (opcionais). CI em `ci.yml` roda sem secrets.

---

## 4. Cobertura de regras

O CSV oficial lista **~197 verificações**. O validador cobre as passíveis de execução offline; demais entram como NÃO VERIFICÁVEL no Ranking ou `info` de orientação (não inflacionam o ICF).

Cruzamentos MSC × RREO Anexo 02 já cobertos em D4_00029–33.

---

## 5. Comandos úteis

```bash
npm run dev          # http://localhost:5173
npm test             # Vitest
npx tsc --noEmit
npm run build
npm run deploy
```
