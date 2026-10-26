import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Lock, X, FlaskConical } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Card } from '@/components/ui';

export interface CheckoutPayload { provider: 'razorpay' | 'cashfree' | 'mock'; keyId?: string; mode?: 'production' | 'sandbox'; sessionId?: string; gatewayOrderId: string; amountPaise: number; currency: string; description: string; orderId: string; prefill?: { name?: string; email?: string } }
declare global { interface Window { Cashfree?: (o: { mode: string }) => { checkout(o: Record<string, unknown>): Promise<{ error?: { message?: string }; paymentDetails?: unknown }> }; Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(ev: string, cb: (r: any) => void): void } } }

const loadRazorpay = () => new Promise<boolean>((resolve) => {
  if (window.Razorpay) return resolve(true);
  const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
});

const loadCashfree = () => new Promise<boolean>((resolve) => {
  if (window.Cashfree) return resolve(true);
  const s = document.createElement('script'); s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.body.appendChild(s);
});

/** Opens the gateway. Success is NEVER assumed from the browser: the server verifies the signature and asks the gateway for the real status. */
export function CheckoutDialog({ checkout, onPaid, onClose }: { checkout: CheckoutPayload; onPaid: () => void; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string>();
  const verify = async (paymentId?: string, signature?: string) => {
    setBusy(true);
    // The gateway can take a few seconds to mark a payment captured; retry instead of showing a scary error. If it still isn't confirmed, the webhook completes the order.
    for (let attempt = 0; attempt < 4; attempt++) {
      try { await api.post(`/orders/${checkout.orderId}/verify`, { paymentId, signature }); onPaid(); return; }
      catch (e) {
        const pending = (e as ApiError).status === 400 && /not confirmed/i.test((e as ApiError).message);
        if (pending && attempt < 3) { await new Promise((r) => setTimeout(r, 2500)); continue; }
        setErr(pending ? 'Your payment is still being confirmed by the bank. You have not been charged twice — check My orders in a minute; access unlocks automatically.' : (e as ApiError).message); setBusy(false); return;
      }
    }
  };
  useEffect(() => {
    if (checkout.provider === 'cashfree') {
      (async () => {
        if (!(await loadCashfree()) || !window.Cashfree || !checkout.sessionId) { setErr('Could not load the payment window. Check your connection and try again.'); return; }
        const r = await window.Cashfree({ mode: checkout.mode ?? 'production' }).checkout({ paymentSessionId: checkout.sessionId, redirectTarget: '_modal' });
        if (r?.error) setErr(r.error.message ?? 'Payment failed. You can try again.'); // the server still decides: the webhook/verify marks the order paid only if Cashfree says so
        else if (r?.paymentDetails) verify(); else onClose();
      })();
      return;
    }
    if (checkout.provider !== 'razorpay') return;
    let cancelled = false;
    (async () => {
      if (!(await loadRazorpay()) || !window.Razorpay) { setErr('Could not load the payment window. Check your connection and try again.'); return; }
      if (cancelled) return;
      const rz = new window.Razorpay({ key: checkout.keyId, amount: checkout.amountPaise, currency: checkout.currency, name: 'ProjectForge', description: checkout.description, order_id: checkout.gatewayOrderId, prefill: checkout.prefill,
        handler: (r: any) => verify(r.razorpay_payment_id, r.razorpay_signature), modal: { ondismiss: onClose } });
      rz.on('payment.failed', (r: any) => { setErr(r?.error?.description ?? 'Payment failed. You can try again.'); api.post(`/orders/${checkout.orderId}/failed`, { paymentId: r?.error?.metadata?.payment_id, reason: r?.error?.description }).catch(() => undefined); });
      rz.open();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mock = async (outcome: 'success' | 'failure') => {
    setBusy(true); setErr(undefined);
    try { const r = await api.post<{ ok: boolean }>(`/orders/${checkout.orderId}/mock-pay`, { outcome }); if (r.ok) onPaid(); else { setErr('Simulated payment failed. You can try again.'); setBusy(false); } }
    catch (e) { setErr((e as ApiError).message); setBusy(false); }
  };
  if (checkout.provider === 'razorpay' || checkout.provider === 'cashfree') return err ? <Modal onClose={onClose}><p role="alert" className="text-sm text-red-500">{err}</p><Button className="mt-4" onClick={onClose}>Close</Button></Modal> : busy ? <Modal onClose={onClose}><p className="text-sm">Verifying your payment with the gateway…</p></Modal> : null;
  return (
    <Modal onClose={onClose}>
      <p className="label flex items-center gap-1.5 text-amber-500"><FlaskConical className="size-3.5" />Development sandbox — no real money moves</p>
      <h2 className="mt-2 font-display text-xl font-bold">{checkout.description}</h2>
      <p className="mono mt-1 text-3xl font-bold text-brand">{formatINR(checkout.amountPaise)}</p>
      <p className="mt-3 text-xs text-muted">This test gateway runs because no payment gateway keys are configured. The server still verifies a signed payment and checks the amount before granting anything.</p>
      {err && <p role="alert" className="mt-3 text-sm text-red-500">{err}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><Button disabled={busy} onClick={() => mock('success')}><Lock className="size-4" />{busy ? 'Processing…' : 'Simulate successful payment'}</Button><Button variant="secondary" disabled={busy} onClick={() => mock('failure')}>Simulate failure</Button></div>
    </Modal>
  );
}
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><Card role="dialog" aria-modal="true" className="relative w-full max-w-md p-6"><button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 text-muted hover:text-ink"><X className="size-5" /></button>{children}</Card></div>, document.body);
}

/** Button that creates a server-side order, then opens the gateway. */
export function PayButton({ create, children, onPaid, disabled, variant, className }: { create: () => Promise<{ checkout: CheckoutPayload }>; children: React.ReactNode; onPaid: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; className?: string }) {
  const [state, setState] = useState<{ checkout?: CheckoutPayload; busy?: boolean; err?: string }>({});
  const start = async () => { setState({ busy: true }); try { const r = await create(); setState({ checkout: r.checkout }); } catch (e) { setState({ err: (e as ApiError).message }); } };
  return (<>
    <Button onClick={start} disabled={disabled || state.busy} variant={variant} className={className}>{state.busy ? 'Preparing…' : children}</Button>
    {state.err && <p role="alert" className="mt-2 text-sm text-red-500">{state.err}</p>}
    {state.checkout && <CheckoutDialog checkout={state.checkout} onClose={() => setState({})} onPaid={() => { setState({}); onPaid(); }} />}
  </>);
}
