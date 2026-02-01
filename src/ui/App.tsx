import React, { memo, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import type { ClientState } from '../client';
import type { GameAction } from '../types';
import type { Notebook } from '../storage';

interface LogEntry {
  timestamp: Date;
  type: 'action' | 'event' | 'chat' | 'error' | 'system';
  message: string;
}

interface AppProps {
  state: ClientState;
  strategy: string;
  adapterName: string;
  modelName?: string;
  currentAction: GameAction | null;
  thinking: boolean;
  logs: LogEntry[];
  notebook: Notebook;
  onQuit: () => void;
}

type TabView = 'log' | 'notebook';

// Cypherpunk neon color palette
const colors = {
  accent: '#00ff9f',      // Neon green
  accentAlt: '#00ffff',   // Cyan
  warning: '#ff9f00',     // Orange
  danger: '#ff0040',      // Red-magenta
  muted: '#6e7681',       // Gray
  bright: '#c5c8c6',      // Light gray
  border: '#2d333b',      // Dark gray border
  player: '#00ffff',      // Cyan for player name
  credits: '#ffff00',     // Yellow for credits
  system: '#bf00ff',      // Magenta for system messages
  action: '#00ff9f',      // Green for actions
  event: '#00bfff',       // Cyan for events
  chat: '#ffff00',        // Yellow for chat
  error: '#ff0040',       // Red for errors
};

function progressBar(current: number, max: number, width: number = 12): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return '[' + '|'.repeat(filled) + '-'.repeat(empty) + ']';
}

const Header = memo(function Header({
  state,
  adapterName,
  modelName,
  width,
}: {
  state: ClientState;
  adapterName: string;
  modelName?: string;
  width: number;
}) {
  const { player, connected } = state;
  const connStatus = connected ? 'CONNECTED' : 'DISCONNECTED';
  const aiLabel = modelName ? `${adapterName}/${modelName}` : adapterName;

  const title = ' SpaceMolt: The Crustacean Cosmos - AI Client ';
  const innerWidth = width - 2;
  const padTotal = Math.max(0, innerWidth - title.length);
  const padLeft = Math.floor(padTotal / 2);
  const padRight = padTotal - padLeft;
  const titleLine = '╔' + '═'.repeat(padLeft) + title + '═'.repeat(padRight) + '╗';

  return (
    <Box flexDirection="column" width={width}>
      <Text color={colors.accent} bold>{titleLine}</Text>
      <Box>
        <Text color={colors.accent}>║ </Text>
        <Text color={colors.muted}>PILOT: </Text>
        <Text color={colors.player} bold>{player?.username || '???'}</Text>
        <Text color={colors.muted}> | EMPIRE: </Text>
        <Text color={colors.bright}>{player?.empire || '???'}</Text>
        <Text color={colors.muted}> | CR$: </Text>
        <Text color={colors.credits} bold>{player?.credits?.toLocaleString() || '0'}</Text>
        <Text color={colors.muted}> | LOC: </Text>
        <Text color={colors.bright}>{state.system?.name || player?.current_system || '???'}</Text>
        <Text color={colors.muted}> | TICK: </Text>
        <Text color={colors.bright}>{state.currentTick}</Text>
        <Text color={colors.muted}> | </Text>
        <Text color={connected ? colors.accent : colors.danger}>{connStatus}</Text>
        <Text color={colors.muted}> ({aiLabel})</Text>
      </Box>
    </Box>
  );
});

