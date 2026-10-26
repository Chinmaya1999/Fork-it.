import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderKanban, LayoutDashboard, LifeBuoy, LogOut, Menu, MessagesSquare, Moon, Receipt, ScrollText, Search, ShieldCheck, Sun, Tags, Terminal, Users, Wrench, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/lib/api';
import { Button, Skeleton } from '@/components/ui';
import { NotificationBell } from '@/components/NotificationBell';
import { CommandPalette, openPalette } from '@/components/CommandPalette';
import { cn } from '@/lib/cn';

type Item = { to: string; label: string; icon: typeof Users; end?: boolean; roles: string[] };
const groups: { title: string; items: Item[] }[] = [
  { title: 'Operations', items: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, roles: ['admin'] },
    { to: '/admin/orders', label: 'Orders & payments', icon: Receipt, roles: ['admin'] },
    { to: '/admin/custom', label: 'Custom requests', icon: Wrench, roles: ['admin'] },
    { to: '/admin/tickets', label: 'Support tickets', icon: LifeBuoy, roles: ['admin', 'support'] },
    { to: '/admin/messages', label: 'Messages', icon: MessagesSquare, roles: ['admin', 'support'] }] },
  { title: 'Catalog', items: [
    { to: '/admin/projects', label: 'Projects', icon: FolderKanban, roles: ['admin'] },
    { to: '/admin/categories', label: 'Categories', icon: Tags, roles: ['admin'] }] },
  { title: 'People & security', items: [
    { to: '/admin/users', label: 'Users & roles', icon: Users, roles: ['admin'] },
    { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['admin'] }] },
];

/** Staff console (admin + support). A separate shell and accent colour from the student dashboard. UI gate only — every API call is enforced server-side. */
export default function AdminLayout() {
  const { user, loading, logout } = useAuth(); const { dark, toggle } = useTheme(); const loc = useLocation(); const nav = useNavigate(); const [open, setOpen] = useState(false);
  const staff = !!user && ['admin', 'support'].includes(user.role);
  const unread = useQuery({ queryKey: ['staff', 'conversations', 'badge'], enabled: staff, queryFn: () => api.get<{ unreadTotal: number }>('/staff/conversations?limit=1'), refetchInterval: 60000 });
  if (loading) return <div className="admin-area mx-auto max-w-5xl p-10"><Skeleton className="h-64" /></div>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!staff) return <Navigate to="/dashboard" replace />; // students never see the console
  if (user.role === 'support' && loc.pathname === '/admin') return <Navigate to="/admin/tickets" replace />;
  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  const Sidebar = (
    <div className="flex h-full flex-col">
      <Link to={user.role === 'admin' ? '/admin' : '/admin/tickets'} onClick={() => setOpen(false)} className="mono flex items-center gap-2 px-4 py-4 text-[15px] font-bold"><span className="grid size-7 place-items-center rounded bg-brand text-onbrand"><Terminal className="size-4" strokeWidth={2.75} /></span>project<span className="-ml-2 text-brand">forge</span></Link>
      <div className="mx-4 mb-3 flex items-center gap-2 rounded border border-brand/40 bg-brand/10 px-2.5 py-1.5"><ShieldCheck className="size-4 text-brand" /><span className="mono text-[11px] font-bold uppercase tracking-wider text-brand">{user.role === 'admin' ? 'Admin console' : 'Support console'}</span></div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin">
        {groups.map((g) => { const items = g.items.filter((i) => i.roles.includes(user.role)); if (!items.length) return null; return (
          <div key={g.title}><p className="label mb-1.5 px-2">// {g.title.toLowerCase()}</p>
            {items.map(({ to, label, icon: I, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => cn('mono flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition', isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                <I className="size-4 shrink-0" /><span className="truncate">{label}</span>{to === '/admin/messages' && (unread.data?.unreadTotal ?? 0) > 0 && <span className="mono ml-auto rounded-full bg-brand px-1.5 text-[10px] font-bold text-onbrand">{unread.data!.unreadTotal}</span>}</NavLink>))}
          </div>); })}
        <div><p className="label mb-1.5 px-2">// site</p><Link to="/" onClick={() => setOpen(false)} className="mono flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"><ArrowLeft className="size-4" />View public site</Link></div>
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1"><span className="mono grid size-9 shrink-0 place-items-center rounded bg-brand/15 text-xs font-bold text-brand">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name}</p><p className="mono truncate text-[11px] text-muted">{user.email}</p></div></div>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={async () => { await logout(); nav('/'); }}><LogOut className="size-4" />logout</Button>
      </div>
    </div>
  );
  return (
    <div className="admin-area min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-onbrand">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{Sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-2xl">{Sidebar}<button aria-label="Close menu" className="absolute right-3 top-4 text-muted" onClick={() => setOpen(false)}><X className="size-5" /></button></aside></div>}
      <div className="min-w-0">
        <div className="admin-stripe" aria-hidden />
        <header className="holo-glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 sm:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="size-5" /></Button>
          <span className="mono hidden rounded bg-brand px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-onbrand sm:inline">{user.role}</span>
          <button type="button" onClick={openPalette} className="mono flex h-9 flex-1 items-center gap-2 rounded border border-line bg-surface px-3 text-left text-xs text-muted hover:border-brand sm:max-w-md" aria-label="Open command palette"><Search className="size-3.5" />jump to a page or search…<span className="kbd ml-auto hidden sm:inline">Ctrl K</span></button>
          <div className="ml-auto flex items-center gap-1"><NotificationBell allPath="/admin/notifications" /><Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button></div>
        </header>
        <main id="admin-main" className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><BackButton fallback="/admin" /><Outlet /></main>
      </div>
      <CommandPalette toggleTheme={toggle} />
    </div>
  );
}
