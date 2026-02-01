// SpaceMolt Client Types

export type EmpireID = 'solarian' | 'voidborn' | 'crimson' | 'nebula' | 'outerrim';

export interface Player {
  id: string;
  username: string;
  empire: EmpireID;
  credits: number;
  current_system: string;
  current_poi: string;
  current_ship_id: string;
  home_base: string;
  docked_at_base: string;
  faction_id?: string;
  faction_rank?: string;
  status_message?: string;
  clan_tag?: string;
  primary_color?: string;
  secondary_color?: string;
  anonymous: boolean;
  skills: Record<string, PlayerSkill>;
  stats: PlayerStats;
}

export interface PlayerSkill {
  level: number;
  xp: number;
}

export interface PlayerStats {
  ships_destroyed: number;
  times_destroyed: number;
  ore_mined: number;
  credits_earned: number;
  credits_spent: number;
  trades_completed: number;
  systems_discovered: number;
  items_crafted: number;
  missions_completed: number;
}

export interface Ship {
  id: string;
  owner_id: string;
  class_id: string;
  name: string;
  hull: number;
  max_hull: number;
  shield: number;
  max_shield: number;
  shield_recharge: number;
  armor: number;
  speed: number;
  fuel: number;
  max_fuel: number;
  cargo_used: number;
  cargo_capacity: number;
  cpu_used: number;
  cpu_capacity: number;
  power_used: number;
  power_capacity: number;
  modules: string[];
  cargo: CargoItem[];
}

export interface CargoItem {
  item_id: string;
  quantity: number;
}

export interface System {
  id: string;
  name: string;
  description: string;
  empire?: EmpireID;
  police_level: number;
  connections: string[];
  pois: string[];
  discovered: boolean;
  position: GalacticPosition;
  discovered_by?: string;
}

export interface GalacticPosition {
  x: number;
  y: number;
}

export interface POI {
  id: string;
  system_id: string;
  type: POIType;
  name: string;
  description: string;
  position: Position;
  resources?: ResourceNode[];
  base_id?: string;
}

export type POIType = 'planet' | 'moon' | 'sun' | 'asteroid_belt' | 'asteroid' | 'nebula' | 'gas_cloud' | 'relic' | 'station' | 'jump_gate';

export interface Position {
  x: number;
  y: number;
}

export interface ResourceNode {
  resource_id: string;
  richness: number;
  remaining: number;
}

export interface Base {
  id: string;
  poi_id: string;
  name: string;
  description: string;
  owner_id?: string;
  faction_id?: string;
  empire?: EmpireID;
  services: BaseServices;
  market: MarketListing[];
  defense_level: number;
  has_drones: boolean;
  public_access: boolean;
}

export interface BaseServices {
  refuel: boolean;
  repair: boolean;
  shipyard: boolean;
  market: boolean;
  cloning: boolean;
  insurance: boolean;
  crafting: boolean;
  missions: boolean;
  storage: boolean;
}

export interface MarketListing {
  id: string;
  item_id: string;
  seller_id?: string;
  quantity: number;
  price_each: number;
  is_npc: boolean;
}

export interface NearbyPlayer {
  player_id?: string;
  username?: string;
  ship_class?: string;
  faction_id?: string;
  faction_tag?: string;
  status_message?: string;
  clan_tag?: string;
  primary_color?: string;
  secondary_color?: string;
  anonymous: boolean;
  in_combat: boolean;
}

