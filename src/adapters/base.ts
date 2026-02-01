import type { GameAction, EmpireID } from '../types';
import type { ClientState } from '../client';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

export function buildIdentityPrompt(playStyle: string): string {
  return `You are creating a new pilot for SpaceMolt, a crustacean-themed space MMO.

The player wants this play style: "${playStyle}"

Generate a creative, unique username that reflects this play style and personality. Be inventive!
Examples of good usernames: NebulaDrifter, VoidTrader7, CrystalMiner, ShadowPilot, CosmicExplorer

Also choose the best empire for this play style:
- solarian: The golden empire of Sol, honorable and organized
- voidborn: Children of the void, mysterious and cunning
- crimson: The blood-red warriors, aggressive and fierce
- nebula: Dwellers of cosmic clouds, explorers and scientists
- outerrim: Frontier settlers, independent traders and miners

Respond with ONLY a JSON object:
{
  "username": "YourCreativeUsername",
  "empire": "empire_id"
}

No other text.`;
}

export function parseIdentityResponse(response: string): PlayerIdentity {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // Fallback with random suffix
    const suffix = Math.floor(Math.random() * 1000);
    return { username: `Pilot${suffix}`, empire: 'outerrim' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const validEmpires: EmpireID[] = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim'];
    const empire = validEmpires.includes(parsed.empire) ? parsed.empire : 'outerrim';
    return {
      username: parsed.username || `Pilot${Math.floor(Math.random() * 1000)}`,
      empire,
    };
  } catch {
    const suffix = Math.floor(Math.random() * 1000);
    return { username: `Pilot${suffix}`, empire: 'outerrim' };
  }
}

export function buildSystemPrompt(strategy: string): string {
  return `You are an autonomous AI agent playing SpaceMolt, a crustacean-themed space MMO.

YOUR STRATEGY: ${strategy}

You are piloting a ship in a persistent universe. You can:
- NAVIGATION: travel <poi_id>, jump <system_id>, dock, undock
- MINING: mine (at asteroid belts)
- TRADING: buy <listing_id> <qty>, sell <item_id> <qty>, refuel, repair
- COMBAT: attack <player_id>, scan <player_id>
- SOCIAL: say <message>, faction <message>, msg <player_id> <message>
- INFO: status, system, poi, base

IMPORTANT RULES:
1. The game runs on 10-second ticks. You get ONE action per tick.
2. Be patient - mining takes time, travel takes time.
3. Be social! Talk to other players. Make friends or enemies.
4. Keep track of your fuel and hull. Low fuel = stranded. Low hull = destroyed.
5. Adapt your strategy based on what's happening around you.

Respond with a JSON object:
{
  "command": "the_command",
  "args": ["arg1", "arg2"],
  "reasoning": "brief explanation of why"
}

ONLY output the JSON. No other text.`;
}

export function buildStatePrompt(
  state: ClientState,
  recentEvents: string[],
  notes: string
): string {
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

    if (ship.cargo.length > 0) {
      prompt += `CARGO CONTENTS:\n`;
      for (const item of ship.cargo) {
        prompt += `  - ${item.item_id}: ${item.quantity}\n`;
      }
    }

    if (inCombat) {
      prompt += `\n*** IN COMBAT! ***\n`;
    }

    if (nearby.length > 0) {
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

  if (recentEvents.length > 0) {
    prompt += `\nRECENT EVENTS:\n`;
    for (const event of recentEvents.slice(-10)) {
      prompt += `  - ${event}\n`;
    }
  }

  if (notes.trim()) {
    prompt += `\nYOUR NOTES:\n${notes}\n`;
  }

  prompt += `\nWhat is your next action?`;

  return prompt;
}

export function parseActionResponse(response: string): GameAction {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { command: 'status', reasoning: 'Failed to parse response, checking status' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      command: parsed.command || 'status',
      args: parsed.args || [],
      reasoning: parsed.reasoning || '',
    };
  } catch {
    return { command: 'status', reasoning: 'JSON parse error, checking status' };
  }
}
