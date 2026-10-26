import { Badge } from './ui';
import { label, statusTone } from '@/lib/format';
export const StatusBadge = ({ status, className }: { status: string; className?: string }) => <Badge tone={statusTone(status)} className={className}>{label(status)}</Badge>;
