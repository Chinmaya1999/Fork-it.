import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';
import { dt } from '@/lib/format';
import { useRealtime } from '@/hooks/useRealtime';
import { Button } from './ui';

interface N { _id: string; title: string; body?: string; link?: string; readAt?: string; createdAt: string }
export function NotificationBell({ allPath }: { allPath: string }) {
  useRealtime();
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null); const nav = useNavigate(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'bell'], queryFn: () => api.get<{ items: N[]; unreadCount: number }>('/notifications'), refetchInterval: 60_000 });
  const read = useMutation({ mutationFn: (id: string) => api.post(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  useEffect(() => { const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); document.addEventListener('mousedown', h); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); }; }, []);
  const n = q.data?.unreadCount ?? 0;
  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="sm" aria-label={`Notifications${n ? `, ${n} unread` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="relative"><Bell className="size-4" />{n > 0 && <span className="mono absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-onbrand">{n > 9 ? '9+' : n}</span>}</Button>
      {open && (
        <div className="sheet absolute right-0 z-50 mt-2 w-80 overflow-hidden shadow-2xl" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-line px-3 py-2"><span className="label">// notifications</span>{n > 0 && <button className="mono text-xs text-brand hover:underline" onClick={() => readAll.mutate()}>mark all read</button>}</div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {q.data?.items.length === 0 && <li className="p-6 text-center text-sm text-muted">You’re all caught up.</li>}
            {q.data?.items.slice(0, 8).map((x) => (
              <li key={x._id}><button type="button" onClick={() => { if (!x.readAt) read.mutate(x._id); setOpen(false); if (x.link) nav(x.link); }} className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-surface-2">
                {!x.readAt && <i className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-label="unread" />}<span className="min-w-0"><span className="block truncate text-sm font-medium">{x.title}</span>{x.body && <span className="block truncate text-xs text-muted">{x.body}</span>}<span className="label">{dt(x.createdAt)}</span></span></button></li>))}
          </ul>
          <Link to={allPath} onClick={() => setOpen(false)} className="mono block border-t border-line px-3 py-2 text-center text-xs text-brand hover:bg-surface-2">view all</Link>
        </div>)}
    </div>
  );
}
