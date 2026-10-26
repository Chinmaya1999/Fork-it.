import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle2 } from 'lucide-react';
import { DEGREE_LEVELS } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Field, Input } from '@/components/ui';

export default function Profile() {
  const { user, refresh } = useAuth(); const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const f = useForm({ defaultValues: { name: user?.name ?? '', degree: user?.degree ?? '', college: user?.college ?? '', semester: user?.semester ? String(user.semester) : '' } });
  return (
    <div className="max-w-2xl space-y-6"><div><p className="label">// account</p><h1 className="display text-3xl">Profile</h1></div>
      {msg && <p role="status" className={`flex items-center gap-2 rounded p-3 text-sm ${msg.ok ? 'bg-brand/10 text-[color:var(--brand-text)]' : 'bg-red-500/10 text-red-500'}`}>{msg.ok && <CheckCircle2 className="size-4" />}{msg.text}</p>}
      <Card className="p-6"><form className="space-y-4" onSubmit={f.handleSubmit(async (v) => {
        try { await api.patch('/auth/profile', { name: v.name, degree: v.degree || undefined, college: v.college || undefined, semester: v.semester ? Number(v.semester) : undefined }); await refresh(); setMsg({ ok: true, text: 'Profile saved.' }); }
        catch (e) { setMsg({ ok: false, text: (e as ApiError).message }); } })}>
        <Field label="Full name"><Input required minLength={2} {...f.register('name')} /></Field>
        <Field label="Email"><Input value={user?.email ?? ''} disabled readOnly /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Degree"><select className="mono h-11 w-full rounded-md border border-line bg-surface px-3 text-sm" {...f.register('degree')}><option value="">Select…</option>{DEGREE_LEVELS.map((d) => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Semester"><select className="mono h-11 w-full rounded-md border border-line bg-surface px-3 text-sm" {...f.register('semester')}><option value="">Select…</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></Field></div>
        <Field label="College / university"><Input maxLength={160} {...f.register('college')} /></Field>
        <Button disabled={f.formState.isSubmitting}>{f.formState.isSubmitting ? 'Saving…' : 'Save profile'}</Button></form></Card>
    </div>
  );
}
