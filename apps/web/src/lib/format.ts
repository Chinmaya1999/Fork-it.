export const dt = (d?: string | Date | null) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const day = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
export const label = (s?: string) => (s ?? '').replace(/_/g, ' ');
export const bytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const rupeesToPaise = (v: string | number) => Math.round(Number(v) * 100);
type Tone = 'neutral' | 'brand' | 'green' | 'amber';
export const statusTone = (s: string): Tone => (['paid', 'completed', 'delivered', 'resolved', 'in_development', 'processed', 'active'].includes(s) ? 'green' : ['failed', 'cancelled', 'rejected', 'disputed', 'refunded', 'closed'].includes(s) ? 'amber' : ['created', 'quoted', 'awaiting_advance', 'awaiting_final_payment', 'student_review', 'open', 'in_progress', 'waiting_student'].includes(s) ? 'brand' : 'neutral');
