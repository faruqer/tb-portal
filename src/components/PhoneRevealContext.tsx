'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PhoneRevealContextValue {
  showAll: boolean;
  setShowAll: (value: boolean) => void;
}

const PhoneRevealContext = createContext<PhoneRevealContextValue>({
  showAll: false,
  setShowAll: () => {},
});

export function PhoneRevealProvider({ children }: { children: ReactNode }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <PhoneRevealContext.Provider value={{ showAll, setShowAll }}>
      {children}
    </PhoneRevealContext.Provider>
  );
}

export function usePhoneReveal() {
  return useContext(PhoneRevealContext);
}

export function ShowAllNumbersButton() {
  const { showAll, setShowAll } = usePhoneReveal();
  return (
    <button type="button" className="btn-secondary btn-sm" onClick={() => setShowAll(!showAll)}>
      {showAll ? 'Hide all numbers' : 'Show all numbers'}
    </button>
  );
}
