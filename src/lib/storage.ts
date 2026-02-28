import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { HistoryEntry } from '../types/history';

const MAX_HISTORY = 100;

export async function getSettings(): Promise<UserSettings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(result.settings as Partial<UserSettings>) };
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...settings } });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get('history');
  return (result.history as HistoryEntry[]) || [];
}

export async function addToHistory(
  entry: Omit<HistoryEntry, 'id' | 'used'>
): Promise<void> {
  const history = await getHistory();
  history.unshift({
    ...entry,
    id: crypto.randomUUID(),
    used: false,
  });
  await chrome.storage.local.set({ history: history.slice(0, MAX_HISTORY) });
}

export async function markHistoryUsed(id: string): Promise<void> {
  const history = await getHistory();
  const entry = history.find((h) => h.id === id);
  if (entry) {
    entry.used = true;
    await chrome.storage.local.set({ history });
  }
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ history: [] });
}