const ShipStatusPanel = memo(function ShipStatusPanel({
  state,
  thinking,
  action,
}: {
  state: ClientState;
  thinking: boolean;
  action: GameAction | null;
}) {
  const { player, ship, poi, inCombat } = state;

  if (!player || !ship) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1} height="100%">
        <Text color={colors.accent} bold>═ SHIP STATUS ═</Text>
        <Text color={colors.warning}>
          <Spinner type="dots" /> {!state.connected ? 'Connecting...' : 'Authenticating...'}
        </Text>
      </Box>
    );
  }

  const hullPct = ship.hull / ship.max_hull;
  const shieldPct = ship.shield / ship.max_shield;
  const fuelPct = ship.fuel / ship.max_fuel;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={inCombat ? colors.danger : colors.border} paddingX={1} height="100%">
      <Text color={colors.accent} bold>═ SHIP STATUS ═</Text>

      <Box marginY={1} flexDirection="column">
        <Text color={colors.accent}>    /\</Text>
        <Text color={colors.accent}>   /  \</Text>
        <Text color={colors.accent}>  |    |</Text>
        <Text color={inCombat ? colors.danger : colors.accent}>  | {inCombat ? '!!' : 'AI'} |</Text>
        <Text color={colors.accent}> /|    |\</Text>
        <Text color={colors.accent}>/_|____|_\</Text>
      </Box>

      <Text color={hullPct < 0.3 ? colors.danger : colors.bright} wrap="truncate-end">
        HULL:   {progressBar(ship.hull, ship.max_hull)} {Math.round(hullPct * 100)}%
      </Text>
      <Text color={colors.accentAlt} wrap="truncate-end">
        SHIELD: {progressBar(ship.shield, ship.max_shield)} {Math.round(shieldPct * 100)}%
      </Text>
      <Text color={fuelPct < 0.2 ? colors.danger : colors.warning} wrap="truncate-end">
        FUEL:   {progressBar(ship.fuel, ship.max_fuel)} {Math.round(fuelPct * 100)}%
      </Text>
      <Text color={colors.muted} wrap="truncate-end">
        CARGO:  {ship.cargo_used}/{ship.cargo_capacity}
      </Text>

      {poi && (
        <Box marginTop={1}>
          <Text color={colors.muted}>@ </Text>
          <Text color={colors.bright} wrap="truncate-end">{poi.name}</Text>
          {player.docked_at_base && <Text color={colors.accentAlt}> [DOCKED]</Text>}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.accent} bold>═ CURRENT ACTION ═</Text>
        {thinking ? (
          <Text color={colors.warning}>
            <Spinner type="dots" /> Thinking...
          </Text>
        ) : action ? (
          <>
            <Text color={colors.action} wrap="truncate-end">{'>'} {action.command} {action.args?.join(' ')}</Text>
            {action.reasoning && <Text color={colors.muted} wrap="truncate-end">{action.reasoning}</Text>}
          </>
        ) : (
          <Text color={colors.muted}>Waiting for tick...</Text>
        )}
      </Box>
    </Box>
  );
});

const LogPanel = memo(function LogPanel({ logs, height, activeTab, notebook }: {
  logs: LogEntry[];
  height: number;
  activeTab: TabView;
  notebook: Notebook;
}) {
  const visibleLogs = useMemo(() => {
    const maxLogs = Math.max(1, height - 4);
    return logs.slice(-maxLogs);
  }, [logs, height]);

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'action': return colors.action;
      case 'event': return colors.event;
      case 'chat': return colors.chat;
      case 'error': return colors.danger;
      case 'system': return colors.system;
      default: return colors.bright;
    }
  };

  const getPrefix = (type: LogEntry['type']) => {
    switch (type) {
      case 'action': return '> You:';
      case 'event': return '> SYSTEM:';
      case 'chat': return '> [Chat]';
      case 'error': return '> ERROR:';
      case 'system': return '> SERVER:';
      default: return '>';
    }
  };

  if (activeTab === 'notebook') {
    const hasContent = notebook.disposition || notebook.goals.length > 0 || notebook.notes;
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={colors.border}
        paddingX={1}
        height={height}
        flexGrow={1}
        overflow="hidden"
      >
        <Text color={colors.accent} bold>═ PILOT NOTEBOOK ═</Text>
        {!hasContent ? (
          <Text color={colors.muted}>No notes yet...</Text>
        ) : (
          <>
            {notebook.disposition && (
              <>
                <Text color={colors.warning} bold>DISPOSITION:</Text>
                <Text color={colors.bright} wrap="truncate-end">{notebook.disposition}</Text>
              </>
            )}
            {notebook.goals.length > 0 && (
              <>
                <Text color={colors.warning} bold>GOALS:</Text>
                {notebook.goals.slice(0, 5).map((goal, i) => (
                  <Text key={i} color={colors.bright} wrap="truncate-end">  {i + 1}. {goal}</Text>
                ))}
              </>
            )}
            {notebook.notes && (
              <>
                <Text color={colors.warning} bold>NOTES:</Text>
                <Text color={colors.muted} wrap="truncate-end">{notebook.notes}</Text>
              </>
            )}
          </>
        )}
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      height={height}
      flexGrow={1}
      overflow="hidden"
    >
      <Text color={colors.accent} bold>═ LOG & COMMS ═</Text>
      {visibleLogs.length === 0 ? (
        <Text color={colors.muted}>No events yet...</Text>
      ) : (
        visibleLogs.map((log, i) => (
          <Text key={i} wrap="truncate-end">
            <Text color={getColor(log.type)}>{getPrefix(log.type)} </Text>
            <Text color={colors.bright}>{log.message}</Text>
          </Text>
        ))
      )}
    </Box>
  );
});

