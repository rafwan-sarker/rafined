import { useState, useEffect } from 'react';
import { HistoryEntry } from '../types/history';
import { getHistory, clearHistory as clearStorageHistory } from '../lib/storage';

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const h = await getHistory();
    setHistory(h);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const clearAll = async () => {
    await clearStorageHistory();
    setHistory([]);
  };

  return { history, loading, refresh, clearAll };
}
