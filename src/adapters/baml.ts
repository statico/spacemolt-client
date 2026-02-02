import { ClientRegistry, Collector } from '@boundaryml/baml';
import { b, Command, Empire } from '../../baml_client';
import type { GameAction as BamlGameAction, PlayerIdentity as BamlPlayerIdentity } from '../../baml_client';
import type { GameAction, EmpireID } from '../types';
import type { ClientState } from '../client';
import { logError, logDebug, isDebugMode } from '../logger';

// Suppress BAML's stdout logging by temporarily replacing console methods
function suppressConsole<T>(fn: () => Promise<T>): Promise<T> {
  if (isDebugMode()) return fn(); // Don't suppress in debug mode

  const originalLog = console.log;
  const originalInfo = console.info;
  // Suppress console.log and console.info during BAML calls
  console.log = () => {};
  console.info = () => {};

  return fn().finally(() => {
    console.log = originalLog;
    console.info = originalInfo;
  });
}

export type AdapterType = 'ollama' | 'claude' | 'openai' | 'gemini' | 'groq';

export interface PlayerIdentity {
  username: string;
  empire: EmpireID;
}

export interface LLMAdapter {
  name: string;
  generateAction(
    state: ClientState,
    strategy: string,
    recentEvents: string[],
    notes: string
  ): Promise<GameAction>;
  generateIdentity(playStyle: string): Promise<PlayerIdentity>;
}

// Map BAML Command enum to lowercase strings
const commandMap: Record<Command, string> = {
  [Command.Travel]: 'travel',
  [Command.Jump]: 'jump',
  [Command.Dock]: 'dock',
  [Command.Undock]: 'undock',
  [Command.Mine]: 'mine',
  [Command.Attack]: 'attack',
  [Command.Scan]: 'scan',
  [Command.Buy]: 'buy',
  [Command.Sell]: 'sell',
  [Command.Refuel]: 'refuel',
  [Command.Repair]: 'repair',
  [Command.Craft]: 'craft',
  [Command.Say]: 'say',
  [Command.Faction]: 'faction',
  [Command.Msg]: 'msg',
  [Command.Status]: 'status',
  [Command.System]: 'system',
  [Command.Poi]: 'poi',
  [Command.Base]: 'base',
};

// Map BAML Empire enum to EmpireID
const empireMap: Record<Empire, EmpireID> = {
  [Empire.Solarian]: 'solarian',
  [Empire.Voidborn]: 'voidborn',
  [Empire.Crimson]: 'crimson',
  [Empire.Nebula]: 'nebula',
  [Empire.Outerrim]: 'outerrim',
};

function buildStatePrompt(state: ClientState, recentEvents: string[], notes: string): string {
  const { player, ship, system, poi, nearby, inCombat, currentTick } = state;

  let prompt = `=== TICK ${currentTick} ===\n\n`;

  if (player && ship) {
    prompt += `PLAYER: ${player.username} [${player.empire}]
CREDITS: ${player.credits}
LOCATION: ${system?.name || player.current_system} - ${poi?.name || player.current_poi}
DOCKED: ${player.docked_at_base ? 'Yes' : 'No'}

SHIP: ${ship.name} (${ship.class_id})
HULL: ${ship.hull}/${ship.max_hull}
SHIELD: ${ship.shield}/${ship.max_shield}
FUEL: ${ship.fuel}/${ship.max_fuel}
CARGO: ${ship.cargo_used}/${ship.cargo_capacity}
`;

    if (ship.cargo && ship.cargo.length > 0) {
      prompt += `CARGO CONTENTS:\n`;
      for (const item of ship.cargo) {
        prompt += `  - ${item.item_id}: ${item.quantity}\n`;
      }
    }

    if (inCombat) {
      prompt += `\n*** IN COMBAT! ***\n`;
    }

    if (nearby && nearby.length > 0) {
      prompt += `\nNEARBY PLAYERS:\n`;
      for (const p of nearby) {
        if (p.anonymous) {
          prompt += `  - [Anonymous Ship]\n`;
        } else {
          const tag = p.clan_tag ? `[${p.clan_tag}] ` : '';
          const faction = p.faction_tag ? ` <${p.faction_tag}>` : '';
          const combat = p.in_combat ? ' [COMBAT]' : '';
          prompt += `  - ${tag}${p.username || 'Unknown'}${faction}${combat}\n`;
        }
      }
    }
  } else {
    prompt += `NOT LOGGED IN\n`;
  }

  if (notes.trim()) {
    prompt += `\nYOUR NOTES:\n${notes}\n`;
  }

  return prompt;
}

export class BamlAdapter implements LLMAdapter {
  name: string;
  private registry: ClientRegistry;
  private model: string;

