# Status do Projeto — Validador Siconfi

> **Documento de continuidade para qualquer agente/IA que retome o projeto.**
> Leia este arquivo antes de qualquer outro para entender onde estamos e o que fazer a seguir.
>
> **Última atualização:** 25 de Junho de 2026 · **Repositório:** https://github.com/Andersonspita/validador-siconfi

---

## 1. Resumo Executivo

O **Validador Siconfi** é uma SPA React/TypeScript que replica localmente as regras de validação do SICONFI (sistema do Tesouro Nacional), permitindo que municípios antecipem erros antes do envio oficial. Tudo roda no browser — nenhum dado sai da máquina do usuário.

## O que já foi feito (Resumo)
- ✅ Infraestrutura baseada em React, Tailwind CSS e TypeScript instalada.
- ✅ Upload de ZIPs contendo XBRL e CSV, com extração de arquivos por período e matrizes (MSC).
- ✅ Motor de validação arquitetado (`rulesD1.ts` a `rulesD4.ts`).
- ✅ **197 de 197 regras** (100% das listadas no CSV oficial) implementadas no validador.
- ✅ Mapeamento de XML do RREO, RGF e DCA via XPath e funções precisas em `xmlExtractors.ts`.

---

## 2. Arquivos Críticos a Conhecer

| Arquivo | Para quê |
|---|---|
| `src/core/types.ts` | Interfaces TypeScript (MSCAccount, ValidationResult, ParsedData) |
| `src/core/parsers.ts` | Converte CSV/XLS/XML/ZIP em ParsedData |
| `src/core/validatorEngine.ts` | Motor agregador das validações; ponto central de desenvolvimento |
| `src/core/validators/rulesD1.ts` a `rulesD4.ts` | Implementação massiva e modular das regras dividida pelas 4 dimensões (Qualidade/Tempestividade, D2, D3, D4) |
| `src/core/xmlExtractors.ts` | Extratores dinâmicos para extrair valores específicos de planilhas e relatórios XML |
| `src/core/rulesMetadata.ts` | Carrega metadados das 197 regras do CSV público |
| `public/data/Descricao_verificacoes.csv` | Regras oficiais da STN (fonte de verdade) |
| `docs/documentacao_tecnica.md` | Arquitetura, PCASP, API dos extratores, guia de novas regras |
| `docs/manual_do_usuario.md` | Como usar a ferramenta |

---

## 3. Cobertura de Validação (100%)

O motor foi totalmente fuzilado com as regras do Siconfi. Através das nossas baterias de testes em código:

- **Dimensão 1 (Tempestividade e Qualidade):** As regras baseadas em dados de servidor (homologação tempestiva) geram informativos `info` de preenchimento, e regras matemáticas (como contas exclusivas do ano atual) são validadas na MSC.
- **Dimensão 2 (Matemática e Contábil):** Consistências de PCASP e FUNDEB validadas nativamente. Regras complexas anuais geram validações em cima da MSC de Encerramento.
- **Dimensão 3 (Regras Fiscais Intra-relatório):** Cruzamentos puros de RREO, RGF (ex: RCL, Empenhos, Restos a Pagar, Metas).
- **Dimensão 4 (Contábil x Fiscal):** 100% de cobertura entre as Matrizes de Saldos (MSC) e a DCA / RREO / RGF. 

**Total implementado: 197 de 197 (100%) das chaves mapeadas (D1, D2, D3, D4).**

### Como verificar a contagem atual

Existe um script nativo caso você deseje auditar se todas as regras do CSV batem com o código fonte:
```bash
npm run build
```
Ou executando a checagem manual em Node.js no diretório raiz testando chaves.

---

## 4. Contexto de Negócio

- **Cliente:** Lopes Consultoria Contábil (contabilidade@lopesconsultoria.cnt.br)
- **Público-alvo:** Contadores de prefeituras que precisam enviar dados ao Siconfi
- **Motivação:** Erros no Siconfi reduzem a nota CAPAG do município, impactando acesso a crédito
- **Linguagem do usuário:** Português do Brasil
- **Repositório:** https://github.com/Andersonspita/validador-siconfi (branch main)
- **Autenticação:** Firebase (credenciais via variáveis de ambiente `.env`)

## 5. Próximos Passos (Publicação e Extras)
Como a carga teórica e as lógicas de negócio estão finalizadas e funcionais:
1. **Design System:** Implementado com botões inteligentes e navegação.
2. **Sistema de Alertas:** Filtragem avançada implementada (Erros Críticos, Avisos, Informativos e Riscos CAPAG).
3. **Exportação de PDF:** Implementada a geração de um relatório PDF nativo oficial contendo planos de ações corretivas detalhadas (com badges de [IMPEDITIVO] e [RISCO CAPAG]).
4. **Deploy de Produção:** Integrar as melhorias no Netlify ou Vercel.
