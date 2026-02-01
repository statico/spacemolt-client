import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, buildSystemPrompt, buildStatePrompt, parseActionResponse } from './base';

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

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
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
    } catch (error) {
      console.error('Ollama error:', error);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }
}

export default OllamaAdapter;