  constructor(adapterType: AdapterType, model?: string) {
    this.registry = new ClientRegistry();

    // Configure the client based on adapter type
    switch (adapterType) {
      case 'ollama':
        this.name = 'Ollama';
        this.model = model || process.env.OLLAMA_MODEL || 'llama3.2';
        this.registry.addLlmClient('GameClient', 'openai-generic', {
          base_url: process.env.OLLAMA_URL || 'http://localhost:11434/v1',
          model: this.model,
          api_key: '',
        });
        break;

      case 'groq':
        this.name = 'Groq';
        this.model = model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        this.registry.addLlmClient('GameClient', 'openai-generic', {
          base_url: 'https://api.groq.com/openai/v1',
          model: this.model,
          api_key: process.env.GROQ_API_KEY || '',
        });
        break;

      case 'openai':
        this.name = 'OpenAI';
        this.model = model || process.env.OPENAI_MODEL || 'gpt-4o';
        this.registry.addLlmClient('GameClient', 'openai', {
          model: this.model,
          api_key: process.env.OPENAI_API_KEY || '',
          base_url: process.env.OPENAI_BASE_URL,
        });
        break;

      case 'claude':
        this.name = 'Claude';
        this.model = model || process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
        this.registry.addLlmClient('GameClient', 'anthropic', {
          model: this.model,
          api_key: process.env.ANTHROPIC_API_KEY || '',
        });
        break;

      case 'gemini':
        this.name = 'Gemini';
        this.model = model || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        this.registry.addLlmClient('GameClient', 'google-ai', {
          model: this.model,
          api_key: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
        });
        break;
    }

    this.registry.setPrimary('GameClient');
  }

  async generateAction(
    state: ClientState,
    strategy: string,
    recentEvents: string[],
    notes: string
  ): Promise<GameAction> {
    const gameState = buildStatePrompt(state, recentEvents, notes);
    const events = recentEvents.slice(-10).join('\n');

    // Use collector to capture full request/response for debugging
    const collector = isDebugMode() ? new Collector('debug') : undefined;

    void logDebug('baml', `=== DecideAction Request ===`);
    void logDebug('baml', `Model: ${this.model}`);
    void logDebug('baml', `Strategy: ${strategy}`);
    void logDebug('baml', `Game State:\n${gameState}`);
    void logDebug('baml', `Recent Events:\n${events}`);

    try {
      const result: BamlGameAction = await suppressConsole(() =>
        b.DecideAction(gameState, strategy, events, {
          clientRegistry: this.registry,
          collector,
        })
      );

      // Log collector data (includes raw LLM request/response)
      if (collector) {
        const logs = collector.logs;
        for (const log of logs) {
          void logDebug('baml-collector', `Function: ${log.functionName}`, {
            timing: log.timing,
            usage: log.usage,
            rawLlmResponse: log.rawLlmResponse,
          });
          // Log raw HTTP request/response from LLM calls
          for (const call of log.calls) {
            const httpReq = call.httpRequest;
            if (httpReq) {
              void logDebug('baml-http', `LLM Request to ${httpReq.url}`, {
                method: httpReq.method,
                headers: httpReq.headers,
                body: httpReq.body?.text(),
              });
            }
          }
        }
      }

      void logDebug('baml', `=== DecideAction Response ===`, result);

      return {
        command: commandMap[result.command] || 'status',
        args: result.args || [],
        reasoning: result.reasoning || '',
      };
    } catch (err) {
      // Log collector data even on error
      if (collector) {
        const logs = collector.logs;
        for (const log of logs) {
          void logDebug('baml-collector-error', `Function: ${log.functionName}`, {
            timing: log.timing,
            rawLlmResponse: log.rawLlmResponse,
          });
          // Log raw HTTP request/response from LLM calls
          for (const call of log.calls) {
            const httpReq = call.httpRequest;
            if (httpReq) {
              void logDebug('baml-http-error', `LLM Request to ${httpReq.url}`, {
                method: httpReq.method,
                body: httpReq.body?.text(),
              });
            }
          }
        }
      }

      void logError('baml', `Model: ${this.model}, Error: ${err}`);
      void logDebug('baml', `=== DecideAction Error ===`, String(err));
      return { command: 'status', reasoning: 'LLM error, checking status' };
    }
  }

  async generateIdentity(playStyle: string): Promise<PlayerIdentity> {
    try {
      const result: BamlPlayerIdentity = await suppressConsole(() =>
        b.GenerateIdentity(playStyle, {
          clientRegistry: this.registry,
        })
      );

      return {
        username: result.username || `Pilot${Math.floor(Math.random() * 1000)}`,
        empire: empireMap[result.empire] || 'outerrim',
      };
    } catch (err) {
      void logError('baml', `Identity generation error: ${err}`);
      return {
        username: `Pilot${Math.floor(Math.random() * 1000)}`,
        empire: 'outerrim',
      };
    }
  }
}

export function createAdapter(adapterType: AdapterType, model?: string): LLMAdapter {
  return new BamlAdapter(adapterType, model);
}

export default BamlAdapter;
