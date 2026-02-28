import React, { useState } from 'react';
import { HistoryEntry } from '../types/history';

interface HistoryItemProps {
  entry: HistoryEntry;
}

export function HistoryItem({ entry }: HistoryItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.enhancedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const timeAgo = getTimeAgo(entry.timestamp);

  return (
    <div className="history-item">
      <div className="history-item-header">
        <div className="history-item-meta">
          <span className="history-item-site">{entry.targetModel}</span>
          <span>{timeAgo}</span>
        </div>
        <button className="history-item-copy" onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="history-item-original">{entry.originalPrompt}</div>
      <div className="history-item-enhanced">{entry.enhancedPrompt}</div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
