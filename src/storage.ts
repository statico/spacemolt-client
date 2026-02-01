import { existsSync } from 'fs';

const CREDENTIALS_FILE = '.spacemolt-credentials.json';
const JOURNAL_FILE = 'spacemolt-journal.md';
const NOTES_FILE = 'spacemolt-notes.md';
const MAP_FILE = 'spacemolt-map.md';

export interface Credentials {
  username: string;
  token: string;
  empire: string;
}

export interface StoredData {
  credentials: Credentials | null;
  journal: string;
  notes: string;
  map: string;
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const file = Bun.file(CREDENTIALS_FILE);
    if (await file.exists()) {
      return await file.json();
    }
  } catch {
    // No credentials saved
  }
  return null;
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await Bun.write(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
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
