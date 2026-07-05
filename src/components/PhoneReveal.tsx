'use client';

import { useEffect, useState } from 'react';
import { usePhoneReveal } from '@/components/PhoneRevealContext';

function maskPhone(): string {
  return '****';
}

interface PhoneRevealProps {
  phone: string;
  editable?: boolean;
  onSave?: (phone: string) => void;
}

function EyeButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="phone-reveal-btn"
      onClick={onClick}
      aria-label={visible ? 'Hide phone number' : 'Show phone number'}
      title={visible ? 'Hide' : 'Show'}
    >
      {visible ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

export function PhoneReveal({ phone, editable, onSave }: PhoneRevealProps) {
  const { showAll } = usePhoneReveal();
  const [localVisible, setLocalVisible] = useState(false);
  const [value, setValue] = useState(phone);
  const visible = showAll || localVisible;

  useEffect(() => {
    setValue(phone);
  }, [phone]);

  function commitEdit() {
    if (value !== phone) onSave?.(value);
  }

  if (editable) {
    return (
      <span className="phone-reveal">
        {visible ? (
          <input
            className="inline-input phone-reveal-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
        ) : (
          <span className="phone-reveal-value">{maskPhone()}</span>
        )}
        <EyeButton visible={visible} onClick={() => setLocalVisible((v) => !v)} />
      </span>
    );
  }

  return (
    <span className="phone-reveal">
      <span className="phone-reveal-value">{visible ? phone : maskPhone()}</span>
      <EyeButton visible={visible} onClick={() => setLocalVisible((v) => !v)} />
    </span>
  );
}
