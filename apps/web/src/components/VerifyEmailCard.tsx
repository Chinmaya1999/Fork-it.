import { useState } from 'react';
import { MailCheck, MailWarning } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card } from '@/components/ui';

/** Email verification status + resend. In dev with no SMTP configured the API returns a one-click link. */
export function VerifyEmailCard() {
  const { user } = useAuth(); const [state, setState] = useState<{ busy?: boolean; msg?: string; devLink?: string; err?: string }>({});
  if (!user) return null;
  if (user.emailVerified) return <Card className="flex items-center gap-3 p-4 text-sm"><MailCheck className="size-5 text-brand" /><span><strong>Email verified.</strong> <span className="text-muted">{user.email}</span></span></Card>;
  const send = async () => {
    setState({ busy: true });
    try { const r = await api.post<{ emailed?: boolean; devLink?: string; alreadyVerified?: boolean }>('/auth/resend-verification'); setState({ msg: r.emailed ? `Verification email sent to ${user.email}. Check your inbox (and spam).` : 'Email delivery is not configured on this server.', devLink: r.devLink }); }
    catch (e) { setState({ err: (e as ApiError).message }); }
  };
  return (
    <Card className="space-y-3 border-amber-500/40 p-4 text-sm">
      <div className="flex gap-3"><MailWarning className="mt-0.5 size-5 shrink-0 text-amber-500" /><div><p className="font-semibold">Verify your email</p><p className="text-muted">Confirm <span className="mono">{user.email}</span> to unlock purchases and support.</p></div></div>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" onClick={send} disabled={state.busy}>{state.busy ? 'Sending…' : 'Send verification email'}</Button>
        {state.devLink && <a href={state.devLink} className="mono text-xs text-brand underline">Dev mode: no email server — click to verify now</a>}</div>
      {state.msg && <p role="status" className="text-muted">{state.msg}</p>}{state.err && <p role="alert" className="text-red-500">{state.err}</p>}
    </Card>
  );
}
