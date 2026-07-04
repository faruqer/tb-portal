'use client';

import { useState } from 'react';

function maskPhone(phone: string): string {
  return '****';
}

interface PhoneRevealProps {
  phone: string;
}

export function PhoneReveal({ phone }: PhoneRevealProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="phone-reveal">
      <span className="phone-reveal-value">{visible ? phone : maskPhone(phone)}</span>
      <button
        type="button"
        className="phone-reveal-btn"
        onClick={() => setVisible((v) => !v)}
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
    </span>
  );
}
