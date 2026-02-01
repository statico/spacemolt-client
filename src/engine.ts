import { SpaceMoltClient, type ClientState } from './client';
import { createAdapter, type AdapterType, type LLMAdapter } from './adapters';
import { loadCredentials, saveCredentials, loadNotes, appendJournal, loadNotebook, saveNotebook, type Credentials, type Notebook } from './storage';
import type { GameAction, WelcomePayload, RegisteredPayload, LoggedInPayload, ErrorPayload, StateUpdatePayload, ChatMessage, EmpireID } from './types';
import type { LogEntry } from './ui/App';

const SERVER_URL = process.env.SPACEMOLT_URL || 'wss://game.spacemolt.com/ws';
const DEBUG = process.env.DEBUG === 'true';

export interface EngineCallbacks {
  onStateChange: (state: ClientState) => void;
  onLog: (entry: LogEntry) => void;
  onAction: (action: GameAction | null) => void;
  onThinking: (thinking: boolean) => void;
  onNotebook?: (notebook: Notebook) => void;
}

export class GameEngine {
  private client: SpaceMoltClient;
  private adapter: LLMAdapter;
  private strategy: string;
  private credentials: Credentials | null = null;
  private recentEvents: string[] = [];
  private notes: string = '';
  private notebook: Notebook = { disposition: '', goals: [], notes: '' };
  private callbacks: EngineCallbacks;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    adapterType: AdapterType,
    strategy: string,
    callbacks: EngineCallbacks,
    model?: string
  ) {
    this.adapter = createAdapter(adapterType, model);
    this.strategy = strategy;
    this.callbacks = callbacks;

    this.client = new SpaceMoltClient({
      url: SERVER_URL,
      debug: DEBUG,
      reconnect: true,
    });

    this.setupEventHandlers();
  }

  get adapterName(): string {
    return this.adapter.name;
  }

  get state(): ClientState {
    return this.client.state;
  }

  setStrategy(newStrategy: string): void {
    this.strategy = newStrategy;
  }

  private log(type: LogEntry['type'], message: string) {
    const entry: LogEntry = { timestamp: new Date(), type, message };
    this.callbacks.onLog(entry);
    this.recentEvents.push(`[${type}] ${message}`);
    if (this.recentEvents.length > 50) {
      this.recentEvents.shift();
    }
  }

  private setupEventHandlers() {
    this.client.on<WelcomePayload>('welcome', (data) => {
      this.log('system', `Connected to SpaceMolt v${data.version}`);
      if (data.motd) {
        this.log('system', `MOTD: ${data.motd}`);
      }
      this.callbacks.onStateChange(this.client.state);

      // Auth only after welcome (reference client does the same)
      if (this.credentials?.token?.trim()) {
        this.log('system', `Logging in as ${this.credentials.username}...`);
        this.client.login(this.credentials.username, this.credentials.token);
        this.startAILoop();
      } else if (this.credentials) {
        this.log('system', `Registering as ${this.credentials.username}...`);
        this.client.register(this.credentials.username, this.credentials.empire as EmpireID);
      }
    });

    this.client.on<RegisteredPayload>('registered', (data) => {
      this.log('system', `Registered! Token: ${data.token.slice(0, 8)}...`);
      if (this.credentials) {
        this.credentials.token = data.token;
        // Login immediately so server gets it; save credentials after
        this.client.login(this.credentials.username, data.token);
        void saveCredentials(this.credentials);
      }
    });

    this.client.on<LoggedInPayload>('logged_in', (data) => {
      this.log('system', `Logged in as ${data.player.username}`);
      this.log('event', `Location: ${data.system.name} - ${data.poi.name}`);
      this.log('event', `Credits: ${data.player.credits}`);
      this.callbacks.onStateChange(this.client.state);

      // Start the AI loop
      this.startAILoop();
    });

    this.client.on<ErrorPayload>('error', (data) => {
      this.log('error', `${data.code}: ${data.message}`);

      // Handle already_authenticated - we're logged in but need to fetch state
      if (data.code === 'already_authenticated') {
        this.client.state.authenticated = true;
        this.client.getStatus();
        this.startAILoop();
        return;
      }

      // Username already registered: we tried register() but this account exists.
      // Either we're missing the token (saved too early / file lost) or we should have used login.
      if (data.code === 'username_taken') {
        const hasToken = !!(this.credentials?.token?.trim());
        if (!hasToken) {
          this.log(
            'system',
            'This username is already registered but no token is saved. ' +
              'Add your token to .spacemolt-credentials.json (key "token") to sign in, ' +
              'or delete that file and restart to register a new character.'
          );
        } else {
          this.log('system', 'Username already registered; server rejected login. Check your token in .spacemolt-credentials.json.');
        }
      }
    });

    this.client.on<StateUpdatePayload>('state_update', (data) => {
      // If we have full state but never got logged_in (e.g. registered response failed to parse), treat as authenticated
      if (data.player && data.ship && !this.client.state.authenticated) {
        this.client.state.authenticated = true;
        this.log('system', `Logged in as ${data.player.username} (from state)`);
        this.startAILoop();
      }
      this.callbacks.onStateChange(this.client.state);

      if (data.in_combat) {
        this.log('event', `IN COMBAT! Hull: ${data.ship.hull}/${data.ship.max_hull}`);
      }
    });

    this.client.on<ChatMessage>('chat_message', (data) => {
      this.log('chat', `[${data.channel}] ${data.sender}: ${data.content}`);
    });

    this.client.on('ok', (data: Record<string, unknown>) => {
      if (data.action) {
        let msg = `OK: ${data.action}`;
        if (data.action === 'mine' && data.ore_type && data.quantity) {
          msg = `Mined ${data.quantity}x ${data.ore_type}`;
        } else if ((data.action === 'buy' || data.action === 'sell') && data.item) {
          msg = `${data.action}: ${data.item} x${data.quantity}`;
        }
        this.log('event', msg);
      }
    });

    this.client.on('reconnecting', (data: { attempt: number }) => {
      this.log('system', `Reconnecting (attempt ${data.attempt})...`);
    });

    this.client.on('connected', (data: { reconnected?: boolean }) => {
      if (data.reconnected) {
        this.log('system', 'Reconnected!');
      }
    });

    this.client.on('disconnected', () => {
      this.log('system', 'Disconnected from server');
      this.stopAILoop();
    });
  }

  /** Start the engine. Pass credentials to use them; pass nothing to load from disk; pass null + newPlayer when registering. */
  async start(existingCredentials?: Credentials | null, newPlayer?: { username: string; empire: EmpireID } | null): Promise<void> {
    if (existingCredentials !== undefined) {
      this.credentials = existingCredentials;
    } else {
      this.credentials = await loadCredentials();
    }
    if (newPlayer) {
      this.credentials = {
        username: newPlayer.username,
        token: '',
        empire: newPlayer.empire,
        playStyle: this.strategy,
      };
      await saveCredentials(this.credentials);
    }
    this.notes = await loadNotes();
    this.notebook = await loadNotebook();
    this.callbacks.onNotebook?.(this.notebook);
    this.running = true;
    await this.client.connect();
  }

  private startAILoop(): void {
    // Always clear existing interval to avoid duplicates
    this.stopAILoop();

    this.log('system', 'Starting AI loop...');

    // Run AI decision loop every 10 seconds (matching game tick rate)
    const tickRate = this.client.state.tickRate || 10;
    this.tickInterval = setInterval(() => this.runAITick(), tickRate * 1000);

    // Run first tick immediately so we don't sit at "Waiting..." after login
    void this.runAITick();
  }

  private stopAILoop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private async runAITick(): Promise<void> {
    if (!this.running) return;
    if (!this.client.state.authenticated) {
      this.log('system', 'Waiting for authentication...');
      return;
    }

    try {
      this.callbacks.onThinking(true);

      let action: GameAction;
      try {
        action = await this.adapter.generateAction(
          this.client.state,
          this.strategy,
          this.recentEvents,
          this.notes
        );
      } catch (err) {
        this.log('error', `LLM failed: ${err}`);
        action = { command: 'status', reasoning: 'LLM error, checking status' };
      }

      this.callbacks.onThinking(false);

      // Re-check auth after async LLM call - connection state may have changed
      if (!this.running || !this.client.state.authenticated) {
        return;
      }

      this.callbacks.onAction(action);

      // Execute the action
      this.log('action', `${action.command} ${action.args?.join(' ') || ''}`);
      if (action.reasoning) {
        this.log('system', `Reasoning: ${action.reasoning}`);
      }

      this.client.executeCommand(action.command, action.args || []);

      // Periodically save to journal
      if (Math.random() < 0.1) {
        const summary = `Tick ${this.client.state.currentTick}: ${action.command} - ${action.reasoning || 'no reason given'}`;
        await appendJournal(summary);
      }
    } catch (error) {
      this.callbacks.onThinking(false);
      this.log('error', `AI error: ${error}`);
      // Still run a safe fallback so we're not stuck
      if (this.running && this.client.state.authenticated) {
        const fallback: GameAction = { command: 'status', reasoning: 'Recovering from error' };
        this.callbacks.onAction(fallback);
        this.client.executeCommand('status', []);
      }
    }
  }

  stop(): void {
    this.running = false;
    this.stopAILoop();
    this.client.disconnect();
  }
}

export default GameEngine;
