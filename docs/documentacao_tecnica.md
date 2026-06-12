# Documentação Técnica: Validador Siconfi

## Arquitetura
O sistema é uma Single Page Application (SPA) desenvolvida em **React 18**, utilizando **Vite** como bundler e **TypeScript** para tipagem forte.
A decisão por uma arquitetura Client-Side (100% no navegador) baseia-se em duas premissas exigidas no escopo:
1. **Segurança e Privacidade**: Dados contábeis (MSC, RREO, RGF) não devem trafegar em redes públicas sem necessidade. Ao processar tudo no navegador, garantimos sigilo absoluto.
2. **Leveza e Facilidade de Acesso**: Hospedável em qualquer servidor de arquivos estáticos (GitHub Pages, S3, Vercel) sem custo computacional de backend.

## Dependências Principais
- `papaparse`: Parsing de CSV (Matriz de Saldos Contábeis).
- `jszip`: Extração de arquivos ZIP enviados pelo Siconfi.
- `fast-xml-parser`: Parsing do XML (RREO, RGF, DCA).
- `lucide-react`: Biblioteca de ícones.

## Motor de Validação (`validatorEngine.ts`)
O motor recebe os dados parseados e executa funções de validação em cascata (D1, D2, D3, D4).
Cada regra retorna um objeto do tipo `ValidationResult`:
```typescript
interface ValidationResult {
  ruleId: string;
  dimension: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  impactsCapag: boolean;
  affectedAccounts?: string[];
  message: string;
}
```
Para incluir novas regras do Tesouro Nacional, basta adicionar lógicas puras em `validateD1_MSC` ou correlatas, checando as contas e valores. O sistema automaticamente renderizará o card correspondente.

## Build e Deploy
Para compilar a aplicação para produção:
```bash
npm run build
```
Os arquivos otimizados estarão na pasta `dist/`. Pode-se servir esta pasta em qualquer Web Server (NGINX, Apache).
