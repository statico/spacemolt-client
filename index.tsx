#!/usr/bin/env bun
/**
 * SpaceMolt AI Client
 * An autonomous AI-powered client for the SpaceMolt MMO game
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { App, type LogEntry } from './src/ui/App';
import { GameEngine } from './src/engine';
import { loadCredentials, type Credentials } from './src/storage';
import type { ClientState } from './src/client';
import type { GameAction, EmpireID } from './src/types';
import { type AdapterType, createAdapter } from './src/adapters';

// Parse CLI args
const args = process.argv.slice(2);
let adapterType: AdapterType = 'ollama';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--adapter' || args[i] === '-a') {
    const type = args[i + 1] as AdapterType;
    if (['ollama', 'claude', 'openai', 'gemini'].includes(type)) {
      adapterType = type;
    }
  }
}

// Startup screen - only asks for play style
function StartupScreen({ onStart }: { onStart: (playStyle: string, credentials: Credentials | null, newPlayer: { username: string; empire: EmpireID } | null) => void }) {
  const [phase, setPhase] = useState<'loading' | 'playstyle' | 'generating'>('loading');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [playStyle, setPlayStyle] = useState('');
  const { exit } = useApp();

  useEffect(() => {
    loadCredentials().then((creds) => {
      setCredentials(creds);
      setPhase('playstyle');
    });
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const handlePlayStyleSubmit = async () => {
    if (!playStyle.trim()) return;

    if (credentials) {
      // Existing player - just start with the play style
      onStart(playStyle, credentials, null);
    } else {
      // New player - generate username and empire with LLM
      setPhase('generating');

      try {
        const adapter = createAdapter(adapterType);
        const identity = await adapter.generateIdentity(playStyle);
        onStart(playStyle, null, { username: identity.username, empire: identity.empire });
      } catch (error) {
        console.error('Failed to generate identity:', error);
        // Fallback
        const fallbackName = `Pilot${Math.floor(Math.random() * 10000)}`;
        onStart(playStyle, null, { username: fallbackName, empire: 'outerrim' });
      }
    }
  };

  if (phase === 'loading') {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">
          <Spinner type="dots" /> Loading...
        </Text>
      </Box>
    );
  }

  if (phase === 'generating') {
    return (
      <Box flexDirection="column" padding={2}>
        <Box marginBottom={1}>
          <Text color="magenta" bold>
            {'>>>'} SPACEMOLT AI CLIENT {'<<<'}
          </Text>
        </Box>
        <Text color="cyan">{'═'.repeat(50)}</Text>
        <Box marginTop={2}>
          <Text color="yellow">
            <Spinner type="dots" /> Generating pilot identity...
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={2}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          {'>>>'} SPACEMOLT AI CLIENT {'<<<'}
        </Text>
      </Box>
      <Text color="cyan">{'═'.repeat(50)}</Text>

      <Box marginTop={1} marginBottom={1}>
        <Text color="yellow">LLM: </Text>
        <Text color="green" bold>{adapterType.toUpperCase()}</Text>
      </Box>

      {credentials ? (
        <Box marginBottom={1}>
          <Text color="green">
            Welcome back, <Text bold>{credentials.username}</Text>!
          </Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color="cyan">New pilot - identity will be generated based on your play style</Text>
        </Box>
      )}

      <Box flexDirection="column">
        <Text color="cyan" bold>
          Describe your play style:
        </Text>
        <Box marginTop={1}>
          <Text color="gray">
            Examples: aggressive, explorer, social, trader, pirate, miner
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="yellow">{'>'} </Text>
          <TextInput
            value={playStyle}
            onChange={setPlayStyle}
            onSubmit={handlePlayStyleSubmit}
            placeholder="Enter play style..."
          />
        </Box>
      </Box>

      <Box marginTop={2}>
        <Text color="gray">[Ctrl+C to quit]</Text>
      </Box>
    </Box>
  );
}

// Main game screen
function GameScreen({
  playStyle,
  credentials,
  newPlayer
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
    });

    setEngine(gameEngine);

    // Start the engine
    if (credentials) {
      gameEngine.start(credentials);
    } else if (newPlayer) {
      gameEngine.start().then(() => {
        gameEngine.registerNewPlayer(newPlayer.username, newPlayer.empire);
      });
    }

    return () => {
      gameEngine.stop();
    };
  }, [playStyle, credentials, newPlayer, handleLog]);

  return (
    <App
      state={state}
      strategy={playStyle}
      adapterName={engine?.adapterName || adapterType}
      currentAction={currentAction}
      thinking={thinking}
      logs={logs}
      onQuit={handleQuit}
    />
  );
}

// Root component
function Root() {
  const [started, setStarted] = useState(false);
  const [playStyle, setPlayStyle] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [newPlayer, setNewPlayer] = useState<{ username: string; empire: EmpireID } | null>(null);

  const handleStart = (style: string, creds: Credentials | null, player: { username: string; empire: EmpireID } | null) => {
    setPlayStyle(style);
    setCredentials(creds);
    setNewPlayer(player);
    setStarted(true);
  };

  if (!started) {
    return <StartupScreen onStart={handleStart} />;
  }

  return <GameScreen playStyle={playStyle} credentials={credentials} newPlayer={newPlayer} />;
}

// Start the app
console.clear();
render(<Root />, { incrementalRendering: true });
