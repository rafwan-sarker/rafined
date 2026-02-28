import React from 'react';

interface EnhanceButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

export function EnhanceButton({ onClick, disabled, loading }: EnhanceButtonProps) {
  return (
    <button
      className={`rafined-enhance-btn ${loading ? 'loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      title="Enhance your prompt with AI"
    >
      <span className="icon">{loading ? '\u27F3' : '\u2726'}</span>
      <span>{loading ? 'Enhancing...' : 'Enhance'}</span>
    </button>
  );
}
