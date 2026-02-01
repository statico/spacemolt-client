import Anthropic from '@anthropic-ai/sdk';
import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, type PlayerIdentity, buildSystemPrompt, buildStatePrompt, parseActionResponse, buildIdentityPrompt, parseIdentityResponse } from './base';
import { logError } from '../logger';

export interface ClaudeConfig {
  apiKey?: string;
  model?: string;
}

export class ClaudeAdapter implements LLMAdapter {
  name = 'Claude';
  private client: Anthropic;
  private model: string;

  constructor(config: ClaudeConfig = {}) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = config.model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        return { command: 'status', reasoning: 'Unexpected or empty response' };
      }

      return parseActionResponse(content.text);
    } catch (err) {
      void logError('claude', err);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    const prompt = buildIdentityPrompt(playStyle);

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (!content || content.type !== 'text') {
        return parseIdentityResponse('');
      }

      return parseIdentityResponse(content.text);
    } catch (err) {
      void logError('claude', err);
      return parseIdentityResponse('');
    }
  }
}

export default ClaudeAdapter;
