import React, { useState } from 'react';
import { SettingsForm } from '../../components/SettingsForm';
import { HistoryView } from '../../components/HistoryView';
import '../../styles/popup.css';

type Tab = 'settings' | 'history';

export default function App() {
  const [tab, setTab] = useState<Tab>('settings');

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="popup-title">RAFined</div>
        <div className="popup-subtitle">AI Prompt Enhancer</div>
      </div>
      <div className="popup-tabs">
        <button
          className={`popup-tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
        <button
          className={`popup-tab ${tab === 'history' ? 'active' : ''}`}
          onClick={() => setTab('history')}
        >
          History
        </button>
      </div>
      {tab === 'settings' ? <SettingsForm /> : <HistoryView />}
    </div>
  );
}
