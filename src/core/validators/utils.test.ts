import { describe, it, expect } from 'vitest';
import {
  validateEquilibrioGeral,
  getNetBalance,
  getPassivoCirculanteNet,
  mscAccountKey,
  findInvertedAccounts,
} from './utils';
import { MSCAccount } from '../types';

const acc = (partial: Partial<MSCAccount> & Pick<MSCAccount, 'CONTA' | 'Valor'>): MSCAccount => ({
  PO: '20131',
  Tipo_valor: 'ending_balance',
  Natureza_valor: 'D',
  ...partial,
});

describe('validateEquilibrioGeral', () => {
  it('não alerta quando SUM(D) = SUM(C)', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '111110000', Valor: 100, Natureza_valor: 'D', Tipo_valor: 'ending_balance' }),
      acc({ CONTA: '211110000', Valor: 100, Natureza_valor: 'C', Tipo_valor: 'ending_balance' }),
    ];
    expect(validateEquilibrioGeral(msc)).toHaveLength(0);
  });

  it('alerta quando há desbalanceamento no saldo final', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '111110000', Valor: 100, Natureza_valor: 'D' }),
      acc({ CONTA: '211110000', Valor: 90, Natureza_valor: 'C' }),
    ];
    const results = validateEquilibrioGeral(msc);
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('D2_MSC_EQUILIBRIO');
  });
});

describe('getNetBalance DDR', () => {
  it('calcula saldo líquido devedor apenas no prefixo 7211', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '721110000', Valor: 500, Natureza_valor: 'D' }),
      acc({ CONTA: '721110001', Valor: 100, Natureza_valor: 'C' }),
      acc({ CONTA: '722110000', Valor: 999, Natureza_valor: 'D' }),
    ];
    expect(getNetBalance(msc, ['7211'], 'ending_balance', 'D')).toBe(400);
  });
});

describe('getPassivoCirculanteNet', () => {
  it('usa FP=F para passivo financeiro, não PO', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '211110000', Valor: 100, Natureza_valor: 'C', FP: 'F' }),
      acc({ CONTA: '211110001', Valor: 50, Natureza_valor: 'C', PO: 'F' }),
    ];
    expect(getPassivoCirculanteNet(msc, a => a.FP === 'F')).toBe(100);
  });
});

describe('findInvertedAccounts', () => {
  it('exclui contas retificadoras do ativo', () => {
    const msc: MSCAccount[] = [
      acc({ CONTA: '123810100', Valor: 50, Natureza_valor: 'C' }),
    ];
    expect(findInvertedAccounts(msc, ['1231'], 'D', ['1238101'])).toHaveLength(0);
  });
});

describe('mscAccountKey', () => {
  it('inclui todos os ICs na chave', () => {
    const a = acc({ CONTA: '111', FR: '500', FS: '10', ND: '339030' });
    const b = acc({ CONTA: '111', FR: '600', FS: '10', ND: '339030' });
    expect(mscAccountKey(a)).not.toBe(mscAccountKey(b));
  });
});
