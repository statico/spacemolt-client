import { SpaceMoltClient, type ClientState } from './client';
import { createAdapter, type AdapterType, type LLMAdapter } from './adapters';
import { loadCredentials, saveCredentials, loadNotes, appendJournal, type Credentials } from './storage';
import type { GameAction, WelcomePayload, RegisteredPayload, LoggedInPayload, ErrorPayload, StateUpdatePayload, ChatMessage, EmpireID } from './types';
import type { LogEntry } from './ui/App';

const SERVER_URL = process.env.SPACEMOLT_URL || 'wss://game.spacemolt.com/ws';
const DEBUG = process.env.DEBUG === 'true';

export interface EngineCallbacks {
  onStateChange: (state: ClientState) => void;
  onLog: (entry: LogEntry) => void;
  onAction: (action: GameAction | null) => void;
  onThinking: (thinking: boolean) => void;
}

export class GameEngine {
  private client: SpaceMoltClient;
  private adapter: LLMAdapter;
  private strategy: string;
  private credentials: Credentials | null = null;
  private recentEvents: string[] = [];
  private notes: string = '';
  private callbacks: EngineCallbacks;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    adapterType: AdapterType,
    strategy: string,
    callbacks: EngineCallbacks
  ) {
    this.adapter = createAdapter(adapterType);
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

      // Auto-login if we have credentials
      if (this.credentials) {
        this.log('system', `Auto-logging in as ${this.credentials.username}...`);
        this.client.login(this.credentials.username, this.credentials.token);
      }
    });

    this.client.on<RegisteredPayload>('registered', async (data) => {
      this.log('system', `Registered! Token: ${data.token.slice(0, 8)}...`);
      if (this.credentials) {
        this.credentials.token = data.token;
        await saveCredentials(this.credentials);
        // Now login with the new token
        this.client.login(this.credentials.username, data.token);
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
      }
    });

    this.client.on<StateUpdatePayload>('state_update', (data) => {
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

  async start(existingCredentials?: Credentials): Promise<void> {
    // Load saved credentials or use provided ones
    this.credentials = existingCredentials || (await loadCredentials());
    this.notes = await loadNotes();

    this.running = true;

    // Connect to the server
    await this.client.connect();
  }

  async registerNewPlayer(username: string, empire: EmpireID, playStyle: string): Promise<void> {
    this.credentials = { username, token: '', empire, playStyle };
    this.client.register(username, empire);
  }

  private startAILoop(): void {
    // Always clear existing interval to avoid duplicates
    this.stopAILoop();

    this.log('system', 'Starting AI loop...');

    // Run AI decision loop every 10 seconds (matching game tick rate)
    const tickRate = this.client.state.tickRate || 10;
    this.tickInterval = setInterval(() => this.runAITick(), tickRate * 1000);

    // Run first tick after a short delay to ensure state is settled
    setTimeout(() => this.runAITick(), 500);
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

      const action = await this.adapter.generateAction(
        this.client.state,
        this.strategy,
        this.recentEvents,
        this.notes
      );

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
    }
  }

  stop(): void {
    this.running = false;
    this.stopAILoop();
    this.client.disconnect();
  }
}

export default GameEngine;
