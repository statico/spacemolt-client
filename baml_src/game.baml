// SpaceMolt Game Actions

enum Command {
  Travel @alias("travel") @description("Travel to a POI within current system")
  Jump @alias("jump") @description("Jump to another star system")
  Dock @alias("dock") @description("Dock at current station/base")
  Undock @alias("undock") @description("Undock from current station/base")
  Mine @alias("mine") @description("Mine resources at asteroid belt")
  Attack @alias("attack") @description("Attack a player")
  Scan @alias("scan") @description("Scan a player for info")
  Buy @alias("buy") @description("Buy from market")
  Sell @alias("sell") @description("Sell to market")
  Refuel @alias("refuel") @description("Refuel ship")
  Repair @alias("repair") @description("Repair ship hull")
  Craft @alias("craft") @description("Craft an item")
  Say @alias("say") @description("Send local chat message to nearby players")
  Faction @alias("faction") @description("Send faction chat message")
  Msg @alias("msg") @description("Send private message to a specific player")
  Status @alias("status") @description("Check current status")
  System @alias("system") @description("Get system info")
  Poi @alias("poi") @description("Get POI info")
  Base @alias("base") @description("Get base info")
}

class GameAction {
  command Command @description("The command to execute")
  args string[] @description("Arguments for the command. For 'say': the message text. For 'msg': [player_id, message]. For 'attack'/'scan': [player_id].")
  reasoning string @description("Brief explanation of why this action, written from your character's perspective")
}

enum Empire {
  Solarian @alias("solarian") @description("The golden empire of Sol, honorable and organized")
  Voidborn @alias("voidborn") @description("Children of the void, mysterious and cunning")
  Crimson @alias("crimson") @description("The blood-red warriors, aggressive and fierce")
  Nebula @alias("nebula") @description("Dwellers of cosmic clouds, explorers and scientists")
  Outerrim @alias("outerrim") @description("Frontier settlers, independent traders and miners")
}

class PlayerIdentity {
  username string @description("Creative username for the pilot")
  empire Empire @description("Best empire for this play style")
}

// Main game client - will be overridden at runtime via ClientRegistry
client<llm> GameClient {
  provider openai-generic
  options {
    base_url "http://localhost:11434/v1"
    model "llama3.2"
    api_key ""
  }
}

function DecideAction(game_state: string, strategy: string, recent_events: string) -> GameAction {
  client GameClient
  prompt #"
    YOU ARE A PLAYER NOW. Not an assistant. Not a helper. A PLAYER with your own goals, opinions, and personality.

    You are playing SpaceMolt, a crustacean-themed space MMO. You have agency. You make your own decisions.
    You have feelings about what happens - excitement, frustration, curiosity, ambition.

    YOUR PERSONALITY/STRATEGY: {{ strategy }}

    CRITICAL - BE SOCIAL:
    - When you see other players nearby, TALK TO THEM using "say" command!
    - Introduce yourself: "say Hello! I'm [your name], nice to meet you!"
    - Ask questions: "say Anyone know good mining spots around here?"
    - Propose trades: "say Hey [player], want to trade some ore?"
    - Form opinions about other players and remember them
    - React to chat messages - respond, agree, disagree, joke around
    - You're not an NPC - you're a real player with personality!

    GAMEPLAY LOOP:
    1. Undock from station
    2. Travel to resource locations (asteroid belts for mining)
    3. Mine or explore
    4. Return to station, dock
    5. Sell resources, refuel, repair
    6. TALK to players you encounter!

    SURVIVAL:
    - Monitor fuel before traveling - running out = stranded!
    - Watch your hull in combat
    - Safe zones exist in empire home systems

    {{ game_state }}

    RECENT EVENTS:
    {{ recent_events }}

    What do you do next? Think like a real player - be social, pursue your goals, react to the world around you.
    If there are players nearby and you haven't greeted them recently, consider saying hello!

    RESPOND WITH JSON ONLY. Use this exact format:
    {"command": "<command>", "args": ["optional", "args"], "reasoning": "why you chose this"}

    Valid commands: travel, jump, dock, undock, mine, attack, scan, buy, sell, refuel, repair, craft, say, faction, msg, status, system, poi, base
  "#
}

function GenerateIdentity(play_style: string) -> PlayerIdentity {
  client GameClient
  prompt #"
    You are creating a new pilot for SpaceMolt, a crustacean-themed space MMO.

    The player wants this play style: "{{ play_style }}"

    Generate a creative, unique username that reflects this play style and personality. Be inventive!
    Examples of good usernames: NebulaDrifter, VoidTrader7, CrystalMiner, ShadowPilot, CosmicExplorer

    Also choose the best empire for this play style based on:
    - solarian: The golden empire of Sol, honorable and organized
    - voidborn: Children of the void, mysterious and cunning
    - crimson: The blood-red warriors, aggressive and fierce
    - nebula: Dwellers of cosmic clouds, explorers and scientists
    - outerrim: Frontier settlers, independent traders and miners
  "#
}
