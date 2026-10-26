import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Wifi, WifiOff } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { dt } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, Skeleton } from '@/components/ui';

interface Msg { id: string; senderRole: 'student' | 'staff'; senderName?: string; body: string; createdAt: string }
interface Conv { lastReadByUser?: string; lastReadByStaff?: string; title?: string }
const norm = (m: any): Msg => ({ id: String(m.id ?? m._id), senderRole: m.senderRole, senderName: m.senderName ?? m.sender?.name, body: m.body, createdAt: m.createdAt });

/** Persistent history over REST + live delivery, typing and read receipts over Socket.IO. */
export function Chat({ conversationId, selfRole }: { conversationId: string; selfRole: 'student' | 'staff' }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); const [conv, setConv] = useState<Conv>({}); const [loading, setLoading] = useState(true); const [text, setText] = useState('');
  const [err, setErr] = useState<string>(); const [typing, setTyping] = useState<string>(); const [online, setOnline] = useState(getSocket().connected); const [hasMore, setHasMore] = useState(false);
  const end = useRef<HTMLDivElement>(null); const lastTyping = useRef(0); const typingTimer = useRef<number>();
  const other = selfRole === 'student' ? 'staff' : 'student';

  const markRead = useCallback(() => { const s = getSocket(); if (s.connected) s.emit('conversation:read', { conversationId }); else api.post(`/conversations/${conversationId}/read`).catch(() => undefined); }, [conversationId]);

  useEffect(() => { // history
    let live = true; setLoading(true); setMsgs([]);
    api.get<{ items: any[]; hasMore: boolean; conversation: Conv }>(`/conversations/${conversationId}/messages`).then((r) => { if (!live) return; setMsgs(r.items.map(norm)); setHasMore(r.hasMore); setConv(r.conversation); setLoading(false); markRead(); }).catch((e) => { if (live) { setErr((e as ApiError).message); setLoading(false); } });
    return () => { live = false; };
  }, [conversationId, markRead]);

  useEffect(() => { // realtime
    const s = getSocket(); const join = () => { setOnline(true); s.emit('conversation:join', { conversationId }); };
    const onMsg = (m: any) => { if (m.conversationId !== conversationId) return; setMsgs((p) => (p.some((x) => x.id === String(m.id)) ? p : [...p, norm(m)])); setTyping(undefined); if (m.senderRole === other) markRead(); };
    const onTyping = (t: any) => { if (t.conversationId !== conversationId) return; setTyping(t.name); window.clearTimeout(typingTimer.current); typingTimer.current = window.setTimeout(() => setTyping(undefined), 3000); };
    const onRead = (r: any) => { if (r.conversationId === conversationId) setConv((c) => ({ ...c, [r.by === 'staff' ? 'lastReadByStaff' : 'lastReadByUser']: r.at })); };
    const off = () => setOnline(false);
    if (s.connected) join(); s.on('connect', join); s.on('disconnect', off); s.on('message:new', onMsg); s.on('typing', onTyping); s.on('conversation:read', onRead);
    return () => { s.emit('conversation:leave', { conversationId }); s.off('connect', join); s.off('disconnect', off); s.off('message:new', onMsg); s.off('typing', onTyping); s.off('conversation:read', onRead); window.clearTimeout(typingTimer.current); };
  }, [conversationId, other, markRead]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, typing]);

  const loadOlder = async () => { const first = msgs[0]; if (!first) return; const r = await api.get<{ items: any[]; hasMore: boolean }>(`/conversations/${conversationId}/messages?before=${encodeURIComponent(first.createdAt)}`); setMsgs((p) => [...r.items.map(norm), ...p]); setHasMore(r.hasMore); };
  const send = async (e: React.FormEvent) => {
    e.preventDefault(); const body = text.trim(); if (!body) return; setErr(undefined); setText('');
    const s = getSocket();
    if (s.connected) s.emit('message:send', { conversationId, body }, (r: any) => { if (!r?.ok) { setErr(r?.error === 'rate_limited' ? 'You are sending too fast. Slow down a little.' : 'Message could not be sent.'); setText(body); } });
    else try { const r = await api.post<{ message: any }>(`/conversations/${conversationId}/messages`, { body }); setMsgs((p) => [...p, norm(r.message)]); } catch (x) { setErr((x as ApiError).message); setText(body); } // REST fallback while the socket reconnects
  };
  const onInput = (v: string) => { setText(v); const now = Date.now(); if (now - lastTyping.current > 2000 && getSocket().connected) { lastTyping.current = now; getSocket().emit('typing', { conversationId }); } };
  const otherRead = selfRole === 'student' ? conv.lastReadByStaff : conv.lastReadByUser; const lastMine = [...msgs].reverse().find((m) => m.senderRole === selfRole);

  return (
    <div className="sheet flex h-[70vh] min-h-96 flex-col overflow-hidden">
      <div className="term-bar"><i /><i /><i /><span className="label ml-2 truncate">{conv.title ?? 'conversation'}</span><span className="label ml-auto flex items-center gap-1">{online ? <><Wifi className="size-3 text-brand" />live</> : <><WifiOff className="size-3" />reconnecting…</>}</span></div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {loading && <><Skeleton className="h-12 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /></>}
        {hasMore && <button type="button" onClick={loadOlder} className="mono mx-auto block text-xs text-brand hover:underline">load earlier messages</button>}
        {!loading && msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => { const mine = m.senderRole === selfRole; return (
          <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
            <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm', mine ? 'bg-brand text-onbrand' : 'bg-surface-2')}>{m.body}</div>
            <span className="label mt-0.5">{!mine && m.senderName ? `${m.senderName} · ` : ''}{dt(m.createdAt)}{mine && lastMine?.id === m.id && otherRead && new Date(otherRead) >= new Date(m.createdAt) ? ' · seen' : ''}</span>
          </div>); })}
        {typing && <p className="label">{typing} is typing…</p>}<div ref={end} />
      </div>
      {err && <p role="alert" className="border-t border-line bg-red-500/10 px-4 py-2 text-xs text-red-500">{err}</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input value={text} onChange={(e) => onInput(e.target.value)} maxLength={2000} aria-label="Message" placeholder="Type a message…" className="mono h-11 flex-1 rounded-md border border-line bg-surface px-3 text-sm" />
        <Button disabled={!text.trim()} aria-label="Send"><Send className="size-4" /></Button>
      </form>
    </div>
  );
}
