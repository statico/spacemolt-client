#!/usr/bin/env bun
/**
 * SpaceMolt AI Client
 * An autonomous AI-powered client for the SpaceMolt MMO game
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { App, type LogEntry } from './src/ui/App';
import { GameEngine } from './src/engine';
import { loadCredentials, type Credentials } from './src/storage';
import type { ClientState } from './src/client';
import type { GameAction, EmpireID } from './src/types';
import { type AdapterType } from './src/adapters';

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

// Startup screen to get strategy
function StartupScreen({ onStart }: { onStart: (strategy: string, credentials: Credentials | null) => void }) {
  const [phase, setPhase] = useState<'loading' | 'username' | 'empire' | 'strategy'>('loading');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [username, setUsername] = useState('');
  const [empire, setEmpire] = useState<EmpireID>('solarian');
  const [strategy, setStrategy] = useState('');
  const { exit } = useApp();

  useEffect(() => {
    loadCredentials().then((creds) => {
      if (creds) {
        setCredentials(creds);
        setPhase('strategy');
      } else {
        setPhase('username');
      }
    });
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }

    if (phase === 'empire') {
      const empires: EmpireID[] = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim'];
      const idx = parseInt(input);
      if (idx >= 1 && idx <= 5) {
        setEmpire(empires[idx - 1]);
        setPhase('strategy');
      }
    }
  });

  const handleUsernameSubmit = () => {
    if (username.trim()) {
      setPhase('empire');
    }
  };

  const handleStrategySubmit = () => {
    if (strategy.trim()) {
      const creds = credentials || { username, token: '', empire };
      onStart(strategy, credentials ? credentials : null);
    }
  };

  if (phase === 'loading') {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="cyan">Loading...</Text>
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
        <Text color="yellow">LLM Adapter: </Text>
        <Text color="green" bold>{adapterType.toUpperCase()}</Text>
      </Box>

      {phase === 'username' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            No saved credentials found. Let's create a new pilot!
          </Text>
          <Box marginTop={1}>
            <Text color="yellow">Enter username: </Text>
            <TextInput
              value={username}
              onChange={setUsername}
              onSubmit={handleUsernameSubmit}
            />
          </Box>
        </Box>
      )}

      {phase === 'empire' && (
        <Box flexDirection="column">
          <Text color="cyan" bold>
            Choose your empire:
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="white">[1] <Text color="yellow">SOLARIAN</Text> - The golden empire of Sol</Text>
            <Text color="white">[2] <Text color="magenta">VOIDBORN</Text> - Children of the void</Text>
            <Text color="white">[3] <Text color="red">CRIMSON</Text> - The blood-red warriors</Text>
            <Text color="white">[4] <Text color="blue">NEBULA</Text> - Dwellers of the cosmic clouds</Text>
            <Text color="white">[5] <Text color="gray">OUTERRIM</Text> - Frontier settlers</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="green">Press 1-5 to select</Text>
          </Box>
        </Box>
      )}

      {phase === 'strategy' && (
        <Box flexDirection="column">
          {credentials ? (
            <Text color="green">
              Welcome back, <Text bold>{credentials.username}</Text>!
            </Text>
          ) : (
            <Text color="green">
              Creating pilot <Text bold>{username}</Text> [{empire.toUpperCase()}]
            </Text>
          )}

          <Box marginTop={1}>
            <Text color="cyan" bold>
              Describe your play style and strategy:
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray">
              Examples: "Focus on mining and trading to get rich",
              "Aggressive PvP hunter", "Explorer who maps new systems",
              "Social player who makes alliances"
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="yellow">{'>'} </Text>
            <TextInput
              value={strategy}
              onChange={setStrategy}
              onSubmit={handleStrategySubmit}
              placeholder="Enter your strategy..."
            />
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text color="gray">[Ctrl+C to quit]</Text>
      </Box>
    </Box>
  );
}

// Main game screen
function GameScreen({
  strategy,
  credentials,
  newPlayer
}: {
  strategy: string;
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
    const gameEngine = new GameEngine(adapterType, strategy, {
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
  }, [strategy, credentials, newPlayer, handleLog]);

  return (
    <App
      state={state}
      strategy={strategy}
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
  const [strategy, setStrategy] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [newPlayer, setNewPlayer] = useState<{ username: string; empire: EmpireID } | null>(null);

  const handleStart = (strat: string, creds: Credentials | null) => {
    setStrategy(strat);
    setCredentials(creds);
    setStarted(true);
  };

  if (!started) {
    return <StartupScreen onStart={handleStart} />;
  }

  return <GameScreen strategy={strategy} credentials={credentials} newPlayer={newPlayer} />;
}

// Start the app
console.clear();
render(<Root />);
