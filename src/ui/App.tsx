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
  currentAction: GameAction | null;
  thinking: boolean;
  logs: LogEntry[];
  notebook: Notebook;
  onQuit: () => void;
}

type TabView = 'log' | 'notebook';

// Orange/amber color for borders
const BORDER_COLOR = 'yellow';
const HEADER_COLOR = 'cyan';
const ACCENT_COLOR = 'yellow';

function progressBar(current: number, max: number, width: number = 20): string {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return '[' + '|'.repeat(filled) + '-'.repeat(empty) + ']';
}

const Header = memo(function Header({
  state,
  adapterName,
  width,
}: {
  state: ClientState;
  adapterName: string;
  width: number;
}) {
  const { player, connected } = state;
  const connStatus = connected ? 'CONNECTED' : 'DISCONNECTED';

  const title = ' SpaceMolt: The Crustacean Cosmos - AI Client ';
  const titlePadding = Math.max(0, Math.floor((width - title.length - 8) / 2));
  const titleLine = '╔' + '═'.repeat(titlePadding) + title + '═'.repeat(titlePadding) + '╗';

  return (
    <Box flexDirection="column" width={width}>
      <Text color={ACCENT_COLOR} bold wrap="truncate-end">{titleLine}</Text>
      <Box>
        <Text color={ACCENT_COLOR}>║ </Text>
        <Text color={HEADER_COLOR}>PILOT: </Text>
        <Text color="white">{player?.username || '???'}</Text>
        <Text color="gray"> | </Text>
        <Text color={HEADER_COLOR}>EMPIRE: </Text>
        <Text color="white">{player?.empire || '???'}</Text>
        <Text color="gray"> | </Text>
        <Text color={HEADER_COLOR}>CR$: </Text>
        <Text color={ACCENT_COLOR}>{player?.credits?.toLocaleString() || '0'}</Text>
        <Text color="gray"> | </Text>
        <Text color={HEADER_COLOR}>LOC: </Text>
        <Text color="white">{state.system?.name || player?.current_system || '???'}</Text>
        <Text color="gray"> | </Text>
        <Text color={HEADER_COLOR}>TICK: </Text>
        <Text color="white">{state.currentTick}</Text>
        <Text color="gray"> | </Text>
        <Text color={connected ? 'green' : 'red'}>{connStatus}</Text>
        <Text color="gray"> ({adapterName})</Text>
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
      <Box flexDirection="column" borderStyle="single" borderColor={BORDER_COLOR} paddingX={1}>
        <Text color={HEADER_COLOR} bold>{'═ SHIP STATUS ═'}</Text>
        <Text color={ACCENT_COLOR}>
          <Spinner type="dots" /> {!state.connected ? 'Connecting...' : 'Authenticating...'}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={inCombat ? 'red' : BORDER_COLOR} paddingX={1}>
      <Text color={HEADER_COLOR} bold>{'═ SHIP STATUS ═'}</Text>

      {/* ASCII Ship Art */}
      <Box marginY={1} flexDirection="column">
        <Text color={ACCENT_COLOR}>    /\</Text>
        <Text color={ACCENT_COLOR}>   /  \</Text>
        <Text color={ACCENT_COLOR}>  |    |</Text>
        <Text color={ACCENT_COLOR}>  | {inCombat ? <Text color="red">!!</Text> : 'AI'} |</Text>
        <Text color={ACCENT_COLOR}> /|    |\</Text>
        <Text color={ACCENT_COLOR}>/_|____|_\</Text>
      </Box>

      <Text color="white" wrap="truncate-end">
        HULL:   {progressBar(ship.hull, ship.max_hull, 12)} {Math.round((ship.hull / ship.max_hull) * 100)}%
      </Text>
      <Text color="blue" wrap="truncate-end">
        SHIELD: {progressBar(ship.shield, ship.max_shield, 12)} {Math.round((ship.shield / ship.max_shield) * 100)}%
      </Text>
      <Text color={ACCENT_COLOR} wrap="truncate-end">
        FUEL:   {progressBar(ship.fuel, ship.max_fuel, 12)} {Math.round((ship.fuel / ship.max_fuel) * 100)}%
      </Text>
      <Text color="gray" wrap="truncate-end">
        CARGO:  {ship.cargo_used}/{ship.cargo_capacity}
      </Text>

      {poi && (
        <Box marginTop={1}>
          <Text color="gray">@ </Text>
          <Text color="white" wrap="truncate-end">{poi.name}</Text>
          {player.docked_at_base && <Text color="cyan"> [DOCKED]</Text>}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={HEADER_COLOR} bold>{'═ CURRENT ACTION ═'}</Text>
        {thinking ? (
          <Text color={ACCENT_COLOR}>
            <Spinner type="dots" /> Thinking...
          </Text>
        ) : action ? (
          <>
            <Text color="green" wrap="truncate-end">{'>'} {action.command} {action.args?.join(' ')}</Text>
            {action.reasoning && <Text color="gray" wrap="truncate-end">{action.reasoning}</Text>}
          </>
        ) : (
          <Text color="gray">Waiting for next tick...</Text>
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
      case 'action': return 'green';
      case 'event': return 'cyan';
      case 'chat': return 'yellow';
      case 'error': return 'red';
      case 'system': return 'magenta';
      default: return 'white';
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
        borderColor={BORDER_COLOR}
        paddingX={1}
        height={height}
        overflow="hidden"
      >
        <Text color={HEADER_COLOR} bold>{'═ PILOT NOTEBOOK ═'}</Text>
        {!hasContent ? (
          <Text color="gray">No notes yet...</Text>
        ) : (
          <>
            {notebook.disposition && (
              <>
                <Text color={ACCENT_COLOR} bold>DISPOSITION:</Text>
                <Text color="white" wrap="truncate-end">{notebook.disposition}</Text>
              </>
            )}
            {notebook.goals.length > 0 && (
              <>
                <Text color={ACCENT_COLOR} bold>GOALS:</Text>
                {notebook.goals.slice(0, 5).map((goal, i) => (
                  <Text key={i} color="white" wrap="truncate-end">  {i + 1}. {goal}</Text>
                ))}
              </>
            )}
            {notebook.notes && (
              <>
                <Text color={ACCENT_COLOR} bold>NOTES:</Text>
                <Text color="gray" wrap="truncate-end">{notebook.notes}</Text>
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
      borderColor={BORDER_COLOR}
      paddingX={1}
      height={height}
      overflow="hidden"
    >
      <Text color={HEADER_COLOR} bold>{'═ LOG & COMMS ═'}</Text>
      {visibleLogs.length === 0 ? (
        <Text color="gray">No events yet...</Text>
      ) : (
        visibleLogs.map((log, i) => (
          <Text key={i} wrap="truncate-end">
            <Text color={getColor(log.type)}>{getPrefix(log.type)} </Text>
            <Text color="white">{log.message}</Text>
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
    <Box flexDirection="column" borderStyle="single" borderColor={BORDER_COLOR} paddingX={1}>
      <Text color={HEADER_COLOR} bold>{'═ CONTACTS & INFO ═'}</Text>

      <Text color={ACCENT_COLOR} bold>NEARBY PILOTS:</Text>
      {players.length === 0 ? (
        <Text color="gray">  No contacts in range</Text>
      ) : (
        <>
          {players.slice(0, 5).map((p, i) => (
            <Text key={i} wrap="truncate-end">
              <Text color="white">  {i + 1}. </Text>
              <Text color={p.in_combat ? 'red' : 'cyan'}>
                {p.anonymous ? '[ANON]' : p.username || '???'}
              </Text>
              {p.clan_tag && <Text color={ACCENT_COLOR}> [{p.clan_tag}]</Text>}
              {p.in_combat && <Text color="red"> *COMBAT*</Text>}
            </Text>
          ))}
          {players.length > 5 && <Text color="gray">  +{players.length - 5} more</Text>}
        </>
      )}

      {system && (
        <Box marginTop={1} flexDirection="column">
          <Text color={ACCENT_COLOR} bold>SYSTEM INFO:</Text>
          <Text color="white" wrap="truncate-end">  {system.name}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color={ACCENT_COLOR} bold>AI STRATEGY:</Text>
        <Text color="gray" wrap="truncate-end">  {strategy.slice(0, 40)}{strategy.length > 40 ? '...' : ''}</Text>
      </Box>
    </Box>
  );
});

const Footer = memo(function Footer({ activeTab, width }: { activeTab: TabView; width: number }) {
  const controls = '[Q]uit [1]Log [2]Notebook';
  const padding = Math.max(0, width - controls.length - 6);

  return (
    <Box width={width}>
      <Text color={ACCENT_COLOR}>╚═ </Text>
      <Text color="gray">[Q]uit </Text>
      <Text color={activeTab === 'log' ? HEADER_COLOR : 'gray'}>[1]Log </Text>
      <Text color={activeTab === 'notebook' ? HEADER_COLOR : 'gray'}>[2]Notebook</Text>
      <Text color={ACCENT_COLOR}>{' ' + '═'.repeat(padding) + '╝'}</Text>
    </Box>
  );
});

export const App = memo(function App({
  state,
  strategy,
  adapterName,
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
  const availableHeight = terminalHeight - 5; // Header + footer + margins
  const mainPanelHeight = Math.max(10, availableHeight);

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <Header state={state} adapterName={adapterName} width={terminalWidth} />

      <Box flexDirection="row">
        {/* Left: Ship Status - fixed width */}
        <Box width={30}>
          <ShipStatusPanel state={state} thinking={thinking} action={currentAction} />
        </Box>

        {/* Center: Log & Comms - flex to fill */}
        <Box flexGrow={1}>
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
