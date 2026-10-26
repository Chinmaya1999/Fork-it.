import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';

interface Ctx { user: User | null; loading: boolean; refresh: () => Promise<unknown>; logout: () => Promise<void> }
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api.get<{ user: User | null }>('/auth/me'), staleTime: 60_000 });
  const logout = async () => {
    try { await api.post('/auth/logout'); }
    finally { // even if the request fails, drop the local session so the UI can't get stuck "logged in"
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' }); // private data (bookmarks, etc.) must not outlive the session
      qc.setQueryData(['me'], { user: null });
    }
  };
  return <AuthCtx.Provider value={{ user: q.data?.user ?? null, loading: q.isLoading, refresh: () => qc.invalidateQueries({ queryKey: ['me'] }), logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
