import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export type PanelKey = 'bochile' | 'marketing';

interface PanelCtx {
  panel: PanelKey;
  setPanel: (p: PanelKey) => void;
}

const Ctx = createContext<PanelCtx | null>(null);
const STORAGE_KEY = 'bochile_active_panel';

function readInitial(): PanelKey {
  if (typeof window === 'undefined') return 'bochile';
  const fromUrl = window.location.pathname.startsWith('/marketing') ? 'marketing' : null;
  if (fromUrl) return fromUrl;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'marketing' || stored === 'bochile') return stored;
  return 'bochile';
}

export function PanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanelState] = useState<PanelKey>(readInitial);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, panel); } catch {}
  }, [panel]);

  const setPanel = useCallback((p: PanelKey) => setPanelState(p), []);
  const value = useMemo(() => ({ panel, setPanel }), [panel, setPanel]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePanel(): PanelCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePanel must be used inside <PanelProvider>');
  return v;
}
