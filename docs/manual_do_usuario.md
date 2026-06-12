# Manual do Usuário - Validador Siconfi

Bem-vindo ao Validador Siconfi Local! Este sistema foi criado para ajudar você a validar seus arquivos antes de enviá-los ao Siconfi, evitando perda de pontos no Ranking da Qualidade da Informação e protegendo sua nota **CAPAG**.

## 1. Como Usar

1. **Acesso**: Abra o sistema no seu navegador. Ele funciona offline e não envia nenhum dado para a internet.
2. **Upload de Arquivos**: Na tela inicial, arraste e solte seus arquivos gerados pelo sistema de contabilidade:
   - `Matriz de Saldos Contábeis` (.csv)
   - `RREO` (.zip ou .xml)
   - `RGF` (.zip ou .xml)
   - `DCA` (.zip ou .xml)
3. **Análise**: O sistema lerá os arquivos imediatamente e exibirá um painel (Dashboard).

## 2. Entendendo os Resultados

O painel de resultados divide as inconsistências em três tipos:
- 🛑 **Erros Críticos**: Impedem o envio ou causam rejeição imediata (Ex: Valores negativos na MSC).
- ⚠️ **Avisos**: Podem ser aceitos, mas diminuem a nota do município no ranking de qualidade (Ex: Contas de ativo com saldo credor).
- 🛡️ **Riscos CAPAG**: Avisos ou erros que, se enviados, impactarão diretamente na avaliação da Capacidade de Pagamento do seu Ente. Verifique com urgência.

Você pode usar os botões na parte superior para filtrar os resultados (Ex: Mostrar apenas os que afetam o CAPAG).

## 3. Tema Dark / Light
Para sua comodidade visual, clique no ícone de "Lua" ou "Sol" no canto superior direito para alternar entre o modo claro e o modo escuro.

## Dúvidas Comuns
- **Meus dados estão seguros?** Sim! Nenhum dado sai do seu computador. O site apenas interpreta o arquivo na memória do seu navegador.