const InfoPanel = memo(function InfoPanel({
  state,
  strategy,
}: {
  state: ClientState;
  strategy: string;
}) {
  const { nearby, system } = state;
  const players = nearby || [];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={colors.border} paddingX={1} height="100%">
      <Text color={colors.accent} bold>═ CONTACTS & INFO ═</Text>

      <Text color={colors.warning} bold>NEARBY PILOTS:</Text>
      {players.length === 0 ? (
        <Text color={colors.muted}>  No contacts in range</Text>
      ) : (
        <>
          {players.slice(0, 5).map((p, i) => (
            <Text key={i} wrap="truncate-end">
              <Text color={colors.muted}>  {i + 1}. </Text>
              <Text color={p.in_combat ? colors.danger : colors.accentAlt}>
                {p.anonymous ? '[ANON]' : p.username || '???'}
              </Text>
              {p.clan_tag && <Text color={colors.warning}> [{p.clan_tag}]</Text>}
              {p.in_combat && <Text color={colors.danger}> *</Text>}
            </Text>
          ))}
          {players.length > 5 && <Text color={colors.muted}>  +{players.length - 5} more</Text>}
        </>
      )}

      {system && (
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.warning} bold>SYSTEM:</Text>
          <Text color={colors.bright} wrap="truncate-end">  {system.name}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={colors.warning} bold>AI STRATEGY:</Text>
        <Text color={colors.muted} wrap="truncate-end">  {strategy.slice(0, 25)}{strategy.length > 25 ? '...' : ''}</Text>
      </Box>
    </Box>
  );
});

const Footer = memo(function Footer({ activeTab, width }: { activeTab: TabView; width: number }) {
  const controls = '[Q]uit [1]Log [2]Notebook';
  const innerWidth = width - 2;
  const padding = Math.max(0, innerWidth - controls.length - 4);

  return (
    <Box width={width}>
      <Text color={colors.accent}>╚═ </Text>
      <Text color={colors.muted}>[Q]uit </Text>
      <Text color={activeTab === 'log' ? colors.accent : colors.muted}>[1]Log </Text>
      <Text color={activeTab === 'notebook' ? colors.accent : colors.muted}>[2]Notebook</Text>
      <Text color={colors.accent}> {'═'.repeat(padding)}╝</Text>
    </Box>
  );
});

export const App = memo(function App({
  state,
  strategy,
  adapterName,
  modelName,
  currentAction,
  thinking,
  logs,
  notebook,
  onQuit,
}: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [activeTab, setActiveTab] = useState<TabView>('log');

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      onQuit();
      exit();
    }
    if (input === '1') setActiveTab('log');
    if (input === '2') setActiveTab('notebook');
  });

  const terminalWidth = stdout?.columns ?? 80;
  const terminalHeight = stdout?.rows ?? 24;
  const availableHeight = terminalHeight - 4;
  const mainPanelHeight = Math.max(10, availableHeight);

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <Header state={state} adapterName={adapterName} modelName={modelName} width={terminalWidth} />

      <Box flexDirection="row" height={mainPanelHeight}>
        {/* Left: Ship Status - fixed width */}
        <Box width={30}>
          <ShipStatusPanel state={state} thinking={thinking} action={currentAction} />
        </Box>

        {/* Center: Log & Comms - flex to fill */}
        <Box flexGrow={1} flexDirection="column">
          <LogPanel logs={logs} height={mainPanelHeight} activeTab={activeTab} notebook={notebook} />
        </Box>

        {/* Right: Info Panel - fixed width */}
        <Box width={28}>
          <InfoPanel state={state} strategy={strategy} />
        </Box>
      </Box>

      <Footer activeTab={activeTab} width={terminalWidth} />
    </Box>
  );
});

export type { LogEntry };
export default App;
