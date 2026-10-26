import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProjectCardData } from '@/lib/types';
import { useAuth } from './useAuth';

interface Data { ids: string[]; items: ProjectCardData[] }
export function useBookmarks() {
  const { user } = useAuth(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ['bookmarks'], enabled: !!user, queryFn: () => api.get<Data>('/me/bookmarks') });
  const toggle = useMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => saved ? api.delete(`/me/bookmarks/${id}`) : api.put(`/me/bookmarks/${id}`),
    onMutate: async ({ id, saved }) => { // optimistic
      await qc.cancelQueries({ queryKey: ['bookmarks'] }); const prev = qc.getQueryData<Data>(['bookmarks']);
      if (prev) qc.setQueryData<Data>(['bookmarks'], { ...prev, ids: saved ? prev.ids.filter((x) => x !== id) : [...prev.ids, id] });
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['bookmarks'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['bookmarks'] }),
  });
  return { enabled: !!user, ids: new Set(q.data?.ids ?? []), items: q.data?.items ?? [], loading: q.isLoading, toggle: (id: string) => toggle.mutate({ id, saved: (q.data?.ids ?? []).includes(id) }) };
}
/** Project links stay inside the dashboard for logged-in students. */
export const useProjectsBase = () => (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard') ? '/dashboard/projects' : '/projects');
