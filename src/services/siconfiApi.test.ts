import { describe, it, expect } from 'vitest';
import {
  homologacaoDoPoder, homologacoesForaPrazo, contarRetificacoes, prazoLegal,
  ExtratoEntrega,
} from './siconfiApi';

const e = (p: Partial<ExtratoEntrega>): ExtratoEntrega => ({
  exercicio: 2026, cod_ibge: '2908804', populacao: 15000,
  instituicao: 'Prefeitura Municipal', entregavel: 'Relatório de Gestão Fiscal',
  periodo: 1, periodicidade: 'Q', status_relatorio: 'HO',
  data_status: '2026-05-15T10:00:00Z', forma_envio: 'online', tipo_relatorio: null,
  ...p,
});

describe('homologacaoDoPoder', () => {
  it('conta homologados e pendentes por poder', () => {
    const entregas = [
      e({ instituicao: 'Prefeitura Municipal', periodo: 1, status_relatorio: 'HO' }),
      e({ instituicao: 'Prefeitura Municipal', periodo: 2, status_relatorio: null }),
      e({ instituicao: 'Câmara de Vereadores', periodo: 1, status_relatorio: 'HO' }),
    ];
    const exec = homologacaoDoPoder(entregas, 'RGF', 'Executivo');
    expect(exec.total).toBe(2);
    expect(exec.pendentes).toEqual([2]);
    const leg = homologacaoDoPoder(entregas, 'RGF', 'Legislativo');
    expect(leg.total).toBe(1);
    expect(leg.pendentes).toEqual([]);
  });
});

describe('prazoLegal', () => {
  it('RREO: 30 dias após o bimestre', () => {
    // 1º bimestre termina em fev; prazo ~ 30/mar
    const p = prazoLegal('RREO', 1, 2026)!;
    expect(p.getMonth()).toBe(2); // março (0-based)
  });
  it('RGF: 30 dias após o quadrimestre', () => {
    const p = prazoLegal('RGF', 1, 2026)!;
    expect(p.getMonth()).toBe(4); // maio (0-based) = 30 dias após abr
  });
});

describe('homologacoesForaPrazo', () => {
  it('detecta homologação após o prazo', () => {
    const entregas = [
      // 1º quadrimestre: prazo ~30/mai; homologado em 01/jun => fora
      e({ periodo: 1, status_relatorio: 'HO', data_status: '2026-06-01T12:00:00Z' }),
    ];
    const fora = homologacoesForaPrazo(entregas, 'RGF', 2026, 'Executivo');
    expect(fora.length).toBe(1);
    expect(fora[0].periodo).toBe(1);
  });

  it('não acusa quando dentro do prazo', () => {
    const entregas = [
      e({ periodo: 1, status_relatorio: 'HO', data_status: '2026-05-10T12:00:00Z' }),
    ];
    const fora = homologacoesForaPrazo(entregas, 'RGF', 2026, 'Executivo');
    expect(fora.length).toBe(0);
  });
});

describe('contarRetificacoes', () => {
  it('conta por sinalização explícita em tipo_relatorio', () => {
    const entregas = [
      e({ periodo: 1, tipo_relatorio: 'Retificadora' }),
      e({ periodo: 2, tipo_relatorio: null }),
    ];
    expect(contarRetificacoes(entregas, 'RGF')).toBe(1);
  });

  it('conta por múltiplos registros homologados do mesmo período', () => {
    const entregas = [
      e({ periodo: 1, status_relatorio: 'HO' }),
      e({ periodo: 1, status_relatorio: 'HO' }),
      e({ periodo: 1, status_relatorio: 'HO' }),
    ];
    expect(contarRetificacoes(entregas, 'RGF')).toBe(2); // 3 registros = 2 retificações
  });
});
