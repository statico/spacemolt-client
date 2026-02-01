export { type LLMAdapter, type LLMMessage, type PlayerIdentity } from './base';
export { OllamaAdapter, type OllamaConfig } from './ollama';
export { ClaudeAdapter, type ClaudeConfig } from './claude';
export { OpenAIAdapter, type OpenAIConfig } from './openai';
export { GeminiAdapter, type GeminiConfig } from './gemini';
export { GroqAdapter, type GroqConfig } from './groq';

import { OllamaAdapter } from './ollama';
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';
import { GeminiAdapter } from './gemini';
import { GroqAdapter } from './groq';
import type { LLMAdapter } from './base';

export type AdapterType = 'ollama' | 'claude' | 'openai' | 'gemini' | 'groq';

export function createAdapter(type: AdapterType): LLMAdapter {
  switch (type) {
    case 'ollama':
      return new OllamaAdapter();
    case 'claude':
      return new ClaudeAdapter();
    case 'openai':
      return new OpenAIAdapter();
    case 'gemini':
      return new GeminiAdapter();
    case 'groq':
      return new GroqAdapter();
    default:
      return new OllamaAdapter();
  }
}
