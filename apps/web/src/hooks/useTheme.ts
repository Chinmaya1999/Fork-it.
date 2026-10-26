import { useEffect, useState } from 'react';
export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('pf-theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
