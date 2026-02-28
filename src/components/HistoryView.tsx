import React from 'react';
import { useHistory } from '../hooks/useHistory';
import { HistoryItem } from './HistoryItem';

export function HistoryView() {
  const { history, loading, clearAll } = useHistory();

  if (loading) return <div className="popup-content">Loading...</div>;

  if (history.length === 0) {
    return (
      <div className="popup-content">
        <div className="history-empty">
          No enhanced prompts yet. Start enhancing!
        </div>
      </div>
    );
  }

  return (
    <div className="popup-content">
      {history.map((entry) => (
        <HistoryItem key={entry.id} entry={entry} />
      ))}
      <button className="history-clear" onClick={clearAll}>
        Clear History
      </button>
    </div>
  );
}
