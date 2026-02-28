import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { UserSettings } from '../types/settings';

const TONES: { value: UserSettings['tone']; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'technical', label: 'Technical' },
];

export function SettingsForm() {
  const { settings, updateSettings, loading } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  if (loading) return <div className="popup-content">Loading...</div>;

  const handleSave = async (updates: Partial<UserSettings>) => {
    await updateSettings(updates);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="popup-content">
      {/* API Key */}
      <div className="form-group">
        <label className="form-label">
          API Key
          <span className="form-sublabel">(Anthropic)</span>
        </label>
        <div className="api-key-wrapper">
          <input
            type={showKey ? 'text' : 'password'}
            className="form-input"
            value={settings.apiKey}
            onChange={(e) => handleSave({ apiKey: e.target.value })}
            placeholder="sk-ant-..."
          />
          <button
            className="api-key-toggle"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Tone */}
      <div className="form-group">
        <label className="form-label">Tone</label>
        <div className="radio-group">
          {TONES.map((t) => (
            <div
              key={t.value}
              className={`radio-option ${settings.tone === t.value ? 'selected' : ''}`}
              onClick={() => handleSave({ tone: t.value })}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="form-group">
        <label className="form-label">Defaults</label>
        <div className="toggle-row">
          <span className="toggle-label">Add output format</span>
          <button
            className={`toggle-switch ${settings.addOutputFormat ? 'active' : ''}`}
            onClick={() => handleSave({ addOutputFormat: !settings.addOutputFormat })}
          />
        </div>
        <div className="toggle-row">
          <span className="toggle-label">Keep concise</span>
          <button
            className={`toggle-switch ${settings.keepConcise ? 'active' : ''}`}
            onClick={() => handleSave({ keepConcise: !settings.keepConcise })}
          />
        </div>
      </div>

      {saved && (
        <div className="status-message status-success">Settings saved</div>
      )}
    </div>
  );
}
