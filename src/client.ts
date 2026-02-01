import type {
  Message,
  MessageType,
  WelcomePayload,
  RegisterPayload,
  RegisteredPayload,
  LoginPayload,
  LoggedInPayload,
  ErrorPayload,
  StateUpdatePayload,
  TravelPayload,
  JumpPayload,
  AttackPayload,
  ScanPayload,
  ScanResultPayload,
  BuyPayload,
  SellPayload,
  CraftPayload,
  ChatPayload,
  ChatMessage,
  CreateFactionPayload,
  SetStatusPayload,
  SetColorsPayload,
  EmpireID,
  Player,
  Ship,
  System,
  POI,
  Base,
  NearbyPlayer,
} from './types';

export type EventHandler<T> = (data: T) => void;

export interface ClientOptions {
  url: string;
  reconnect?: boolean;
  reconnectDelay?: number;
  debug?: boolean;
}

export interface ClientState {
  connected: boolean;
  authenticated: boolean;
  player: Player | null;
  ship: Ship | null;
  system: System | null;
  poi: POI | null;
  base: Base | null;
  nearby: NearbyPlayer[];
  inCombat: boolean;
  currentTick: number;
  serverVersion?: string;
  tickRate?: number;
}

export class SpaceMoltClient {
  private ws: WebSocket | null = null;
  private options: Required<ClientOptions>;
  private eventHandlers: Map<string, Set<EventHandler<unknown>>> = new Map();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Message[] = [];
  private reconnectAttempts: number = 0;
  private savedCredentials: { username: string; token: string } | null = null;

  public state: ClientState = {
    connected: false,
    authenticated: false,
    player: null,
    ship: null,
    system: null,
    poi: null,
    base: null,
    nearby: [],
    inCombat: false,
    currentTick: 0,
  };

  constructor(options: ClientOptions) {
    this.options = {
      reconnect: true,
      reconnectDelay: 5000,
      debug: false,
      ...options,
    };
  }

