import React, { useState, useEffect, useRef, useCallback } from 'react';

interface EnhanceModalProps {
  originalPrompt: string;
  enhancedText: string;
  isStreaming: boolean;
  isDone: boolean;
  error: string | null;
  noApiKey: boolean;
  onUse: (text: string) => void;
  onClose: () => void;
}

export function EnhanceModal({
  originalPrompt,
  enhancedText,
  isStreaming,
  isDone,
  error,
  noApiKey,
  onUse,
  onClose,
}: EnhanceModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const enhancedRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll enhanced text while streaming
  useEffect(() => {
    if (isStreaming && enhancedRef.current) {
      enhancedRef.current.scrollTop = enhancedRef.current.scrollHeight;
    }
  }, [enhancedText, isStreaming]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length
      );
    }
  }, [isEditing]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleEdit = () => {
    setEditText(enhancedText);
    setIsEditing(true);
  };

  const handleUse = () => {
    if (isEditing) {
      onUse(editText);
    } else {
      onUse(enhancedText);
    }
  };

  const renderEnhancedContent = () => {
    if (noApiKey) {
      return (
        <div className="rafined-error">
          Please set your API key in the RAFined extension settings.
          <br />
          Click the RAFined icon in your browser toolbar to open settings.
        </div>
      );
    }

    if (error) {
      return <div className="rafined-error">{error}</div>;
    }

    if (!enhancedText && isStreaming) {
      return (
        <div className="rafined-loading">
          <div className="rafined-spinner" />
          <span>Enhancing your prompt...</span>
        </div>
      );
    }

    if (isEditing) {
      return (
        <textarea
          ref={textareaRef}
          className="rafined-enhanced-textarea"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
        />
      );
    }

    return (
      <div ref={enhancedRef} className="rafined-enhanced">
        {enhancedText}
        {isStreaming && <span className="rafined-cursor" />}
      </div>
    );
  };

  const showActions = isDone && !noApiKey && !error;

  return (
    <div className="rafined-overlay" onClick={handleOverlayClick}>
      <div className="rafined-modal" ref={modalRef}>
        <div className="rafined-modal-header">
          <div className="rafined-modal-title">
            <span className="brand">RAFined</span>
            <span>Enhancement</span>
          </div>
          <button className="rafined-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="rafined-modal-body">
          <div className="rafined-section">
            <div className="rafined-section-label">Original</div>
            <div className="rafined-original">{originalPrompt}</div>
          </div>

          <div className="rafined-section">
            <div className="rafined-section-label">
              {isEditing ? 'Edit Enhanced' : 'Enhanced'}
            </div>
            {renderEnhancedContent()}
          </div>
        </div>

        <div className="rafined-modal-footer">
          {showActions && (
            <>
              <button className="rafined-btn rafined-btn-ghost" onClick={onClose}>
                Keep Original
              </button>
              {!isEditing && (
                <button
                  className="rafined-btn rafined-btn-secondary"
                  onClick={handleEdit}
                >
                  Edit
                </button>
              )}
              <button
                className="rafined-btn rafined-btn-primary"
                onClick={handleUse}
              >
                Use Enhanced
              </button>
            </>
          )}
          {!showActions && (
            <button className="rafined-btn rafined-btn-ghost" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
