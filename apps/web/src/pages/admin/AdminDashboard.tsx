import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { Card, ErrorState, LinkButton, Skeleton } from '@/components/ui';
import { formatINR } from '@projectforge/shared';

interface Stats { revenue: { grossCollectedPaise: number; refundedPaise: number; netCollectedPaise: number; paidOrders: number }; ops: { activeCustomProjects: number; pendingQuotations: number; openTickets: number; unreadConversations: number; pendingBalancePaise: number }; users: number; usersByRole: Record<string, number>; projects: { published: number; draft: number; unpublished: number }; freePublished: number; paidPublished: number; verified: number; recent: { _id: string; action: string; actorEmail: string; createdAt: string }[] }

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api.get<Stats>('/admin/stats') });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.error) return <ErrorState message="Could not load stats." retry={() => q.refetch()} />;
  const s = q.data!;
  const tiles: [string, number, string?][] = [['Published projects', s.projects.published, '/admin/projects?status=published'], ['Drafts (need review)', s.projects.draft, '/admin/projects?status=draft'], ['Unpublished', s.projects.unpublished, '/admin/projects?status=unpublished'], ['Free listings', s.freePublished], ['Paid listings', s.paidPublished], ['Verified by team', s.verified], ['Registered users', s.users, '/admin/users']];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="label">// overview</p><h1 className="display text-3xl">Admin dashboard</h1></div><LinkButton to="/admin/projects/new">+ Add project</LinkButton></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([k, v, to]) => { const inner = <Card className="p-4 transition hover:border-brand"><p className="mono text-3xl font-bold text-brand">{v.toLocaleString('en-IN')}</p><p className="label mt-1">{k}</p></Card>; return to ? <Link key={k} to={to}>{inner}</Link> : <div key={k}>{inner}</div>; })}</div>
      <section><h2 className="mb-3 font-semibold">Money <span className="label">// verified payments only</span></h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Gross collected', formatINR(s.revenue.grossCollectedPaise) === 'Free' ? '₹0' : formatINR(s.revenue.grossCollectedPaise), '/admin/orders?status=paid'], ['Refunded', s.revenue.refundedPaise ? formatINR(s.revenue.refundedPaise) : '₹0', '/admin/orders?status=refunded'], ['Net collected', s.revenue.netCollectedPaise ? formatINR(s.revenue.netCollectedPaise) : '₹0'], ['Pending balances (custom)', s.ops.pendingBalancePaise ? formatINR(s.ops.pendingBalancePaise) : '₹0', '/admin/custom']].map(([k, v, to]) => { const inner = <Card className="p-4 transition hover:border-brand"><p className="mono text-2xl font-bold text-brand">{v}</p><p className="label mt-1">{k}</p></Card>; return to ? <Link key={k} to={to}>{inner}</Link> : <div key={k}>{inner}</div>; })}</div>
        <p className="label mt-2">Gross = sum of gateway-verified paid orders (incl. later-refunded). Net = gross − processed refunds. Not profit: gateway fees and taxes are not deducted.</p></section>
      <section><h2 className="mb-3 font-semibold">Work queue</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Pending quotations', s.ops.pendingQuotations, '/admin/custom'], ['Active custom projects', s.ops.activeCustomProjects, '/admin/custom'], ['Open tickets', s.ops.openTickets, '/admin/tickets'], ['Unread conversations', s.ops.unreadConversations, '/admin/messages']].map(([k, v, to]) => <Link key={k as string} to={to as string}><Card className="p-4 transition hover:border-brand"><p className="mono text-3xl font-bold text-brand">{v}</p><p className="label mt-1">{k}</p></Card></Link>)}</div></section>
      <div><h2 className="mb-3 font-semibold">Recent admin activity</h2>
        <Card className="divide-y divide-line">{s.recent.length === 0 && <p className="p-4 text-sm text-muted">No admin actions yet.</p>}{s.recent.map((a) => <div key={a._id} className="mono flex flex-wrap justify-between gap-2 p-3 text-xs"><span className="text-brand">{a.action}</span><span className="text-muted">{a.actorEmail} · {new Date(a.createdAt).toLocaleString()}</span></div>)}</Card></div>
    </div>
  );
}
