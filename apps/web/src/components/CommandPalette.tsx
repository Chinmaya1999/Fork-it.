import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { Paged, ProjectCardData } from '@/lib/types';
import { useDebounced } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';

interface Item { id: string; label: string; hint: string; run: () => void }
export const openPalette = () => window.dispatchEvent(new Event('pf:palette'));

/** Ctrl/Cmd+K (or "/") launcher: navigate, toggle theme, and live-search the catalog. */
export function CommandPalette({ toggleTheme }: { toggleTheme: () => void }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [idx, setIdx] = useState(0);
  const { user } = useAuth(); const student = user?.role === 'student'; const P = student ? '/dashboard/projects' : '/projects';
  const nav = useNavigate(); const input = useRef<HTMLInputElement>(null); const dq = useDebounced(q.trim(), 200);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement; const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) { e.preventDefault(); setOpen(true); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey); window.addEventListener('pf:palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pf:palette', onOpen); };
  }, []);
  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);

  const results = useQuery({ queryKey: ['palette', dq], enabled: open && dq.length >= 2, queryFn: () => api.get<Paged<ProjectCardData>>(`/projects?limit=6&q=${encodeURIComponent(dq)}`) });
  const go = (to: string) => () => { setOpen(false); nav(to); };
  const items = useMemo<Item[]>(() => {
    const cmds: Item[] = [
      { id: 'c-projects', label: 'cd /projects', hint: 'Browse all projects', run: go(P) },
      { id: 'c-free', label: 'ls --free', hint: 'Free projects', run: go(`${P}?pricing=free`) },
      { id: 'c-custom', label: 'sudo build --custom', hint: 'Request a custom project', run: go('/custom') },
      { id: 'c-how', label: 'man projectforge', hint: 'How it works', run: go('/how-it-works') },
      ...(user && ['admin', 'support'].includes(user.role) ? [{ id: 'c-orders', label: 'cd /admin/orders', hint: 'Orders & payments', run: go('/admin/orders') }, { id: 'c-custom', label: 'cd /admin/custom', hint: 'Custom requests', run: go('/admin/custom') }, { id: 'c-tickets', label: 'cd /admin/tickets', hint: 'Support tickets', run: go('/admin/tickets') }, { id: 'c-msgs', label: 'cd /admin/messages', hint: 'Messages', run: go('/admin/messages') }] : []),
      ...(user ? [{ id: 'c-dash', label: 'cd ~', hint: 'Dashboard', run: go(user.role === 'admin' ? '/admin' : '/dashboard') }] : [{ id: 'c-login', label: 'ssh login', hint: 'Log in', run: go('/login') }]),
      { id: 'c-theme', label: 'toggle --theme', hint: 'Switch dark / light', run: () => { toggleTheme(); setOpen(false); } },
    ].filter((c) => !q || `${c.label} ${c.hint}`.toLowerCase().includes(q.toLowerCase()));
    const projects: Item[] = (results.data?.items ?? []).map((p) => ({ id: p._id, label: p.title, hint: `${p.language ?? p.technologies[0] ?? ''} · ${p.isFree ? 'free' : 'paid'}`, run: go(`${P}/${p.slug}`) }));
    return [...projects, ...cmds];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, results.data]);

  if (!open) return null;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); items[idx]?.run(); }
  };
  return (
    <div className="fixed inset-0 z-[70] grid place-items-start bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="sheet mx-auto w-full max-w-xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 text-muted" aria-hidden /><span className="mono text-brand">$</span>
          <input ref={input} autoFocus data-bare value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKeyDown} role="combobox" aria-expanded aria-controls="pal-list" aria-activedescendant={items[idx] ? `pal-${items[idx].id}` : undefined}
            placeholder="search projects or run a command…" className="mono h-12 flex-1 bg-transparent text-sm outline-none focus-visible:outline-none placeholder:text-muted/60" />
          <span className="kbd">esc</span>
        </div>
        <ul id="pal-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.isFetching && <li className="label px-3 py-2">searching…</li>}
          {items.length === 0 && !results.isFetching && <li className="label px-3 py-6 text-center">command not found: {q}</li>}
          {items.map((it, i) => (
            <li key={it.id} id={`pal-${it.id}`} role="option" aria-selected={i === idx}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={it.run} className={cn('flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm', i === idx ? 'bg-brand/15 text-brand' : '')}>
                <span className="mono truncate">{it.label}</span><span className="label shrink-0">{it.hint}</span>
              </button>
            </li>))}
        </ul>
        <div className="flex items-center gap-3 border-t border-line px-3 py-2"><span className="label flex items-center gap-1"><span className="kbd">↑↓</span> move</span><span className="label flex items-center gap-1"><span className="kbd"><CornerDownLeft className="inline size-3" /></span> run</span></div>
      </div>
    </div>
  );
}
