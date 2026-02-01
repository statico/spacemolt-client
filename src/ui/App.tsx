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

const Header = memo(function Header({ version, tick }: { version?: string; tick: number }) {
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="magenta" bold>
          {'>>>'} SPACEMOLT {'<<<'}
        </Text>
        <Text color="gray"> | </Text>
        <Text color="cyan">v{version || '???'}</Text>
        <Text color="gray"> | </Text>
        <Text color="yellow">T:{tick}</Text>
      </Box>
    </Box>
  );
});

const StatusPanel = memo(function StatusPanel({
  state,
  strategy,
  adapterName,
}: {
  state: ClientState;
  strategy: string;
  adapterName: string;
}) {
  const { connected, player, ship, system, poi, inCombat } = state;

  if (!player || !ship) {
    const status = !connected ? 'Connecting...' : 'Authenticating...';
    return (
      <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text color="yellow">
          <Spinner type="dots" /> {status}
        </Text>
      </Box>
    );
  }

  const hullPct = ship.hull / ship.max_hull;
  const fuelPct = ship.fuel / ship.max_fuel;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={inCombat ? 'red' : 'green'} paddingX={1}>
      <Box>
        <Text color="green" bold>
          {player.username}
        </Text>
        <Text color="gray"> [{player.empire.toUpperCase().slice(0, 3)}]</Text>
      </Box>
      {inCombat && <Text color="red" bold>!!! COMBAT !!!</Text>}

      <Box marginTop={1} flexDirection="column">
        <Text color="cyan" wrap="truncate-end">LOC: <Text color="white">{system?.name || player.current_system}</Text></Text>
        <Text color="gray" wrap="truncate-end">    {poi?.name || player.current_poi}</Text>
        {player.docked_at_base && <Text color="blue">[DOCKED]</Text>}
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">CR$ {player.credits.toLocaleString()}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color={hullPct < 0.3 ? 'red' : 'green'}>
          HULL {ship.hull}/{ship.max_hull}
        </Text>
        <Text color="blue">
          SHLD {ship.shield}/{ship.max_shield}
        </Text>
        <Text color={fuelPct < 0.2 ? 'red' : 'yellow'}>
          FUEL {ship.fuel}/{ship.max_fuel}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray">CARGO: </Text>
        <Text color="white">{ship.cargo_used}/{ship.cargo_capacity}</Text>
      </Box>
      {ship.cargo.length > 0 && (
        <Text color="gray" wrap="truncate-end">
          [{ship.cargo.map((c) => `${c.item_id}:${c.quantity}`).join(', ')}]
        </Text>
      )}

      <Box marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
        <Text color="magenta">AI: <Text color="white">{adapterName}</Text></Text>
      </Box>
      <Text color="gray" wrap="truncate-end">
        {strategy.slice(0, 30)}{strategy.length > 30 ? '...' : ''}
      </Text>
    </Box>
  );
});

const NearbyPanel = memo(function NearbyPanel({ nearby, maxVisible }: { nearby: ClientState['nearby']; maxVisible: number }) {
  const players = nearby || [];

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan" bold>
        CONTACTS [{players.length}]
      </Text>
      {players.length === 0 ? (
        <Text color="gray">No contacts in range</Text>
      ) : (
        <>
          {players.slice(0, maxVisible).map((p, i) => (
            <Text key={i} wrap="truncate-end">
              <Text color={p.in_combat ? 'red' : 'white'}>
                {p.anonymous ? '[ANON]' : p.username || '???'}
              </Text>
              {p.clan_tag && <Text color="yellow"> [{p.clan_tag}]</Text>}
              {p.faction_tag && <Text color="blue"> &lt;{p.faction_tag}&gt;</Text>}
              {p.in_combat && <Text color="red"> *</Text>}
            </Text>
          ))}
          {players.length > maxVisible && (
            <Text color="gray">+{players.length - maxVisible} more</Text>
          )}
        </>
      )}
    </Box>
  );
});

const ActionPanel = memo(function ActionPanel({ action, thinking }: { action: GameAction | null; thinking: boolean }) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="magenta" paddingX={1}>
      <Text color="magenta" bold>
        ACTION
      </Text>
      {thinking ? (
        <Text color="yellow">
          <Spinner type="dots" /> Thinking...
        </Text>
      ) : action ? (
        <Box flexDirection="column">
          <Text color="green" wrap="truncate-end">
            {'>'} {action.command} {action.args?.join(' ')}
          </Text>
          {action.reasoning && (
            <Text color="gray" wrap="truncate-end">{action.reasoning}</Text>
          )}
        </Box>
      ) : (
        <Text color="gray">Waiting...</Text>
      )}
    </Box>
  );
});

