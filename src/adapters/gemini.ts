import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GameAction } from '../types';
import type { ClientState } from '../client';
import { type LLMAdapter, type PlayerIdentity, buildSystemPrompt, buildStatePrompt, parseActionResponse, buildIdentityPrompt, parseIdentityResponse } from './base';

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
}

export class GeminiAdapter implements LLMAdapter {
  name = 'Gemini';
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(config: GeminiConfig = {}) {
    const apiKey = config.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = config.model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
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
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(userPrompt);
      const content = result.response.text();

      return parseActionResponse(content);
    } catch (error) {
      console.error('Gemini error:', error);
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    const prompt = buildIdentityPrompt(playStyle);

    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      return parseIdentityResponse(result.response.text());
    } catch (error) {
      console.error('Gemini identity error:', error);
      return parseIdentityResponse('');
    }
  }
}

export default GeminiAdapter;
