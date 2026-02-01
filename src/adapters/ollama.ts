import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, type PlayerIdentity, buildSystemPrompt, buildStatePrompt, parseActionResponse, buildIdentityPrompt, parseIdentityResponse } from './base';

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaAdapter implements LLMAdapter {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = config.model || process.env.OLLAMA_MODEL || 'gpt-oss:20b';
  }

  async generateAction(
    state: ClientState,
    strategy: string,
    recentEvents: string[],
    notes: string
  ): Promise<GameAction> {
    const systemPrompt = buildSystemPrompt(strategy);
    const userPrompt = buildStatePrompt(state, recentEvents, notes);

    const controller = new AbortController();
    const timeoutMs = 90_000; // 90s so we don't hang on "Thinking..."
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: {
            temperature: 0.7,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      const content = data.message?.content || '';

      return parseActionResponse(content);
    } catch {
      return { command: 'status', reasoning: 'LLM error, checking status' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    const prompt = buildIdentityPrompt(playStyle);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          options: { temperature: 0.9 },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }

      const data = await response.json() as { message?: { content?: string } };
      return parseIdentityResponse(data.message?.content || '');
    } catch {
      return parseIdentityResponse('');
    }
  }
}

export default OllamaAdapter;