const LogPanel = memo(function LogPanel({ logs, height }: { logs: LogEntry[]; height: number }) {
  const visibleLogs = useMemo(() => {
    const maxLogs = Math.max(1, height - 2);
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

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      height={height}
      overflow="hidden"
    >
      <Text color="gray" bold>
        EVENT LOG [{logs.length}]
      </Text>
      {visibleLogs.length === 0 ? (
        <Text color="gray">No events yet...</Text>
      ) : (
        visibleLogs.map((log, i) => (
          <Text key={i} wrap="truncate-end">
            <Text color="gray">[{log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}] </Text>
            <Text color={getColor(log.type)}>{log.message}</Text>
          </Text>
        ))
      )}
    </Box>
  );
});

const NotebookPanel = memo(function NotebookPanel({ notebook, height }: { notebook: Notebook; height: number }) {
  const hasContent = notebook.disposition || notebook.goals.length > 0 || notebook.notes;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="yellow"
      paddingX={1}
      height={height}
      overflow="hidden"
    >
      <Text color="yellow" bold>
        PILOT NOTEBOOK
      </Text>
      {!hasContent ? (
        <Text color="gray">No notes yet...</Text>
      ) : (
        <>
          {notebook.disposition && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="cyan" bold>DISPOSITION</Text>
              <Text color="white" wrap="truncate-end">{notebook.disposition}</Text>
            </Box>
          )}
          {notebook.goals.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="green" bold>GOALS</Text>
              {notebook.goals.slice(0, 5).map((goal, i) => (
                <Text key={i} color="white" wrap="truncate-end">{'>'} {goal}</Text>
              ))}
              {notebook.goals.length > 5 && (
                <Text color="gray">+{notebook.goals.length - 5} more</Text>
              )}
            </Box>
          )}
          {notebook.notes && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="magenta" bold>NOTES</Text>
              <Text color="gray" wrap="truncate-end">{notebook.notes}</Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
});

const TabBar = memo(function TabBar({ activeTab, onTabChange }: { activeTab: TabView; onTabChange: (tab: TabView) => void }) {
  return (
    <Box>
      <Text color={activeTab === 'log' ? 'cyan' : 'gray'} bold={activeTab === 'log'}>
        [1] LOG
      </Text>
      <Text color="gray"> | </Text>
      <Text color={activeTab === 'notebook' ? 'yellow' : 'gray'} bold={activeTab === 'notebook'}>
        [2] NOTEBOOK
      </Text>
    </Box>
  );
});

const FooterBar = memo(function FooterBar() {
  return (
    <Box>
      <Text color="gray">[Q]uit [1]Log [2]Notebook</Text>
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

  // Calculate available height, reserving last row
  const terminalHeight = stdout?.rows ?? 24;
  const availableHeight = terminalHeight - 2; // Reserve bottom row + padding

  // Main panel gets most of vertical space
  const mainPanelHeight = Math.max(8, availableHeight - 4);

  // Calculate how many contacts we can show based on remaining sidebar space
  const sidebarUsedHeight = 22; // Approximate height of status + action panels
  const contactsMaxVisible = Math.max(3, Math.floor((availableHeight - sidebarUsedHeight) / 1.5));

  return (
    <Box flexDirection="column" height={availableHeight}>
      <Header version={state.serverVersion} tick={state.currentTick} />
      <Text color="cyan" dimColor>{'─'.repeat(60)}</Text>

      <Box flexDirection="row" flexGrow={1}>
        {/* Left sidebar: 1/3 width */}
        <Box flexDirection="column" width="34%">
          <StatusPanel state={state} strategy={strategy} adapterName={adapterName} />
          <ActionPanel action={currentAction} thinking={thinking} />
          <NearbyPanel nearby={state.nearby} maxVisible={contactsMaxVisible} />
        </Box>

        {/* Right: 2/3 width for main panel */}
        <Box flexDirection="column" width="66%" marginLeft={1}>
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === 'log' ? (
            <LogPanel logs={logs} height={mainPanelHeight} />
          ) : (
            <NotebookPanel notebook={notebook} height={mainPanelHeight} />
          )}
        </Box>
      </Box>

      <Text color="cyan" dimColor>{'─'.repeat(60)}</Text>
      <FooterBar />
    </Box>
  );
});

export type { LogEntry };
export default App;
