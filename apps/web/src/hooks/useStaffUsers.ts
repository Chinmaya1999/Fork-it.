import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
export const useStaffUsers = () => useQuery({ queryKey: ['staff-users'], queryFn: () => api.get<{ items: { _id: string; name: string; role: string }[] }>('/staff/staff-users'), staleTime: 300_000 });
