import OpenAI from 'openai';
import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, type PlayerIdentity, buildSystemPrompt, buildStatePrompt, parseActionResponse, buildIdentityPrompt, parseIdentityResponse } from './base';
import { logError } from '../logger';

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAIAdapter implements LLMAdapter {
  name = 'OpenAI';
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl || process.env.OPENAI_BASE_URL,
    });
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o';
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content || '';
      if (!content) {
        void logError('openai', `Empty response from model ${this.model}`);
      }
      return parseActionResponse(content);
    } catch (err) {
      void logError('openai', err);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    const prompt = buildIdentityPrompt(playStyle);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 256,
        temperature: 0.9,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.choices[0]?.message?.content || '';
      return parseIdentityResponse(content);
    } catch (err) {
      void logError('openai', err);
      return parseIdentityResponse('');
    }
  }
}

export default OpenAIAdapter;