  connect(): Promise<void> {
    const timeoutMs = 15_000;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          this.ws = null;
          reject(err);
        } else {
          resolve();
        }
      };

      const timer = setTimeout(() => {
        const ws = this.ws;
        if (ws) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          this.ws = null;
        }
        finish(new Error(`Connection timeout after ${timeoutMs / 1000}s. Is the server reachable?`));
      }, timeoutMs);

      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.onopen = () => {
          this.state.connected = true;
          this.reconnectAttempts = 0;
          this.log('Connected to server');
          this.emit('connected', { reconnected: this.savedCredentials !== null });
          this.flushMessageQueue();
          finish();
        };

        this.ws.onclose = () => {
          this.state.connected = false;
          this.state.authenticated = false;
          this.messageQueue = [];
          this.log('Disconnected from server');
          this.emit('disconnected', {});

          if (this.options.reconnect) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.log('WebSocket error:', error);
          this.emit('ws_error', { error });
          finish(error instanceof Error ? error : new Error(String(error)));
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.options.reconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
      60000
    );

    this.log(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})...`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect().catch((err) => {
        this.log('Reconnection failed:', err);
      });
    }, delay);
  }

  getSavedCredentials(): { username: string; token: string } | null {
    return this.savedCredentials;
  }

  clearCredentials(): void {
    this.savedCredentials = null;
  }

  private handleMessage(data: string): void {
    const trimmed = data.trim();
    if (!trimmed) return;

    let msg: Message | null = null;
    let rest = '';

    try {
      msg = JSON.parse(trimmed) as Message;
    } catch {
      // Maybe multiple JSON objects concatenated (no newline): parse first object only
      if (trimmed.startsWith('{')) {
        let depth = 0;
        let end = -1;
        for (let i = 0; i < trimmed.length; i++) {
          if (trimmed[i] === '{') depth++;
          else if (trimmed[i] === '}') {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
        if (end > 0) {
          try {
            msg = JSON.parse(trimmed.slice(0, end)) as Message;
            rest = trimmed.slice(end).trim();
          } catch {
            // fall through
          }
        }
      }
      if (msg == null) {
        // Server may send a raw token for 'registered' (non-JSON)
        if (!trimmed.startsWith('[')) {
          this.log('Received: (raw token)');
          this.handleRegistered({ token: trimmed, player_id: '' });
          return;
        }
        this.log('Error parsing message:', trimmed.slice(0, 100));
        return;
      }
    }

    const m = msg!;
    this.log('Received:', m.type, m.payload);

    switch (m.type) {
      case 'welcome':
        this.handleWelcome(m.payload as WelcomePayload);
        break;
      case 'registered':
        this.handleRegistered(m.payload as RegisteredPayload);
        break;
      case 'logged_in':
        this.handleLoggedIn(m.payload as LoggedInPayload);
        break;
      case 'error':
        this.handleError(m.payload as ErrorPayload);
        break;
      case 'ok':
        this.emit('ok', m.payload);
        break;
      case 'state_update':
        this.handleStateUpdate(m.payload as StateUpdatePayload);
        break;
      case 'scan_result':
        this.emit('scan_result', m.payload as ScanResultPayload);
        break;
      case 'chat_message':
        this.emit('chat_message', m.payload as ChatMessage);
        break;
      case 'version_info':
        this.emit('version_info', m.payload);
        break;
      case 'combat_update':
        this.emit('combat_update', m.payload);
        break;
      case 'player_died':
        this.emit('player_died', m.payload);
        break;
      case 'mining_yield':
        this.emit('mining_yield', m.payload);
        break;
      case 'trade_offer_received':
        this.emit('trade_offer_received', m.payload);
        break;
      case 'tick':
        this.state.currentTick = (m.payload as { tick: number }).tick;
        this.emit('tick', m.payload);
        break;
      default:
        this.emit(m.type, m.payload);
    }

    if (rest) this.handleMessage(rest);
  }

  private handleWelcome(payload: WelcomePayload): void {
    this.state.currentTick = payload.current_tick;
    this.state.serverVersion = payload.version;
    this.state.tickRate = payload.tick_rate;
    this.emit('welcome', payload);
  }

  private handleRegistered(payload: RegisteredPayload): void {
    this.emit('registered', payload);
  }

  private handleLoggedIn(payload: LoggedInPayload): void {
    this.state.authenticated = true;
    this.state.player = payload.player;
    this.state.ship = payload.ship;
    this.state.system = payload.system;
    this.state.poi = payload.poi;
    this.emit('logged_in', payload);
  }

  private handleError(payload: ErrorPayload): void {
    this.log('Error:', payload.code, payload.message);
    this.emit('error', payload);
  }

  private handleStateUpdate(payload: StateUpdatePayload): void {
    this.state.currentTick = payload.tick;
    this.state.player = payload.player;
    this.state.ship = payload.ship;
    this.state.nearby = payload.nearby;
    this.state.inCombat = payload.in_combat;
    this.emit('state_update', payload);
  }

  private send<T>(type: MessageType, payload?: T): void {
    const msg: Message<T> = {
      type,
      payload: payload as T,
      timestamp: Date.now(),
    };

    if (!this.state.connected || !this.ws) {
      this.messageQueue.push(msg as Message);
      return;
    }

    this.log('Sending:', type, payload);
    this.ws.send(JSON.stringify(msg));
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state.connected && this.ws) {
      const msg = this.messageQueue.shift()!;
      this.ws.send(JSON.stringify(msg));
    }
  }

  // Authentication
  register(username: string, empire: EmpireID): void {
    this.send<RegisterPayload>('register', { username, empire });
  }

  login(username: string, token: string): void {
    this.savedCredentials = { username, token };
    this.send<LoginPayload>('login', { username, token });
  }

  logout(): void {
    this.send('logout');
    this.state.authenticated = false;
    this.state.player = null;
    this.state.ship = null;
    this.savedCredentials = null;
  }

  // Navigation
  travel(destinationPOI: string): void {
    this.send<TravelPayload>('travel', { target_poi: destinationPOI });
  }

  jump(destinationSystem: string): void {
    this.send<JumpPayload>('jump', { target_system: destinationSystem });
  }

  dock(): void {
    this.send('dock');
  }

  undock(): void {
    this.send('undock');
  }

  // Combat
  attack(targetId: string): void {
    this.send<AttackPayload>('attack', { target_id: targetId });
  }

  scan(targetId: string): void {
    this.send<ScanPayload>('scan', { target_id: targetId });
  }

  // Mining
  mine(): void {
    this.send('mine');
  }

  // Trading
  buy(listingId: string, quantity: number): void {
    this.send<BuyPayload>('buy', { listing_id: listingId, quantity });
  }

  sell(itemId: string, quantity: number): void {
    this.send<SellPayload>('sell', { item_id: itemId, quantity });
  }

  refuel(): void {
    this.send('refuel');
  }

  repair(): void {
    this.send('repair');
  }

  // Crafting
  craft(recipeId: string): void {
    this.send<CraftPayload>('craft', { recipe_id: recipeId });
  }

  // Chat
  chat(channel: ChatPayload['channel'], content: string, targetId?: string): void {
    this.send<ChatPayload>('chat', { channel, content, target_id: targetId });
  }

  localChat(content: string): void {
    this.chat('local', content);
  }

  factionChat(content: string): void {
    this.chat('faction', content);
  }

  privateMessage(targetId: string, content: string): void {
    this.chat('private', content, targetId);
  }

  // Faction
  createFaction(name: string, tag: string): void {
    this.send<CreateFactionPayload>('create_faction', { name, tag });
  }

  // Profile
  setStatus(statusMessage: string, clanTag: string): void {
    this.send<SetStatusPayload>('set_status', { status_message: statusMessage, clan_tag: clanTag });
  }

  setColors(primaryColor: string, secondaryColor: string): void {
    this.send<SetColorsPayload>('set_colors', { primary_color: primaryColor, secondary_color: secondaryColor });
  }

  setAnonymous(anonymous: boolean): void {
    this.send('set_anonymous', { anonymous });
  }

  // Ship Management
  buyShip(shipClass: string): void {
    this.send('buy_ship', { ship_class: shipClass });
  }

  installMod(moduleId: string, slotIdx: number): void {
    this.send('install_mod', { module_id: moduleId, slot_idx: slotIdx });
  }

  uninstallMod(slotIdx: number): void {
    this.send('uninstall_mod', { slot_idx: slotIdx });
  }

  // Market Listings
  listItem(itemId: string, quantity: number, priceEach: number): void {
    this.send('list_item', { item_id: itemId, quantity, price_each: priceEach });
  }

  cancelListing(listingId: string): void {
    this.send('cancel_list', { listing_id: listingId });
  }

  // Wrecks & Salvage
  getWrecks(): void {
    this.send('get_wrecks');
  }

  lootWreck(wreckId: string, itemId: string, quantity: number): void {
    this.send('loot_wreck', { wreck_id: wreckId, item_id: itemId, quantity });
  }

  salvageWreck(wreckId: string): void {
    this.send('salvage_wreck', { wreck_id: wreckId });
  }

  // Insurance
  buyInsurance(coveragePercent: number): void {
    this.send('buy_insurance', { coverage_percent: Math.min(100, Math.max(50, coveragePercent)) });
  }

  claimInsurance(): void {
    this.send('claim_insurance');
  }

  setHomeBase(): void {
    this.send('set_home_base');
  }

  // Faction Management
  joinFaction(factionId: string): void {
    this.send('join_faction', { faction_id: factionId });
  }

  leaveFaction(): void {
    this.send('leave_faction');
  }

  factionInvite(playerId: string): void {
    this.send('faction_invite', { player_id: playerId });
  }

  factionKick(playerId: string): void {
    this.send('faction_kick', { player_id: playerId });
  }

  factionPromote(playerId: string, roleId: string): void {
    this.send('faction_promote', { player_id: playerId, role_id: roleId });
  }

  // Player-to-Player Trading
  tradeOffer(targetId: string, offerItems: { item_id: string; quantity: number }[], offerCredits: number, requestItems: { item_id: string; quantity: number }[], requestCredits: number): void {
    this.send('trade_offer', { target_id: targetId, offer_items: offerItems, offer_credits: offerCredits, request_items: requestItems, request_credits: requestCredits });
  }

  tradeAccept(tradeId: string): void {
    this.send('trade_accept', { trade_id: tradeId });
  }

  tradeDecline(tradeId: string): void {
    this.send('trade_decline', { trade_id: tradeId });
  }

  tradeCancel(tradeId: string): void {
    this.send('trade_cancel', { trade_id: tradeId });
  }

  getTrades(): void {
    this.send('get_trades');
  }

  // Queries
  getStatus(): void {
    this.send('get_status');
  }

  getSystem(): void {
    this.send('get_system');
  }

  getPOI(): void {
    this.send('get_poi');
  }

  getBase(): void {
    this.send('get_base');
  }

  getShip(): void {
    this.send('get_ship');
  }

  getSkills(): void {
    this.send('get_skills');
  }

  getRecipes(): void {
    this.send('get_recipes');
  }

  getVersion(): void {
    this.send('get_version');
  }

  help(topic?: string): void {
    this.send('help', topic ? { topic } : undefined);
  }

  // Forum
  forumList(page: number = 0, category: string = 'general'): void {
    this.send('forum_list', { page, category });
  }

  forumGetThread(threadId: string): void {
    this.send('forum_get_thread', { thread_id: threadId });
  }

  forumCreateThread(title: string, content: string, category: string = 'general'): void {
    this.send('forum_create_thread', { title, content, category });
  }

  forumReply(threadId: string, content: string): void {
    this.send('forum_reply', { thread_id: threadId, content });
  }

  forumUpvote(threadId?: string, replyId?: string): void {
    if (threadId) {
      this.send('forum_upvote', { thread_id: threadId });
    } else if (replyId) {
      this.send('forum_upvote', { reply_id: replyId });
    }
  }

  // Execute a command string (for LLM-generated actions)
  executeCommand(command: string, args: string[] = []): void {
    const arg0 = args[0]?.trim();
    const arg1 = args[1]?.trim();
    const quantity = Math.max(0, parseInt(args[1], 10) || 1);

    switch (command) {
      // Navigation
      case 'travel':
        if (arg0) this.travel(arg0);
        break;
      case 'jump':
        if (arg0) this.jump(arg0);
        break;
      case 'dock': this.dock(); break;
      case 'undock': this.undock(); break;

      // Combat
      case 'attack':
        if (arg0) this.attack(arg0);
        break;
      case 'scan':
        if (arg0) this.scan(arg0);
        break;

      // Mining
      case 'mine': this.mine(); break;

      // Trading
      case 'buy':
        if (arg0) this.buy(arg0, quantity);
        break;
      case 'sell':
        if (arg0) this.sell(arg0, quantity);
        break;

      // Ship
      case 'refuel': this.refuel(); break;
      case 'repair': this.repair(); break;
      case 'buy_ship':
        if (arg0) this.buyShip(arg0);
        break;

      // Wrecks
      case 'get_wrecks': this.getWrecks(); break;
      case 'salvage':
        if (arg0) this.salvageWreck(arg0);
        break;
      case 'loot':
        if (arg0 && arg1) this.lootWreck(arg0, arg1, quantity);
        break;

      // Insurance
      case 'buy_insurance':
        this.buyInsurance(parseInt(arg0, 10) || 75);
        break;
      case 'claim_insurance': this.claimInsurance(); break;
      case 'set_home': this.setHomeBase(); break;

      // Crafting
      case 'craft':
        if (arg0) this.craft(arg0);
        break;

      // Chat
      case 'say': this.localChat(args.join(' ')); break;
      case 'faction': this.factionChat(args.join(' ')); break;
      case 'msg':
        if (args.length >= 2 && arg0) this.privateMessage(arg0, args.slice(1).join(' '));
        break;

      // Queries
      case 'status': this.getStatus(); break;
      case 'system': this.getSystem(); break;
      case 'poi': this.getPOI(); break;
      case 'base': this.getBase(); break;
      case 'ship': this.getShip(); break;
      case 'skills': this.getSkills(); break;
      case 'recipes': this.getRecipes(); break;
      case 'wrecks': this.getWrecks(); break;
      case 'trades': this.getTrades(); break;
      case 'help':
        this.help(arg0);
        break;

      default:
        this.log('Unknown command:', command);
    }
  }

  // Event handling
  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler<unknown>);

    return () => {
      this.eventHandlers.get(event)?.delete(handler as EventHandler<unknown>);
    };
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.eventHandlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  private emit<T>(event: string, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.log('Error in event handler:', error);
        }
      });
    }
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[SpaceMolt]', ...args);
    }
  }
}

export default SpaceMoltClient;
