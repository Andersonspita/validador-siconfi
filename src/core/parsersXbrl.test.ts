import { describe, it, expect } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { parseMSCXBRL, isMSCXbrl } from './parsers';
import { validateMultiMonth } from './validators/rulesD1';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// MSC-XBRL mínima: 1 conta de Ativo com saldo final = beginning + change.
// A mesma chave aparece em DUAS linhas de period_change para exercitar a
// agregação por chave (o saldo é a soma das linhas, não a primeira).
const mscXbrl = (periodo: string, endValor: string) => `<?xml version="1.0" encoding="ISO-8859-1"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"
            xmlns:gl-bus="http://www.xbrl.org/int/gl/bus/2015-03-25"
            xmlns:gl-cor="http://www.xbrl.org/int/gl/cor/2015-03-25">
  <xbrli:context id="C1">
    <xbrli:entity>
      <xbrli:identifier scheme="http://siconfi.tesouro.gov.br">2916807EX</xbrli:identifier>
    </xbrli:entity>
  </xbrli:context>
  <gl-cor:accountingEntries>
    <gl-cor:entityInformation>
      <gl-bus:reportingCalendar>
        <gl-bus:reportingCalendarPeriod>
          <gl-bus:periodIdentifier contextRef="C1">${periodo}</gl-bus:periodIdentifier>
          <gl-bus:periodEnd contextRef="C1">${periodo}-30</gl-bus:periodEnd>
        </gl-bus:reportingCalendarPeriod>
      </gl-bus:reportingCalendar>
    </gl-cor:entityInformation>
    <gl-cor:entryHeader>
      <gl-cor:entryDetail>
        <gl-cor:account>
          <gl-cor:accountMainID contextRef="C1">111111900</gl-cor:accountMainID>
          <gl-cor:accountSub><gl-cor:accountSubID contextRef="C1">10131</gl-cor:accountSubID><gl-cor:accountSubType contextRef="C1">PO</gl-cor:accountSubType></gl-cor:accountSub>
          <gl-cor:accountSub><gl-cor:accountSubID contextRef="C1">1500</gl-cor:accountSubID><gl-cor:accountSubType contextRef="C1">FR</gl-cor:accountSubType></gl-cor:accountSub>
        </gl-cor:account>
        <gl-cor:amount contextRef="C1">${endValor}</gl-cor:amount>
        <gl-cor:debitCreditCode contextRef="C1">D</gl-cor:debitCreditCode>
        <gl-cor:xbrlInfo><gl-cor:xbrlInclude contextRef="C1">ending_balance</gl-cor:xbrlInclude></gl-cor:xbrlInfo>
      </gl-cor:entryDetail>
    </gl-cor:entryHeader>
  </gl-cor:accountingEntries>
</xbrli:xbrl>`;

describe('parseMSCXBRL (MSC em XBRL-GL)', () => {
  it('reconhece e extrai conta, período e ente de uma MSC XBRL', () => {
    const parsed = xmlParser.parse(mscXbrl('2026-05', '1000.00'));
    expect(isMSCXbrl(parsed)).toBe(true);
    const { accounts, period, enteId } = parseMSCXBRL(parsed);
    expect(period).toBe('2026-05');
    expect(enteId).toBe('2916807');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].CONTA).toBe('111111900');
    expect(accounts[0].PO).toBe('10131');
    expect(accounts[0].FR).toBe('1500');
    expect(accounts[0].Valor).toBe(1000);
    expect(accounts[0].Tipo_valor).toBe('ending_balance');
    expect(accounts[0].Natureza_valor).toBe('D');
  });

  it('não confunde outros XML (sem accountingEntries) com MSC', () => {
    const parsed = xmlParser.parse('<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"></xbrli:xbrl>');
    expect(isMSCXbrl(parsed)).toBe(false);
  });
});

describe('validateMultiMonth com MSC XBRL', () => {
  const toMsc = (xml: string) => parseMSCXBRL(xmlParser.parse(xml)).accounts;

  it('não acusa quando saldo final = saldo inicial do mês seguinte', () => {
    const may = toMsc(mscXbrl('2026-05', '1000.00'));
    // junho abre com beginning_balance = 1000 (mesma conta/atributos)
    const junXml = mscXbrl('2026-06', '1000.00').replace('ending_balance', 'beginning_balance');
    const jun = toMsc(junXml);
    const res = validateMultiMonth({ '2026-05': may, '2026-06': jun }, new Map());
    expect(res.filter(r => r.ruleId === 'D2_00077')).toHaveLength(0);
  });

  it('acusa D2_00077 em conta de controle (classe 6/7/8), não só 1/2', () => {
    // maio: conta 622... fecha em 100 C; junho abre em 150 C -> diferença 50
    const mk = (per: string, tipo: string, val: string) =>
      mscXbrl(per, val)
        .replace('111111900', '622130400')
        .replace('ending_balance', tipo);
    const may = toMsc(mk('2026-05', 'ending_balance', '100.00'));
    const jun = toMsc(mk('2026-06', 'beginning_balance', '150.00'));
    const res = validateMultiMonth({ '2026-05': may, '2026-06': jun }, new Map());
    const d2 = res.filter(r => r.ruleId === 'D2_00077');
    expect(d2).toHaveLength(1);
    expect(d2[0].affectedAccounts?.[0]).toBe('622130400');
  });
});
