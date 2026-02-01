import OpenAI from 'openai';
import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, buildSystemPrompt, buildStatePrompt, parseActionResponse } from './base';

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
      return parseActionResponse(content);
    } catch (error) {
      console.error('OpenAI error:', error);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }
}

export default OpenAIAdapter;
