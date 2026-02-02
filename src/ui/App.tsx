import React, { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { ClientState } from '../client';
import type { GameAction } from '../types';
import type { Notebook } from '../storage';

/**
 * Custom hook for terminal size that handles resize events.
 * This is critical for stable rendering - without it, layout breaks on resize.
 */
function useTerminalSize(): { width: number; height: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState(() => ({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  }));

  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setSize({
        width: stdout.columns ?? 80,
        height: stdout.rows ?? 24,
      });
    };

    // Listen for terminal resize events
    stdout.on('resize', handleResize);

    // Also update on initial mount in case stdout wasn't ready
    handleResize();

    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}

/**
 * Truncate a string to fit within maxLen, adding ellipsis if needed.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  if (maxLen <= 3) return str.slice(0, maxLen);
  return str.slice(0, maxLen - 2) + '..';
}

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
  onStyleChange?: (style: string) => void;
}

type TabView = 'log' | 'notebook';

// Play style presets
const STYLE_PRESETS = [
  { key: '1', name: 'Balanced', desc: 'Trade, explore, and fight as needed' },
  { key: '2', name: 'Trader', desc: 'Focus on trading and profit' },
  { key: '3', name: 'Explorer', desc: 'Discover new systems and POIs' },
  { key: '4', name: 'Pirate', desc: 'Attack other players for loot' },
  { key: '5', name: 'Miner', desc: 'Mine asteroids for ore and sell' },
  { key: '6', name: 'Pacifist', desc: 'Avoid combat at all costs' },
  { key: 'c', name: 'Custom', desc: 'Enter your own play style' },
];

// Cypherpunk neon color palette
const colors = {
  accent: '#00ff9f',
  accentAlt: '#00ffff',
  warning: '#ff9f00',
  danger: '#ff0040',
  muted: '#6e7681',
  bright: '#c5c8c6',
  border: '#2d333b',
  player: '#00ffff',
  credits: '#ffff00',
  system: '#bf00ff',
  action: '#00ff9f',
  event: '#00bfff',
  chat: '#ffff00',
  error: '#ff0040',
};

function progressBar(current: number, max: number, width: number = 12): string {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
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

  // Build header content with memoized calculations to avoid flicker
  const headerContent = useMemo(() => {
    const innerWidth = Math.max(40, width - 2);

    // Title line
    const title = ' SpaceMolt: The Crustacean Cosmos - AI Client ';
    const padTotal = Math.max(0, innerWidth - title.length);
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    const titleLine = '╔' + '═'.repeat(padLeft) + title + '═'.repeat(padRight) + '╗';

    // Status bar values
    const pilotName = player?.username || (connected ? 'Loading...' : '---');
    const empireName = player?.empire?.toUpperCase() || '---';
    const creditsVal = player?.credits?.toLocaleString() || '0';
    const locName = state.system?.name || player?.current_system || '---';
    const connStatus = connected ? 'CON' : 'DIS';
    const tickNum = state.currentTick.toString();

    // Calculate fixed portion width (labels and separators)
    // "║ PILOT: xxx | EMP: xxx | CR$: xxx | LOC: xxx | T: xxx | STS (ai)"
    const fixedLabels = '║ PILOT:  | EMP:  | CR$:  | LOC:  | T:  |  ()';
    const fixedWidth = fixedLabels.length;

    // Calculate dynamic content width
    const dynamicContentWidth = pilotName.length + empireName.length + creditsVal.length +
                                 locName.length + tickNum.length + connStatus.length;

    // AI label - this is what we truncate to fit
    const fullAiLabel = modelName ? `${adapterName}/${modelName}` : adapterName;
    const usedWidth = fixedWidth + dynamicContentWidth;
    const availableForAi = Math.max(4, innerWidth - usedWidth - 1);
    const aiLabel = truncate(fullAiLabel, availableForAi);

    return {
      titleLine,
      pilotName,
      empireName,
      creditsVal,
      locName,
      tickNum,
      connStatus,
      aiLabel,
    };
  }, [width, player, connected, state.system, state.currentTick, adapterName, modelName]);

  const { titleLine, pilotName, empireName, creditsVal, locName, tickNum, connStatus, aiLabel } = headerContent;

  return (
    <Box flexDirection="column" width={width}>
      <Text color={colors.accent} bold wrap="truncate-end">{titleLine}</Text>
      <Box width={width}>
        <Text wrap="truncate-end">
          <Text color={colors.accent}>║ </Text>
          <Text color={colors.muted}>PILOT:</Text>
          <Text color={colors.player} bold> {pilotName}</Text>
          <Text color={colors.muted}> | EMP:</Text>
          <Text color={colors.bright}> {empireName}</Text>
          <Text color={colors.muted}> | CR$:</Text>
          <Text color={colors.credits} bold> {creditsVal}</Text>
          <Text color={colors.muted}> | LOC:</Text>
          <Text color={colors.bright}> {locName}</Text>
          <Text color={colors.muted}> | T:</Text>
          <Text color={colors.bright}> {tickNum}</Text>
          <Text color={colors.muted}> | </Text>
          <Text color={state.connected ? colors.accent : colors.danger}>{connStatus}</Text>
          <Text color={colors.muted}> ({aiLabel})</Text>
        </Text>
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

  const hullPct = ship.max_hull > 0 ? ship.hull / ship.max_hull : 0;
  const shieldPct = ship.max_shield > 0 ? ship.shield / ship.max_shield : 0;
  const fuelPct = ship.max_fuel > 0 ? ship.fuel / ship.max_fuel : 0;

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

const LogPanel = memo(function LogPanel({ logs, height, activeTab, notebook, isActive, onScrollModeChange }: {
  logs: LogEntry[];
  height: number;
  activeTab: TabView;
  notebook: Notebook;
  isActive: boolean;
  onScrollModeChange?: (scrolling: boolean) => void;
}) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const maxVisible = Math.max(1, height - 4); // Account for border and header

  // Use ref to track previous log length to avoid unnecessary updates
  const prevLogLengthRef = useRef(logs.length);

  // Auto-scroll to bottom when new logs arrive (if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && logs.length > prevLogLengthRef.current) {
      setScrollOffset(Math.max(0, logs.length - maxVisible));
    }
    prevLogLengthRef.current = logs.length;
  }, [logs.length, autoScroll, maxVisible]);

  // Memoize max offset calculation
  const maxOffset = useMemo(() => Math.max(0, logs.length - maxVisible), [logs.length, maxVisible]);
  const halfPage = useMemo(() => Math.floor(maxVisible / 2), [maxVisible]);

  // Handle vim-like keyboard navigation
  useInput((input, key) => {
    if (!isActive || activeTab !== 'log') return;

    // j or down arrow - scroll down one line
    if (input === 'j' || key.downArrow) {
      setAutoScroll(false);
      onScrollModeChange?.(true);
      setScrollOffset(prev => Math.min(maxOffset, prev + 1));
    }
    // k or up arrow - scroll up one line
    else if (input === 'k' || key.upArrow) {
      setAutoScroll(false);
      onScrollModeChange?.(true);
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
    // Ctrl+d - scroll down half page
    else if (key.ctrl && input === 'd') {
      setAutoScroll(false);
      onScrollModeChange?.(true);
      setScrollOffset(prev => Math.min(maxOffset, prev + halfPage));
    }
    // Ctrl+u - scroll up half page
    else if (key.ctrl && input === 'u') {
      setAutoScroll(false);
      onScrollModeChange?.(true);
      setScrollOffset(prev => Math.max(0, prev - halfPage));
    }
    // g - go to top
    else if (input === 'g' && !key.ctrl) {
      setAutoScroll(false);
      onScrollModeChange?.(true);
      setScrollOffset(0);
    }
    // G - go to bottom and re-enable auto-scroll
    else if (input === 'G') {
      setAutoScroll(true);
      onScrollModeChange?.(false);
      setScrollOffset(maxOffset);
    }
    // Escape or q in scroll mode - return to auto-scroll
    else if (key.escape) {
      setAutoScroll(true);
      onScrollModeChange?.(false);
      setScrollOffset(maxOffset);
    }
  }, { isActive: isActive && activeTab === 'log' });

  const visibleLogs = useMemo(() => {
    const start = scrollOffset;
    const end = start + maxVisible;
    return logs.slice(start, end);
  }, [logs, scrollOffset, maxVisible]);

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

  // Scroll indicator (maxOffset already memoized above)
  const scrollPct = maxOffset > 0 ? Math.round((scrollOffset / maxOffset) * 100) : 100;
  const scrollIndicator = !autoScroll ? ` [${scrollPct}%]` : '';

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
                <Text color={colors.bright} wrap="wrap">{notebook.disposition}</Text>
              </>
            )}
            {notebook.goals.length > 0 && (
              <>
                <Text color={colors.warning} bold>GOALS:</Text>
                {notebook.goals.slice(0, 5).map((goal, i) => (
                  <Text key={i} color={colors.bright} wrap="wrap">  {i + 1}. {goal}</Text>
                ))}
              </>
            )}
            {notebook.notes && (
              <>
                <Text color={colors.warning} bold>NOTES:</Text>
                <Text color={colors.muted} wrap="wrap">{notebook.notes}</Text>
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
      borderColor={!autoScroll ? colors.accent : colors.border}
      paddingX={1}
      height={height}
      flexGrow={1}
      overflow="hidden"
    >
      <Text color={colors.accent} bold>═ LOG & COMMS ═{scrollIndicator}</Text>
      {visibleLogs.length === 0 ? (
        <Text color={colors.muted}>No events yet...</Text>
      ) : (
        visibleLogs.map((log, i) => (
          <Text key={scrollOffset + i} wrap="wrap">
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

const StyleSelector = memo(function StyleSelector({
  onSelect,
  onCancel,
}: {
  onSelect: (style: string) => void;
  onCancel: () => void;
}) {
  const [customMode, setCustomMode] = useState(false);
  const [customInput, setCustomInput] = useState('');

  useInput((input, key) => {
    if (customMode) {
      if (key.escape) {
        setCustomMode(false);
        setCustomInput('');
      }
      return;
    }

    if (key.escape || input === 's') {
      onCancel();
      return;
    }

    const preset = STYLE_PRESETS.find(p => p.key === input);
    if (preset) {
      if (preset.key === 'c') {
        setCustomMode(true);
      } else {
        onSelect(preset.name.toLowerCase());
      }
    }
  });

  const handleCustomSubmit = (value: string) => {
    if (value.trim()) {
      onSelect(value.trim());
    }
    setCustomMode(false);
    setCustomInput('');
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors.accent}
      paddingX={2}
      paddingY={1}
    >
      <Text color={colors.accent} bold>═ SELECT PLAY STYLE ═</Text>
      <Text color={colors.muted}>Press a key to select, [S] or [Esc] to cancel</Text>
      <Box marginTop={1} flexDirection="column">
        {STYLE_PRESETS.map(preset => (
          <Box key={preset.key}>
            <Text color={colors.warning}>[{preset.key.toUpperCase()}] </Text>
            <Text color={colors.bright}>{preset.name}</Text>
            <Text color={colors.muted}> - {preset.desc}</Text>
          </Box>
        ))}
      </Box>
      {customMode && (
        <Box marginTop={1}>
          <Text color={colors.accent}>{'>'} </Text>
          <TextInput
            value={customInput}
            onChange={setCustomInput}
            onSubmit={handleCustomSubmit}
            placeholder="Enter your play style..."
          />
        </Box>
      )}
    </Box>
  );
});

const Footer = memo(function Footer({ activeTab, width, isScrolling }: { activeTab: TabView; width: number; isScrolling: boolean }) {
  // Memoize footer content to prevent flicker on rapid updates
  const footerContent = useMemo(() => {
    const normalControls = '[Q]uit [1]Log [2]Notebook [S]tyle [j/k]Scroll';
    const scrollControls = 'SCROLL: [j/k]Line [Ctrl+d/u]Page [g/G]Top/Bot [Esc]Exit';
    const controls = isScrolling ? scrollControls : normalControls;
    const innerWidth = Math.max(20, width - 2);
    const padding = Math.max(0, innerWidth - controls.length - 4);

    return { controls, padding };
  }, [width, isScrolling]);

  const { padding } = footerContent;

  if (isScrolling) {
    return (
      <Box width={width}>
        <Text wrap="truncate-end">
          <Text color={colors.accent}>╚═ </Text>
          <Text color={colors.warning}>SCROLL: [j/k]Line [Ctrl+d/u]Page [g/G]Top/Bot [Esc]Exit</Text>
          <Text color={colors.accent}> {'═'.repeat(padding)}╝</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box width={width}>
      <Text wrap="truncate-end">
        <Text color={colors.accent}>╚═ </Text>
        <Text color={colors.muted}>[Q]uit </Text>
        <Text color={activeTab === 'log' ? colors.accent : colors.muted}>[1]Log </Text>
        <Text color={activeTab === 'notebook' ? colors.accent : colors.muted}>[2]Note </Text>
        <Text color={colors.muted}>[S]tyle </Text>
        <Text color={colors.muted}>[j/k]Scroll</Text>
        <Text color={colors.accent}> {'═'.repeat(padding)}╝</Text>
      </Text>
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
  onStyleChange,
}: AppProps) {
  const { exit } = useApp();
  const { width: terminalWidth, height: terminalHeight } = useTerminalSize();
  const [activeTab, setActiveTab] = useState<TabView>('log');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  // Memoize scroll mode change handler for stable reference
  const handleScrollModeChange = useCallback((scrolling: boolean) => {
    setIsScrolling(scrolling);
  }, []);

  useInput((input, key) => {
    if (showStyleSelector) return;
    // Don't handle q/1/2/s when scrolling (except let scroll keys through)
    if (isScrolling && !['j', 'k', 'g', 'G'].includes(input) && !key.downArrow && !key.upArrow && !(key.ctrl && (input === 'd' || input === 'u')) && !key.escape) {
      return;
    }

    if (input === 'q' || (key.ctrl && input === 'c')) {
      onQuit();
      exit();
    }
    if (input === '1') setActiveTab('log');
    if (input === '2') setActiveTab('notebook');
    if (input === 's' && !isScrolling) setShowStyleSelector(true);
  });

  const handleStyleSelect = useCallback((style: string) => {
    setShowStyleSelector(false);
    onStyleChange?.(style);
  }, [onStyleChange]);

  const handleStyleCancel = useCallback(() => {
    setShowStyleSelector(false);
  }, []);

  // Calculate layout dimensions with memoization for stability
  const layout = useMemo(() => {
    const headerHeight = 2; // Title + status line
    const footerHeight = 1;
    const borderOverhead = 1; // Approximate border space
    const availableHeight = terminalHeight - headerHeight - footerHeight - borderOverhead;
    const mainPanelHeight = Math.max(10, availableHeight);

    // Calculate panel widths - ensure they fit within terminal
    const shipPanelWidth = Math.min(32, Math.floor(terminalWidth * 0.3));
    const infoPanelWidth = Math.min(28, Math.floor(terminalWidth * 0.25));

    return {
      mainPanelHeight,
      shipPanelWidth,
      infoPanelWidth,
    };
  }, [terminalWidth, terminalHeight]);

  if (showStyleSelector) {
    return (
      <Box flexDirection="column" width={terminalWidth} height={terminalHeight} justifyContent="center" alignItems="center">
        <StyleSelector
          onSelect={handleStyleSelect}
          onCancel={handleStyleCancel}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={terminalWidth}>
      <Header state={state} adapterName={adapterName} modelName={modelName} width={terminalWidth} />

      <Box flexDirection="row" height={layout.mainPanelHeight}>
        <Box width={layout.shipPanelWidth}>
          <ShipStatusPanel state={state} thinking={thinking} action={currentAction} />
        </Box>

        <Box flexGrow={1} flexDirection="column">
          <LogPanel
            logs={logs}
            height={layout.mainPanelHeight}
            activeTab={activeTab}
            notebook={notebook}
            isActive={!showStyleSelector}
            onScrollModeChange={handleScrollModeChange}
          />
        </Box>

        <Box width={layout.infoPanelWidth}>
          <InfoPanel state={state} strategy={strategy} />
        </Box>
      </Box>

      <Footer activeTab={activeTab} width={terminalWidth} isScrolling={isScrolling} />
    </Box>
  );
});

export type { LogEntry };
export default App;
