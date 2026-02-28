import { useState, useEffect } from 'react';
import { UserSettings, DEFAULT_SETTINGS } from '../types/settings';
import { getSettings, saveSettings } from '../lib/storage';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    await saveSettings(updates);
  };

  return { settings, updateSettings, loading };
}
