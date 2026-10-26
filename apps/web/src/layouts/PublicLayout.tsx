import { useState } from 'react';
import { BackButton } from '@/components/BackButton';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Moon, Sun, X, Terminal, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button, LinkButton } from '@/components/ui';
import { CommandPalette, openPalette } from '@/components/CommandPalette';

const links = [['/projects', 'projects'], ['/projects?pricing=free', 'free'], ['/custom', 'custom-build'], ['/how-it-works', 'how-it-works'], ['/faq', 'faq']] as const;

export function Logo() {
  return <Link to="/" className="mono flex items-center gap-2 text-[15px] font-bold"><span className="grid size-7 place-items-center rounded bg-brand text-onbrand"><Terminal className="size-4" strokeWidth={2.75} /></span><span>project<span className="text-brand">forge</span><span className="cursor" /></span></Link>;
}

export default function PublicLayout() {
  const { user, logout, loading } = useAuth(); const { dark, toggle } = useTheme(); const [open, setOpen] = useState(false); const nav = useNavigate(); const loc = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center"><span className="mono text-sm text-muted cursor">loading</span></div>; // avoids flashing the public site at logged-in users
  if (user?.role === 'student' && !/^\/(legal|verify-email|reset-password)/.test(loc.pathname)) {
    const p = loc.pathname; // students live inside /dashboard: map public URLs to their dashboard equivalents
    return <Navigate replace to={p.startsWith('/projects') ? `/dashboard${p}${loc.search}` : '/dashboard'} />;
  }
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-onbrand">Skip to content</a>
      <header className="holo-glass sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4 sm:px-6">
          <Logo />
          <nav className="hidden gap-1 lg:flex" aria-label="Main">
            {links.map(([to, label]) => <NavLink key={to} to={to} className="mono rounded px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-brand"><span className="opacity-50">./</span>{label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={openPalette} className="mono hidden items-center gap-2 rounded border border-line px-2.5 py-1.5 text-xs text-muted hover:border-brand hover:text-ink sm:flex" aria-label="Open command palette"><Search className="size-3.5" />search <span className="kbd">Ctrl K</span></button>
            <Button variant="ghost" size="sm" onClick={toggle} aria-label="Toggle theme">{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
            <div className="hidden items-center gap-1.5 sm:flex">
              {user ? (<><LinkButton to={user.role === 'admin' || user.role === 'support' ? '/admin' : '/dashboard'} variant="secondary" size="sm">{user.role === 'admin' || user.role === 'support' ? '~/admin' : '~/dashboard'}</LinkButton><Button variant="ghost" size="sm" onClick={async () => { await logout(); nav('/'); }}>logout</Button></>)
                : (<><LinkButton to="/login" variant="ghost" size="sm">login</LinkButton><LinkButton to="/register" size="sm">sign_up</LinkButton></>)}
            </div>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">{open ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
          </div>
        </div>
        {open && (
          <div className="border-t border-line px-4 py-3 lg:hidden">
            {links.map(([to, label]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="mono block rounded px-3 py-2.5 text-sm hover:bg-surface-2 hover:text-brand">./{label}</Link>)}
            <div className="mt-2 flex gap-2 sm:hidden">
              {user ? <LinkButton to="/dashboard" onClick={() => setOpen(false)} className="flex-1">~/dashboard</LinkButton> : <>
                <LinkButton to="/login" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>login</LinkButton>
                <LinkButton to="/register" className="flex-1" onClick={() => setOpen(false)}>sign_up</LinkButton></>}
            </div>
          </div>
        )}
      </header>
      <main id="main" className="flex-1"><div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 empty:hidden"><BackButton /></div><Outlet /></main>
      <CommandPalette toggleTheme={toggle} />
      <footer className="mt-24 overflow-hidden border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2"><Logo /><p className="mt-3 max-w-sm text-sm text-muted">Find, run and commission software projects for your degree — and get unstuck when the build breaks.</p>
            <p className="mono mt-4 text-xs text-muted">tip: press <span className="kbd">Ctrl K</span> or <span className="kbd">/</span> to search from anywhere</p></div>
          <div><h4 className="label">// platform</h4><ul className="mono mt-3 space-y-2 text-sm">
            <li><Link to="/projects" className="hover:text-brand">./projects</Link></li><li><Link to="/custom" className="hover:text-brand">./custom-build</Link></li><li><Link to="/faq" className="hover:text-brand">./faq</Link></li></ul></div>
          <div><h4 className="label">// legal</h4><ul className="mono mt-3 space-y-2 text-sm">
            <li><Link to="/legal/terms" className="hover:text-brand">terms</Link></li><li><Link to="/legal/privacy" className="hover:text-brand">privacy</Link></li>
            <li><Link to="/legal/refunds" className="hover:text-brand">refunds</Link></li><li><Link to="/legal/licenses" className="hover:text-brand">licenses</Link></li></ul></div>
        </div>
        <p aria-hidden className="display mt-8 select-none whitespace-nowrap text-center text-[10.5vw] leading-[.9] text-ink/[0.06]">projectforge</p>
        <div className="mono border-t border-line py-4 text-center text-xs text-muted">© {new Date().getFullYear()} CMtech · third-party projects remain the property of their authors</div>
      </footer>
    </div>
  );
}
