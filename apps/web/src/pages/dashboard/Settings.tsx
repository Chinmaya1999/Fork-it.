import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Moon, Sun } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useTheme } from '@/hooks/useTheme';
import { Button, Card, Field, Input } from '@/components/ui';
import { VerifyEmailCard } from '@/components/VerifyEmailCard';

export default function Settings() {
  const { dark, toggle } = useTheme(); const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const f = useForm({ defaultValues: { current: '', password: '' } });
  return (
    <div className="max-w-2xl space-y-6"><div><p className="label">// account</p><h1 className="display text-3xl">Settings</h1></div>
      <VerifyEmailCard />
      <Card className="flex items-center justify-between p-5"><div><p className="font-semibold">Appearance</p><p className="text-sm text-muted">{dark ? 'Dark' : 'Light'} theme</p></div><Button variant="secondary" size="sm" onClick={toggle}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}Switch</Button></Card>
      <Card className="p-6"><h2 className="font-semibold">Change password</h2>
        {msg && <p role="status" className={`mt-3 rounded p-3 text-sm ${msg.ok ? 'bg-brand/10 text-[color:var(--brand-text)]' : 'bg-red-500/10 text-red-500'}`}>{msg.text}</p>}
        <form className="mt-4 space-y-4" onSubmit={f.handleSubmit(async (v) => { try { await api.post('/auth/change-password', v); f.reset(); setMsg({ ok: true, text: 'Password changed. Other devices were signed out.' }); } catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); } })}>
          <Field label="Current password"><Input type="password" autoComplete="current-password" required {...f.register('current')} /></Field>
          <Field label="New password (min 10 characters)"><Input type="password" autoComplete="new-password" required minLength={10} {...f.register('password')} /></Field>
          <Button disabled={f.formState.isSubmitting}>Update password</Button></form></Card>
    </div>
  );
}
