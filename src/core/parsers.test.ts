import { describe, it, expect } from 'vitest';
import { parseMSCWithMeta } from './parsers';

describe('parseMSCWithMeta', () => {
  const dataRow = '111111900;10131;PO;1500;FR;;;;;;;;;51729049.40;beginning_balance;D';

  it('extrai código IBGE de 7 dígitos e período', async () => {
    const csv = `2931350EX;2026-01
CONTA;IC1;TIPO1;IC2;TIPO2;IC3;TIPO3;IC4;TIPO4;IC5;TIPO5;IC6;TIPO6;VALOR;TIPO_VALOR;NATUREZA_VALOR
${dataRow}`;

    const { accounts, period, enteId } = parseMSCWithMeta(csv);
    expect(enteId).toBe('2931350');
    expect(period).toBe('2026-01');
    const rows = await accounts;
    expect(rows[0].Valor).toBe(51729049.4);
    expect(rows[0].Tipo_valor).toBe('beginning_balance');
    expect(rows[0].FR).toBe('1500');
  });

  it('aceita formato BR de valor com vírgula decimal', async () => {
    const csv = `2908101;2026-02
CONTA;IC1;TIPO1;IC2;TIPO2;IC3;TIPO3;IC4;TIPO4;IC5;TIPO5;IC6;TIPO6;VALOR;TIPO_VALOR;NATUREZA_VALOR
111111900;10131;PO;1500;FR;;;;;;;;;1.234,56;ending_balance;D`;

    const { accounts } = parseMSCWithMeta(csv);
    const rows = await accounts;
    expect(rows[0].Valor).toBe(1234.56);
  });

  it('aceita notação científica', async () => {
    const csv = `2908101;2026-03
CONTA;IC1;TIPO1;IC2;TIPO2;IC3;TIPO3;IC4;TIPO4;IC5;TIPO5;IC6;TIPO6;VALOR;TIPO_VALOR;NATUREZA_VALOR
111111900;10131;PO;1500;FR;;;;;;;;;1.23E+08;ending_balance;D`;

    const { accounts } = parseMSCWithMeta(csv);
    const rows = await accounts;
    expect(rows[0].Valor).toBe(123000000);
  });
});
