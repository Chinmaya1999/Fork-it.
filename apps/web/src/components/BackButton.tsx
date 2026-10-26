import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const ROOTS = new Set(['/', '/dashboard', '/admin']);

/** Goes to the previous page (or `fallback` when the page was opened directly). Hidden on top-level landing pages. */
export function BackButton({ fallback = '/', className = '' }: { fallback?: string; className?: string }) {
  const nav = useNavigate(); const { pathname, key } = useLocation();
  if (ROOTS.has(pathname)) return null;
  return (
    <button type="button" onClick={() => (key !== 'default' ? nav(-1) : nav(fallback))} className={`mono mb-4 inline-flex items-center gap-1.5 rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-muted transition hover:border-brand hover:text-ink ${className}`} aria-label="Go back">
      <ArrowLeft className="size-3.5" />back
    </button>
  );
}
