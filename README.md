# Validador Siconfi

Ferramenta de pré-validação fiscal para municípios brasileiros. Replica localmente as verificações D1–D4 do SICONFI da Secretaria do Tesouro Nacional, permitindo identificar e corrigir inconsistências **antes** do envio oficial — protegendo a nota CAPAG e o Ranking ICF.

**Acesso:** https://andersonspita.github.io/validador-siconfi/  
**Versão:** 3.5.0 · **Desenvolvido por:** Lopes Consultoria (CRC-BA 36.449/O-0)

---

## O que faz

- **Valida 99 regras D1–D4** extraídas do catálogo oficial da STN
- **Aceita múltiplos arquivos juntos:** MSC + RREO + RGF + DCA — cada arquivo adicional habilita novos cruzamentos
- **Relatórios de execução** com drill-down por Função/Subfunção/Fonte/Natureza/Órgão
- **Estimativa CAPAG** (Indicadores de Endividamento, Poupança Corrente e Liquidez)
- **Limites LRF** — Pessoal (60%/54%/6%), ARO (7%) e Operações de Crédito (16%)
- **Lançamentos PCASP corretivos** para cada inconsistência detectada, com valores calculados automaticamente
- **Relatório PDF** com Plano de Correção Contábil e referências normativas completas
- **Assistente IA** (OpenAI GPT-4o-mini) contextualizado com os resultados da validação
- **Processamento 100% local** — nenhum dado financeiro sai do navegador

---

## Cobertura por arquivo

| Arquivo | Formato | Habilita |
|---|---|---|
| MSC (obrigatório) | `.csv`, `.zip` | D1 + D2 + Relatórios + CAPAG |
| RREO | `.xls`, `.xlsx`, `.xml`, `.zip` | D3 + D4 (cruzamento com MSC) |
| RGF | `.xls`, `.xlsx`, `.xml`, `.zip` | D3 fiscal (RCL e DCL cruzados) |
| DCA | `.xls`, `.xlsx`, `.xml`, `.zip` | D2 avançado (MSC × DCA) |

> Para cobertura máxima, envie os quatro arquivos de uma vez.

---

## Stack

React 19 · TypeScript · Vite · PapaParse · SheetJS · JSZip · jsPDF · Firebase Auth · OpenAI API

---

## Desenvolvimento local

```bash
git clone https://github.com/Andersonspita/validador-siconfi
cd validador-siconfi
npm install

# Criar .env com credenciais Firebase (opcional — app abre sem login se ausente)
cp .env.example .env
# editar .env com VITE_FIREBASE_* 

npm run dev          # http://localhost:5173
npm test             # 33 testes Vitest
npx tsc --noEmit     # verificar tipos
npm run build        # build produção → /dist
npm run deploy       # publicar no GitHub Pages (requer .env)
```

---

## Deploy via GitHub Actions (recomendado)

Configurar em **Settings → Secrets and variables → Actions**:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

A chave OpenAI **não** é configurada aqui — o usuário a insere em runtime no próprio chat (nunca entra no bundle).

---

## Segurança

- **Sessão por aba:** `browserSessionPersistence` — fechar a aba encerra a sessão automaticamente
- **Inatividade:** logout automático após 30 minutos sem interação
- **Chave OpenAI:** inserida em runtime pelo usuário, armazenada apenas em `sessionStorage`
- **Dados fiscais:** processados 100% no navegador, nunca enviados a servidores próprios

---

## Estrutura principal

```
src/
├── core/
│   ├── validators/        ← 99 regras D1–D4 + utils
│   ├── capagEngine.ts     ← Estimativa CAPAG (3 indicadores)
│   ├── correctiveEntries.ts ← Lançamentos PCASP por regra
│   ├── reportEngine.ts    ← Motor de relatórios de execução
│   ├── pdfGenerator.ts    ← Relatório PDF completo
│   ├── aiService.ts       ← Integração OpenAI
│   └── parsers.ts         ← CSV/XLS/XML/ZIP → ParsedData
├── components/
│   ├── Dropzone.tsx       ← Upload com painel de cobertura
│   ├── ReportDashboard.tsx ← Painel principal (3 abas)
│   ├── ReportView.tsx     ← Relatórios com drill-down
│   ├── CAPAGPanel.tsx     ← CAPAG estimado + CAUC links
│   └── AIChat.tsx         ← Assistente IA flutuante
└── services/
    ├── siconfiApi.ts      ← API STN (extrato de entregas)
    └── caucService.ts     ← Links oficiais CAUC
```

---

## Documentação

| Documento | Conteúdo |
|---|---|
| `docs/manual_do_usuario.md` | Guia completo para o contador/gestor |
| `docs/documentacao_tecnica.md` | Arquitetura, tipos, fluxo de dados |
| `docs/STATUS_PROJETO.md` | Cobertura, pendências, histórico |
| `docs/diario_de_implementacao.md` | Decisões técnicas por versão |
| `CHANGELOG.md` | Histórico de releases |

---

## Licença

Proprietário — Lopes Consultoria. Todos os direitos reservados.
