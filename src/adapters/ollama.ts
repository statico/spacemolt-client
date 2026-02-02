import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, type PlayerIdentity, buildSystemPrompt, buildStatePrompt, parseActionResponse, buildIdentityPrompt, parseIdentityResponse } from './base';
import { logError } from '../logger';

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaAdapter implements LLMAdapter {
  name = 'Ollama';
  private baseUrl: string;
  private model: string;

  constructor(config: OllamaConfig = {}) {
    const url = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    // Validate URL format
    try {
      new URL(url);
      this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
    } catch {
      void logError('ollama', `Invalid base URL: ${url}, using default`);
      this.baseUrl = 'http://localhost:11434';
    }
    this.model = config.model || process.env.OLLAMA_MODEL || 'llama3.2';
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
      if (!content) {
        void logError('ollama', `Empty response from model ${this.model}`);
      }
      return parseActionResponse(content);
    } catch (err) {
      void logError('ollama', `Model: ${this.model}, Error: ${err}`);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    const prompt = buildIdentityPrompt(playStyle);

    const controller = new AbortController();
    const timeoutMs = 60_000; // 60s timeout for identity generation
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        signal: controller.signal,
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
    } catch (err) {
      void logError('ollama', err);
      return parseIdentityResponse('');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default OllamaAdapter;
