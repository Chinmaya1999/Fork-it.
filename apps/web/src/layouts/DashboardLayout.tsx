import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { NavLink, Navigate, Outlet, useNavigate, Link } from 'react-router-dom';
import { Bell, Bookmark, Compass, FileText, LayoutDashboard, LifeBuoy, LogOut, Menu, MessagesSquare, Moon, Package, Search, Settings, Sun, Terminal, User as UserIcon, Wrench, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';
import { CommandPalette, openPalette } from '@/components/CommandPalette';
import { NotificationBell } from '@/components/NotificationBell';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

type Item = { to: string; label: string; icon: typeof Bell; end?: boolean };
const groups: { title: string; items: Item[] }[] = [
  { title: 'Discover', items: [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/dashboard/projects', label: 'Browse projects', icon: Compass }, { to: '/dashboard/saved', label: 'Saved projects', icon: Bookmark }] },
  { title: 'My work', items: [{ to: '/dashboard/orders', label: 'My orders', icon: Package }, { to: '/dashboard/custom', label: 'Custom requests', icon: Wrench }, { to: '/dashboard/support', label: 'Support tickets', icon: LifeBuoy }, { to: '/dashboard/messages', label: 'Messages', icon: MessagesSquare }] },
  { title: 'Account', items: [{ to: '/dashboard/notifications', label: 'Notifications', icon: Bell }, { to: '/dashboard/profile', label: 'Profile', icon: UserIcon }, { to: '/dashboard/settings', label: 'Settings', icon: Settings }] },
];

/** Logged-in student shell: no public navbar — everything lives in the sidebar. */
export default function DashboardLayout() {
  const { user, logout } = useAuth(); const { dark, toggle } = useTheme(); const [open, setOpen] = useState(false); const nav = useNavigate();
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => api.get<{ items: { unreadForUser: number }[] }>('/conversations'), refetchInterval: 60000 });
  const unreadChats = convs.data?.items.reduce((n, c) => n + c.unreadForUser, 0) ?? 0;
  if (user && ['admin', 'support'].includes(user.role)) return <Navigate to={user.role === 'admin' ? '/admin' : '/admin/tickets'} replace />; // staff don't use the student dashboard
  const initials = (user?.name ?? '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const Sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/dashboard" className="mono flex items-center gap-2 px-4 py-4 text-[15px] font-bold" onClick={() => setOpen(false)}><span className="grid size-7 place-items-center rounded bg-brand text-onbrand"><Terminal className="size-4" strokeWidth={2.75} /></span>project<span className="-ml-2 text-brand">forge</span></Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        {groups.map((g) => (
          <div key={g.title}><p className="label mb-1.5 px-2">// {g.title.toLowerCase()}</p>
            {g.items.map(({ to, label, icon: I, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => cn('mono flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] transition', isActive ? 'bg-brand/15 text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink')}>
                <I className="size-4 shrink-0" /><span className="truncate">{label}</span>{to === '/dashboard/messages' && unreadChats > 0 && <span className="mono ml-auto rounded-full bg-brand px-1.5 text-[10px] font-bold text-onbrand">{unreadChats}</span>}</NavLink>))}
          </div>))}
        <div><p className="label mb-1.5 px-2">// help</p>
          <Link to="/legal/terms" className="mono flex items-center gap-2.5 rounded px-2.5 py-2 text-[13px] text-muted hover:bg-surface-2 hover:text-ink"><FileText className="size-4" />Terms &amp; policies</Link></div>
      </nav>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 px-1"><span className="mono grid size-9 shrink-0 place-items-center rounded bg-brand/15 text-xs font-bold text-brand">{initials}</span>
          <div className="min-w-0"><p className="truncate text-sm font-medium">{user?.name}</p><p className="mono flex items-center gap-1 truncate text-[11px] text-muted">{user?.emailVerified ? <><ShieldCheck className="size-3 text-brand" />verified</> : 'email not verified'}</p></div></div>
        <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={async () => { await logout(); nav('/'); }}><LogOut className="size-4" />logout</Button>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <a href="#dash-main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-onbrand">Skip to content</a>
      <aside className="sticky top-0 hidden h-screen border-r border-line bg-surface lg:block">{Sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-2xl">{Sidebar}<button aria-label="Close menu" className="absolute right-3 top-4 text-muted" onClick={() => setOpen(false)}><X className="size-5" /></button></aside></div>}
      <div className="min-w-0">
        <header className="holo-glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line px-4 sm:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu className="size-5" /></Button>
          <button type="button" onClick={openPalette} className="mono flex h-9 flex-1 items-center gap-2 rounded border border-line bg-surface px-3 text-left text-xs text-muted hover:border-brand sm:max-w-md" aria-label="Search projects"><Search className="size-3.5" />search projects or run a command…<span className="kbd ml-auto hidden sm:inline">Ctrl K</span></button>
          <div className="ml-auto flex items-center gap-1"><NotificationBell allPath="/dashboard/notifications" /><Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button></div>
        </header>
        <main id="dash-main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><BackButton fallback="/dashboard" /><Outlet /></main>
      </div>
      <CommandPalette toggleTheme={toggle} />
    </div>
  );
}
