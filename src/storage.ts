import { existsSync } from 'fs';

const CREDENTIALS_FILE = '.spacemolt-credentials.json';
const PLAY_STYLE_FILE = '.spacemolt-playstyle';
const JOURNAL_FILE = 'spacemolt-journal.md';
const NOTES_FILE = 'spacemolt-notes.md';
const MAP_FILE = 'spacemolt-map.md';

export interface Credentials {
  username: string;
  token: string;
  empire: string;
  playStyle: string;
}

export interface StoredData {
  credentials: Credentials | null;
  journal: string;
  notes: string;
  map: string;
}

const VALID_EMPIRES = ['solarian', 'voidborn', 'crimson', 'nebula', 'outerrim'] as const;

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const file = Bun.file(CREDENTIALS_FILE);
    if (await file.exists()) {
      const data = (await file.json()) as Record<string, unknown>;
      const empire = typeof data.empire === 'string' && VALID_EMPIRES.includes(data.empire as (typeof VALID_EMPIRES)[number])
        ? data.empire
        : 'outerrim';
      return {
        username: typeof data.username === 'string' ? data.username : '',
        token: typeof data.token === 'string' ? data.token : '',
        empire,
        playStyle: typeof data.playStyle === 'string' ? data.playStyle : '',
      } as Credentials;
    }
  } catch (err) {
    console.error('[SpaceMolt] Failed to load credentials:', err);
  }
  return null;
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  // Never overwrite an existing token with empty — e.g. registerNewPlayer must not wipe a valid token
  if (!credentials.token.trim()) {
    try {
      const existing = await loadCredentials();
      if (existing?.token?.trim()) {
        credentials = { ...credentials, token: existing.token };
      }
    } catch {
      // ignore
    }
  }
  await Bun.write(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
}

/** Save play style as soon as user enters it (before registration or other async work). */
export async function savePlayStyle(playStyle: string): Promise<void> {
  if (!playStyle.trim()) return;
  await Bun.write(PLAY_STYLE_FILE, playStyle.trim());
}

export async function loadPlayStyle(): Promise<string | null> {
  try {
    const file = Bun.file(PLAY_STYLE_FILE);
    if (await file.exists()) {
      const text = await file.text();
      return text.trim() || null;
    }
  } catch {
    // No play style saved
  }
  return null;
}

export async function loadJournal(): Promise<string> {
  try {
    const file = Bun.file(JOURNAL_FILE);
    if (await file.exists()) {
      return await file.text();
    }
  } catch {
    // No journal
  }
  return '';
}

export async function appendJournal(entry: string): Promise<void> {
  const existing = await loadJournal();
  const timestamp = new Date().toISOString();
  const newEntry = `\n## ${timestamp}\n\n${entry}\n`;
  await Bun.write(JOURNAL_FILE, existing + newEntry);
}

export async function loadNotes(): Promise<string> {
  try {
    const file = Bun.file(NOTES_FILE);
    if (await file.exists()) {
      return await file.text();
    }
  } catch {
    // No notes
  }
  return '';
}

export async function saveNotes(notes: string): Promise<void> {
  await Bun.write(NOTES_FILE, notes);
}

export async function loadMap(): Promise<string> {
  try {
    const file = Bun.file(MAP_FILE);
    if (await file.exists()) {
      return await file.text();
    }
  } catch {
    // No map
  }
  return '';
}

export async function saveMap(map: string): Promise<void> {
  await Bun.write(MAP_FILE, map);
}

export async function loadAllData(): Promise<StoredData> {
  const [credentials, journal, notes, map] = await Promise.all([
    loadCredentials(),
    loadJournal(),
    loadNotes(),
    loadMap(),
  ]);
  return { credentials, journal, notes, map };
}
