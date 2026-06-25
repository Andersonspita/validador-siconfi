# Validador Siconfi

SPA React/TypeScript que valida **localmente** arquivos da MSC, RREO, RGF e DCA conforme as regras D1–D4 do [SICONFI](https://siconfi.tesouro.gov.br) (STN). Os dados **não saem do navegador** do usuário.

**Aplicação publicada:** https://andersonspita.github.io/validador-siconfi/

**Repositório:** https://github.com/Andersonspita/validador-siconfi

---

## Funcionalidades

- Upload de **MSC** (`.csv`), **RREO/RGF/DCA** (`.xls`, `.xlsx`, `.xml`, `.zip`)
- Validação por **dimensão** (D1 qualidade, D2 contábil, D3 fiscal, D4 cruzamentos)
- Detecção de **riscos CAPAG** com filtro dedicado
- Relatório em tela, exportação **CSV** e **PDF** (com plano de ação e metadados do ente)
- Consulta opcional à **API do Siconfi** (homologação de entregas) quando o código IBGE e o exercício são detectados na MSC
- Suporte a **múltiplos meses** de MSC no mesmo upload (validação por período)

---

## Início rápido

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # testes unitários (Vitest)
npm run build        # build de produção → dist/
npm run deploy       # publica no GitHub Pages
```

### Validação local via linha de comando (MSC em ZIP)

```bash
npx tsx scripts/run-local-validation.mts "caminho/para/arquivo.zip"
```

---

## Arquivos aceitos

| Tipo | Formato | Uso |
|------|---------|-----|
| MSC | `.csv` (separador `;`) | Obrigatório para D1/D2 |
| RREO / RGF / DCA | `.xls`, `.xlsx`, `.xml`, `.zip` | D3/D4 e cruzamentos |

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [Manual do usuário](docs/manual_do_usuario.md) | Como usar a ferramenta |
| [Documentação técnica](docs/documentacao_tecnica.md) | Arquitetura, parsers, regras, PCASP |
| [Status do projeto](docs/STATUS_PROJETO.md) | Cobertura, pendências, histórico |

---

## Stack

React 19 · TypeScript · Vite · PapaParse · SheetJS · JSZip · Firebase Auth · jsPDF

---

## Autenticação (Firebase)

Crie um arquivo `.env` na raiz (não versionado):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Para o GitHub Pages, as variáveis precisam estar disponíveis no momento do `npm run build`.

---

## Licença

ISC
