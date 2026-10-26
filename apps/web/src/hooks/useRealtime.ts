import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { closeSocket, getSocket } from '@/lib/socket';

/** Connects while logged in; server pushes invalidate the relevant queries so badges/lists update live. */
export function useRealtime() {
  const { user } = useAuth(); const qc = useQueryClient();
  useEffect(() => {
    if (!user) { closeSocket(); return; }
    const s = getSocket();
    const refresh = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); };
    const inbox = () => { qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['staff', 'conversations'] }); };
    s.on('notification:new', refresh); s.on('inbox:update', inbox);
    return () => { s.off('notification:new', refresh); s.off('inbox:update', inbox); };
  }, [user, qc]);
}
