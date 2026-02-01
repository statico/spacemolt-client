import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { ClientState } from '../client';
import type { GameAction, ChatMessage } from '../types';

interface LogEntry {
  timestamp: Date;
  type: 'action' | 'event' | 'chat' | 'error' | 'system';
  message: string;
}

interface AppProps {
  state: ClientState;
  strategy: string;
  adapterName: string;
  currentAction: GameAction | null;
  thinking: boolean;
  logs: LogEntry[];
  onQuit: () => void;
}

const CYBER_CHARS = ['>', '|', '/', '-', '\\', '|'];

function CyberBorder({ char = '>' }: { char?: string }) {
  return <Text color="cyan">{char}</Text>;
}

function Header({ version, tick }: { version?: string; tick: number }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % CYBER_CHARS.length), 150);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="magenta" bold>
          {'>>>'} SPACEMOLT CLIENT v0.1.0 {'<<<'}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="cyan">Server: {version || 'connecting...'}</Text>
        <Text color="gray"> | </Text>
        <Text color="yellow">Tick: {tick}</Text>
      </Box>
      <Text color="cyan" dimColor>
        {'═'.repeat(60)}
      </Text>
    </Box>
  );
}

function StatusPanel({ state, strategy, adapterName }: { state: ClientState; strategy: string; adapterName: string }) {
  const { player, ship, system, poi, inCombat } = state;

  if (!player || !ship) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Connecting...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={inCombat ? 'red' : 'green'} paddingX={1}>
      <Box>
        <Text color="green" bold>
          {player.username}
        </Text>
        <Text color="gray"> [{player.empire.toUpperCase()}]</Text>
        {inCombat && <Text color="red" bold> !!! COMBAT !!!</Text>}
      </Box>

      <Box marginTop={1}>
        <Box flexDirection="column" width="50%">
          <Text color="cyan">LOC: </Text>
          <Text color="white">{system?.name || player.current_system}</Text>
          <Text color="gray"> / {poi?.name || player.current_poi}</Text>
          {player.docked_at_base && <Text color="blue"> [DOCKED]</Text>}
        </Box>
        <Box flexDirection="column" width="50%">
          <Text color="yellow">CR$ {player.credits.toLocaleString()}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Box flexDirection="column" width="33%">
          <Text color={ship.hull < ship.max_hull * 0.3 ? 'red' : 'green'}>
            HULL {ship.hull}/{ship.max_hull}
          </Text>
        </Box>
        <Box flexDirection="column" width="33%">
          <Text color="blue">
            SHLD {ship.shield}/{ship.max_shield}
          </Text>
        </Box>
        <Box flexDirection="column" width="34%">
          <Text color={ship.fuel < ship.max_fuel * 0.2 ? 'red' : 'yellow'}>
            FUEL {ship.fuel}/{ship.max_fuel}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">CARGO: </Text>
        <Text color="white">
          {ship.cargo_used}/{ship.cargo_capacity}
        </Text>
        {ship.cargo.length > 0 && (
          <Text color="gray"> [{ship.cargo.map((c) => `${c.item_id}:${c.quantity}`).join(', ')}]</Text>
        )}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text color="magenta">AI: </Text>
        <Text color="white">{adapterName}</Text>
        <Text color="gray"> | Strategy: </Text>
        <Text color="cyan">{strategy.slice(0, 40)}{strategy.length > 40 ? '...' : ''}</Text>
      </Box>
    </Box>
  );
}

function NearbyPanel({ nearby }: { nearby: ClientState['nearby'] }) {
  if (nearby.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">No contacts in range</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>
        NEARBY [{nearby.length}]
      </Text>
      {nearby.slice(0, 5).map((p, i) => (
        <Box key={i}>
          <Text color={p.in_combat ? 'red' : 'white'}>
            {p.anonymous ? '[ANON]' : p.username || 'Unknown'}
          </Text>
          {p.clan_tag && <Text color="yellow"> [{p.clan_tag}]</Text>}
          {p.faction_tag && <Text color="blue"> &lt;{p.faction_tag}&gt;</Text>}
          {p.in_combat && <Text color="red"> *</Text>}
        </Box>
      ))}
      {nearby.length > 5 && <Text color="gray">...and {nearby.length - 5} more</Text>}
    </Box>
  );
}

function ActionPanel({ action, thinking }: { action: GameAction | null; thinking: boolean }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="magenta" paddingX={1}>
      <Text color="magenta" bold>
        CURRENT ACTION
      </Text>
      {thinking ? (
        <Box>
          <Text color="yellow">
            <Spinner type="dots" /> Thinking...
          </Text>
        </Box>
      ) : action ? (
        <Box flexDirection="column">
          <Text color="green">
            {'>'} {action.command} {action.args?.join(' ')}
          </Text>
          {action.reasoning && (
            <Text color="gray" wrap="truncate-end">
              {action.reasoning}
            </Text>
          )}
        </Box>
      ) : (
        <Text color="gray">Waiting...</Text>
      )}
    </Box>
  );
}

function LogPanel({ logs }: { logs: LogEntry[] }) {
  const recentLogs = logs.slice(-12);

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'action':
        return 'green';
      case 'event':
        return 'cyan';
      case 'chat':
        return 'yellow';
      case 'error':
        return 'red';
      case 'system':
        return 'magenta';
      default:
        return 'white';
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} flexGrow={1}>
      <Text color="gray" bold>
        EVENT LOG
      </Text>
      {recentLogs.map((log, i) => (
        <Box key={i}>
          <Text color="gray">[{log.timestamp.toLocaleTimeString()}] </Text>
          <Text color={getColor(log.type)}>{log.message}</Text>
        </Box>
      ))}
      {logs.length === 0 && <Text color="gray">No events yet...</Text>}
    </Box>
  );
}

function Footer() {
  return (
    <Box marginTop={1}>
      <Text color="cyan" dimColor>
        {'═'.repeat(60)}
      </Text>
    </Box>
  );
}

function FooterBar() {
  return (
    <Box>
      <Text color="gray">[Q] Quit | [J] View Journal | [N] View Notes</Text>
    </Box>
  );
}

export function App({ state, strategy, adapterName, currentAction, thinking, logs, onQuit }: AppProps) {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      onQuit();
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header version={state.serverVersion} tick={state.currentTick} />

      <Box flexDirection="row">
        <Box flexDirection="column" width="60%">
          <StatusPanel state={state} strategy={strategy} adapterName={adapterName} />
          <ActionPanel action={currentAction} thinking={thinking} />
        </Box>
        <Box flexDirection="column" width="40%" marginLeft={1}>
          <NearbyPanel nearby={state.nearby} />
          <LogPanel logs={logs} />
        </Box>
      </Box>

      <Footer />
      <FooterBar />
    </Box>
  );
}

export type { LogEntry };
export default App;
