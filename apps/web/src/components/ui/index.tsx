import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-brand text-onbrand font-semibold hover:bg-brand-600 shadow-[0_0_22px_-6px_var(--color-brand)]',
  secondary: 'bg-transparent text-ink border border-line hover:border-brand hover:text-brand',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
};
const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-12 px-6 text-base' };
type Look = { variant?: keyof typeof variants; size?: keyof typeof sizes };
const look = ({ variant = 'primary', size = 'md' }: Look, extra?: string) =>
  cn('inline-flex items-center justify-center gap-2 rounded-md font-mono font-medium transition-all disabled:opacity-60 disabled:pointer-events-none', variants[variant], sizes[size], extra);

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & Look>(
  ({ variant, size, className, ...p }, ref) => <button ref={ref} className={look({ variant, size }, className)} {...p} />);
export const LinkButton = ({ variant, size, className, ...p }: LinkProps & Look) => <Link className={look({ variant, size }, className)} {...p} />;

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) =>
  <input ref={ref} className={cn('h-11 w-full rounded-md border border-line bg-surface px-3.5 text-sm placeholder:text-muted/70', className)} {...p} />);

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span role="alert" className="block text-xs text-red-500">{error}</span>}
    </label>
  );
}

const tones = {
  neutral: 'bg-surface-2 text-muted', brand: 'bg-brand/15 text-[color:var(--brand-text)]',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};
export const Badge = ({ tone = 'neutral', children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) =>
  <span className={cn('inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>;

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton', className)} aria-hidden />;
export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
  <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface', className)} {...p} />;

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <Card className="p-10 text-center"><h3 className="font-semibold">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>{action && <div className="mt-4">{action}</div>}</Card>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <Card role="alert" className="border-red-500/30 p-8 text-center"><p className="font-medium">Something went wrong</p><p className="mt-1 text-sm text-muted">{message}</p>{retry && <Button variant="secondary" size="sm" className="mt-4" onClick={retry}>Try again</Button>}</Card>;
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) =>
  <textarea ref={ref} className={cn('mono w-full rounded-md border border-line bg-surface p-3 text-sm placeholder:text-muted/70', className)} {...p} />);
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) =>
  <select ref={ref} className={cn('mono h-11 w-full rounded-md border border-line bg-surface px-3 text-sm', className)} {...p} />);
