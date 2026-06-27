/**
 * aiService.ts
 * Assistente IA contextual — chave OpenAI inserida pelo usuário em runtime.
 * NUNCA embute a chave no bundle — armazenada apenas em sessionStorage.
 */

import { ValidationResult } from './types';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_KEY = 'siconfi_ai_key';
const MODEL       = 'gpt-4o-mini';

export function getStoredKey(): string {
  return sessionStorage.getItem(SESSION_KEY) ?? '';
}

export function saveKey(key: string): void {
  if (key) sessionStorage.setItem(SESSION_KEY, key.trim());
  else sessionStorage.removeItem(SESSION_KEY);
}

export function clearKey(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isAIConfigured(): boolean {
  return !!getStoredKey();
}

function buildSystemPrompt(
  results: ValidationResult[],
  meta: { enteId?: string; periodo?: string }
): string {
  const errors   = results.filter(r => r.severity === 'error');
  const warnings = results.filter(r => r.severity === 'warning');
  const capag    = results.filter(r => r.impactsCapag);

  const resumo = results.slice(0, 20).map(r =>
    `[${r.ruleId}][${r.severity}${r.impactsCapag ? '/CAPAG' : ''}] ${r.message.slice(0, 200)}`
  ).join('\n');

  return `Você é um assistente especialista em contabilidade pública brasileira, SICONFI, PCASP, LRF e CAPAG.
O usuário está analisando resultados de validação fiscal do município ${meta.enteId ?? '(não identificado)'}, período ${meta.periodo ?? '(não informado)'}.

RESUMO DAS INCONSISTÊNCIAS:
- ${errors.length} erro(s) crítico(s) impeditivo(s)
- ${warnings.length} aviso(s)
- ${capag.length} risco(s) CAPAG

DETALHAMENTO (até 20 regras):
${resumo}

Responda de forma objetiva e prática, sempre em português brasileiro. Cite normas (MCASP, MDF, LRF, NBC TSP) quando aplicável. Seja direto — o usuário é contador público.`;
}

export async function sendMessage(
  messages: AIMessage[],
  results: ValidationResult[],
  meta: { enteId?: string; periodo?: string }
): Promise<string> {
  const key = getStoredKey();
  if (!key) throw new Error('Chave OpenAI não configurada.');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt(results, meta) },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Chave inválida ou expirada. Verifique em platform.openai.com.');
    throw new Error(err?.error?.message ?? `Erro OpenAI ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '(sem resposta)';
}

export function buildSuggestions(results: ValidationResult[]): string[] {
  const suggestions: string[] = [];
  const ids = results.map(r => r.ruleId);

  if (ids.includes('D2_00083'))   suggestions.push('Como corrigir o desequilíbrio DDR (D2_00083)?');
  if (ids.includes('D2_00081'))   suggestions.push('Por que preciso provisionar férias e 13º todo mês?');
  if (results.some(r => r.impactsCapag)) suggestions.push('Como esses erros afetam minha nota CAPAG?');
  if (ids.some(i => i.startsWith('D1_0002') || i.startsWith('D1_0003')))
    suggestions.push('O que são Indicadores de Conta (IC) e como preencher?');
  if (ids.includes('D1_00018'))   suggestions.push('O que significa SI + MOV ≠ SF?');
  if (ids.includes('D1_00021'))   suggestions.push('Por que contas do ativo têm natureza Credora?');

  suggestions.push('Qual é a prioridade de correção dessas inconsistências?');
  suggestions.push('O que é o Ranking ICF e como impacta o município?');
  return suggestions.slice(0, 5);
}
