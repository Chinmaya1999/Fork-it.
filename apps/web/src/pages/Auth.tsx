import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '@/lib/types';
import { DEGREE_LEVELS, loginSchema, registerSchema } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Field, Input } from '@/components/ui';

function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return <div className="mx-auto max-w-md px-4 py-14"><h1 className="text-2xl font-bold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted">{sub}</p><Card className="mt-6 p-6">{children}</Card></div>;
}
const Err = ({ msg }: { msg?: string }) => msg ? <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{msg}</p> : null;

export function Login() {
  const { refresh } = useAuth(); const qc = useQueryClient(); const nav = useNavigate(); const [sp] = useSearchParams(); const [err, setErr] = useState<string>();
  const f = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <Shell title="Welcome back" sub="Log in to your dashboard.">
      <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setErr(undefined); try { const r = await api.post<{ user: User & { role: string } }>('/auth/login', v); qc.setQueryData(['me'], { user: r.user }); void refresh(); nav(sp.get('next') ?? (['admin', 'support'].includes(r.user.role) ? '/admin' : '/dashboard')); } catch (e) { setErr((e as ApiError).message); } })}>
        <Err msg={err} />
        <Field label="Email" error={f.formState.errors.email?.message as string}><Input type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password" error={f.formState.errors.password?.message as string}><Input type="password" autoComplete="current-password" {...f.register('password')} /></Field>
        <Button className="w-full" disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? 'Logging in…' : 'Log in'}</Button>
        <p className="text-center text-sm text-muted"><Link to="/forgot-password" className="text-brand">Forgot password?</Link> · <Link to="/register" className="text-brand">Create account</Link></p>
      </form>
    </Shell>
  );
}

export function Register() {
  const { refresh } = useAuth(); const qc = useQueryClient(); const nav = useNavigate(); const [err, setErr] = useState<string>();
  const f = useForm({ resolver: zodResolver(registerSchema) });
  const e = f.formState.errors;
  return (
    <Shell title="Create your account" sub="Free to join. Verify your email to purchase projects.">
      <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { setErr(undefined); try { const r = await api.post<{ user: User }>('/auth/register', v); qc.setQueryData(['me'], { user: r.user }); void refresh(); nav('/dashboard'); } catch (x) { setErr((x as ApiError).message); } })}>
        <Err msg={err} />
        <Field label="Full name" error={e.name?.message as string}><Input autoComplete="name" {...f.register('name')} /></Field>
        <Field label="Email" error={e.email?.message as string}><Input type="email" autoComplete="email" {...f.register('email')} /></Field>
        <Field label="Password (min 10 characters)" error={e.password?.message as string}><Input type="password" autoComplete="new-password" {...f.register('password')} /></Field>
        <Field label="Degree (optional)"><select className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm" {...f.register('degree', { setValueAs: (v) => v || undefined })}><option value="">Select…</option>{DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="College (optional)"><Input {...f.register('college')} /></Field>
        <Button className="w-full" disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? 'Creating…' : 'Create account'}</Button>
        <p className="text-center text-sm text-muted">Already registered? <Link to="/login" className="text-brand">Log in</Link></p>
      </form>
    </Shell>
  );
}

export function ForgotPassword() {
  const [done, setDone] = useState(false);
  const f = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email') })) });
  return (
    <Shell title="Reset your password" sub="We’ll email you a reset link if the account exists.">
      {done ? <p className="text-sm">If an account exists for that email, a reset link is on its way.</p> :
        <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { await api.post('/auth/forgot-password', v); setDone(true); })}>
          <Field label="Email" error={f.formState.errors.email?.message as string}><Input type="email" {...f.register('email')} /></Field>
          <Button className="w-full" disabled={f.formState.isSubmitting}>Send reset link</Button></form>}
    </Shell>
  );
}

export function ResetPassword() {
  const [sp] = useSearchParams(); const nav = useNavigate(); const [err, setErr] = useState<string>();
  const f = useForm({ resolver: zodResolver(z.object({ password: z.string().min(10, 'At least 10 characters').max(128) })) });
  return (
    <Shell title="Choose a new password" sub="You’ll be signed out of other devices.">
      <form className="space-y-4" onSubmit={f.handleSubmit(async (v) => { try { await api.post('/auth/reset-password', { token: sp.get('token') ?? '', password: v.password }); nav('/login'); } catch (e) { setErr((e as ApiError).message); } })}>
        <Err msg={err} />
        <Field label="New password" error={f.formState.errors.password?.message as string}><Input type="password" autoComplete="new-password" {...f.register('password')} /></Field>
        <Button className="w-full" disabled={f.formState.isSubmitting}>Update password</Button></form>
    </Shell>
  );
}

export function VerifyEmail() {
  const [sp] = useSearchParams(); const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle');
  return <Shell title="Verify your email" sub="Confirm your address to unlock purchases.">
    {state === 'ok' ? <p className="text-sm">Email verified. <Link to="/dashboard" className="text-brand">Go to dashboard</Link></p>
      : <><Button onClick={async () => { try { await api.post('/auth/verify-email', { token: sp.get('token') ?? '' }); setState('ok'); } catch { setState('bad'); } }}>Verify email</Button>
        {state === 'bad' && <p role="alert" className="mt-3 text-sm text-red-500">This link is invalid or has already been used.</p>}</>}
  </Shell>;
}
