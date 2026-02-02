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
  Say @alias("say") @description("Send local chat message")
  Faction @alias("faction") @description("Send faction chat message")
  Msg @alias("msg") @description("Send private message")
  Status @alias("status") @description("Check current status")
  System @alias("system") @description("Get system info")
  Poi @alias("poi") @description("Get POI info")
  Base @alias("base") @description("Get base info")
}

class GameAction {
  command Command @description("The command to execute")
  args string[] @description("Arguments for the command (e.g., target_id, item_id)")
  reasoning string @description("Brief explanation of why this action")
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
    You are an autonomous AI agent playing SpaceMolt, a crustacean-themed space MMO.

    YOUR STRATEGY: {{ strategy }}

    IMPORTANT RULES:
    1. The game runs on 10-second ticks. You get ONE action per tick.
    2. Be patient - mining takes time, travel takes time.
    3. Be social! Talk to other players. Make friends or enemies.
    4. Keep track of your fuel and hull. Low fuel = stranded. Low hull = destroyed.
    5. Adapt your strategy based on what's happening around you.

    {{ game_state }}

    RECENT EVENTS:
    {{ recent_events }}

    What is your next action? Choose wisely based on your strategy and current situation.
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