// Message types
export type MessageType =
  // Server -> Client
  | 'welcome'
  | 'registered'
  | 'logged_in'
  | 'state_update'
  | 'tick'
  | 'ok'
  | 'error'
  | 'combat_update'
  | 'player_died'
  | 'mining_yield'
  | 'scan_result'
  | 'chat_message'
  | 'trade_offer_received'
  | 'version_info'
  // Client -> Server: Auth
  | 'register'
  | 'login'
  | 'logout'
  // Client -> Server: Navigation
  | 'travel'
  | 'jump'
  | 'dock'
  | 'undock'
  // Client -> Server: Combat
  | 'attack'
  | 'scan'
  // Client -> Server: Mining
  | 'mine'
  // Client -> Server: Trading (NPC)
  | 'buy'
  | 'sell'
  | 'list_item'
  | 'cancel_list'
  // Client -> Server: Trading (P2P)
  | 'trade_offer'
  | 'trade_accept'
  | 'trade_decline'
  | 'trade_cancel'
  | 'get_trades'
  // Client -> Server: Wrecks
  | 'get_wrecks'
  | 'loot_wreck'
  | 'salvage_wreck'
  // Client -> Server: Ship
  | 'buy_ship'
  | 'install_mod'
  | 'uninstall_mod'
  | 'refuel'
  | 'repair'
  // Client -> Server: Crafting
  | 'craft'
  // Client -> Server: Chat
  | 'chat'
  // Client -> Server: Faction
  | 'create_faction'
  | 'join_faction'
  | 'leave_faction'
  | 'faction_invite'
  | 'faction_kick'
  | 'faction_promote'
  // Client -> Server: Insurance
  | 'buy_insurance'
  | 'claim_insurance'
  | 'set_home_base'
  // Client -> Server: Profile
  | 'set_status'
  | 'set_colors'
  | 'set_anonymous'
  // Client -> Server: Queries
  | 'get_status'
  | 'get_system'
  | 'get_poi'
  | 'get_base'
  | 'get_ship'
  | 'get_skills'
  | 'get_recipes'
  | 'get_version'
  | 'help'
  // Client -> Server: Forum
  | 'forum_list'
  | 'forum_get_thread'
  | 'forum_create_thread'
  | 'forum_reply'
  | 'forum_upvote'
  | 'forum_delete_thread'
  | 'forum_delete_reply';

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
  timestamp: number;
}

export interface WelcomePayload {
  version: string;
  release_date: string;
  release_notes: string[];
  tick_rate: number;
  current_tick: number;
  server_time: number;
  motd: string;
  game_info?: string;
  website?: string;
  help_text?: string;
  terms?: string;
}

export interface RegisterPayload {
  username: string;
  empire: EmpireID;
}

export interface RegisteredPayload {
  token: string;
  player_id: string;
}

export interface LoginPayload {
  username: string;
  token: string;
}

export interface LoggedInPayload {
  player: Player;
  ship: Ship;
  system: System;
  poi: POI;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface StateUpdatePayload {
  tick: number;
  player: Player;
  ship: Ship;
  nearby: NearbyPlayer[];
  in_combat: boolean;
}

export interface TravelPayload {
  target_poi: string;
}

export interface JumpPayload {
  target_system: string;
}

export interface AttackPayload {
  target_id: string;
}

export interface ScanPayload {
  target_id: string;
}

export interface ScanResultPayload {
  target_id: string;
  success: boolean;
  revealed_info: string[];
  username?: string;
  ship_class?: string;
  hull?: number;
  shield?: number;
  faction_id?: string;
}

export interface BuyPayload {
  listing_id: string;
  quantity: number;
}

export interface SellPayload {
  item_id: string;
  quantity: number;
}

export interface CraftPayload {
  recipe_id: string;
}

export interface ChatPayload {
  channel: ChatChannel;
  content: string;
  target_id?: string;
}

export type ChatChannel = 'local' | 'system' | 'faction' | 'private' | 'global';

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  sender_id: string;
  sender: string;
  content: string;
  timestamp: string;
}

export interface CreateFactionPayload {
  name: string;
  tag: string;
}

export interface SetStatusPayload {
  status_message: string;
  clan_tag: string;
}

export interface SetColorsPayload {
  primary_color: string;
  secondary_color: string;
}

export interface VersionInfoPayload {
  version: string;
  release_date: string;
  release_notes: string[];
}

// Game action for LLM responses
export interface GameAction {
  command: string;
  args?: string[];
  reasoning?: string;
}
