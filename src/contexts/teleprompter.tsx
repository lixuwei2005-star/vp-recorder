import { createContext, useContext, useEffect, useState } from 'react';

const ENABLED_STORAGE_KEY = 'teleprompter:enabled';

type TeleprompterContextType = {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
};

const TeleprompterContext = createContext<TeleprompterContextType | undefined>(
  undefined,
);

function loadEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ENABLED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export const TeleprompterProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [enabled, setEnabled] = useState<boolean>(loadEnabled);

  useEffect(() => {
    try {
      window.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
      /* quota / disabled — ignore */
    }
  }, [enabled]);

  return (
    <TeleprompterContext.Provider value={{ enabled, setEnabled }}>
      {children}
    </TeleprompterContext.Provider>
  );
};

export const useTeleprompter = (): TeleprompterContextType => {
  const ctx = useContext(TeleprompterContext);
  if (ctx === undefined) {
    throw new Error('useTeleprompter must be used within a TeleprompterProvider');
  }
  return ctx;
};
