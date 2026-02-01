#!/usr/bin/env bun
/**
 * SpaceMolt AI Client
 * No credentials → register. Has credentials → login. Then play forever.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { App, type LogEntry } from './src/ui/App';
import { GameEngine } from './src/engine';
import { loadCredentials, loadPlayStyle, type Credentials, type Notebook } from './src/storage';
import type { ClientState } from './src/client';
import type { GameAction, EmpireID } from './src/types';
import { type AdapterType, createAdapter } from './src/adapters';

const args = process.argv.slice(2);
let adapterType: AdapterType = 'ollama';
let modelOverride: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--adapter' || args[i] === '-a') {
    const type = args[i + 1];
    if (type && ['ollama', 'claude', 'openai', 'gemini', 'groq'].includes(type)) {
      adapterType = type as AdapterType;
    }
  }
  if (args[i] === '--model' || args[i] === '-m') {
    modelOverride = args[i + 1];
  }
}

const DEFAULT_EMPIRE: EmpireID = 'outerrim';
const DEFAULT_PLAY_STYLE = 'balanced';

function GameScreen({
  playStyle,
  credentials,
  newPlayer,
}: {
  playStyle: string;
  credentials: Credentials | null;
  newPlayer: { username: string; empire: EmpireID } | null;
}) {
  const [state, setState] = useState<ClientState>({
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
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentAction, setCurrentAction] = useState<GameAction | null>(null);
  const [thinking, setThinking] = useState(false);
  const [notebook, setNotebook] = useState<Notebook>({ disposition: '', goals: [], notes: '' });
  const [engine, setEngine] = useState<GameEngine | null>(null);

  const handleLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev.slice(-100), entry]);
  }, []);

  const handleQuit = useCallback(() => {
    engine?.stop();
  }, [engine]);

  useEffect(() => {
    const gameEngine = new GameEngine(adapterType, playStyle, {
      onStateChange: setState,
      onLog: handleLog,
      onAction: setCurrentAction,
      onThinking: setThinking,
      onNotebook: setNotebook,
    }, modelOverride);
    setEngine(gameEngine);

    if (credentials) {
      gameEngine.start(credentials).catch((err) => {
        handleLog({ timestamp: new Date(), type: 'error', message: `Connection failed: ${err?.message ?? err}` });
      });
    } else if (newPlayer) {
      gameEngine.start(null, newPlayer).catch((err) => {
        handleLog({ timestamp: new Date(), type: 'error', message: `Connection failed: ${err?.message ?? err}` });
      });
    }

    return () => gameEngine.stop();
  }, [playStyle, credentials, newPlayer, handleLog]);

  return (
    <App
      state={state}
      strategy={playStyle}
      adapterName={engine?.adapterName ?? adapterType}
      currentAction={currentAction}
      thinking={thinking}
      logs={logs}
      notebook={notebook}
      onQuit={handleQuit}
    />
  );
}

function Root() {
  const [ready, setReady] = useState(false);
  const [playStyle, setPlayStyle] = useState(DEFAULT_PLAY_STYLE);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [newPlayer, setNewPlayer] = useState<{ username: string; empire: EmpireID } | null>(null);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.ctrl && input === 'c') exit();
  });

  useEffect(() => {
    let cancelled = false;
    loadCredentials().then(async (creds) => {
      const hasValidCreds = creds && creds.username && creds.token?.trim();
      if (hasValidCreds) {
        const style = creds.playStyle?.trim() || (await loadPlayStyle()) || DEFAULT_PLAY_STYLE;
        if (!cancelled) {
          setPlayStyle(style);
          setCredentials(creds);
          setNewPlayer(null);
          setReady(true);
        }
      } else {
        const style = (await loadPlayStyle()) || DEFAULT_PLAY_STYLE;
        setPlayStyle(style);
        setCredentials(null);
        try {
          const adapter = createAdapter(adapterType, modelOverride);
          const identity = await adapter.generateIdentity(style);
          if (!cancelled) {
            setNewPlayer({ username: identity.username, empire: identity.empire });
            setReady(true);
          }
        } catch (err) {
          console.error('LLM identity failed:', err);
          if (!cancelled) {
            setNewPlayer({
              username: `Pilot${Math.floor(Math.random() * 90000) + 10000}`,
              empire: DEFAULT_EMPIRE,
            });
            setReady(true);
          }
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">
          <Spinner type="dots" /> {credentials === null && !newPlayer ? 'Generating pilot...' : 'Loading...'}
        </Text>
      </Box>
    );
  }

  return <GameScreen playStyle={playStyle} credentials={credentials} newPlayer={newPlayer} />;
}

console.clear();
render(<Root />, {
  incrementalRendering: true,
  patchConsole: false,
});
