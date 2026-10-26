import { Link } from 'react-router-dom';
import { BadgeCheck, ExternalLink } from 'lucide-react';
import { formatINR } from '@projectforge/shared';
import type { ProjectCardData } from '@/lib/types';
import { Tilt } from './Tilt';
import { BookmarkButton } from './BookmarkButton';
import { useProjectsBase } from '@/hooks/useBookmarks';

const diffColor = { beginner: 'text-emerald-500', intermediate: 'text-amber-500', advanced: 'text-rose-400' } as const;

/** Terminal-window card: path title bar, key:value metadata, price as an exit code. */
export function ProjectCard({ p }: { p: ProjectCardData }) {
  const lang = (p.language ?? p.technologies[0] ?? 'misc').toLowerCase();
  const external = p.source?.type === 'external-link';
  const base = useProjectsBase();
  return (
    <Tilt className="h-full" max={4}>
      <Link to={`${base}/${p.slug}`} className="sheet group relative flex h-full flex-col">
        <div className="term-bar"><i /><i /><i /><span className="label ml-2 truncate">~/{p.appType}/{p.slug.slice(0, 28)}</span><BookmarkButton id={p._id} className="ml-auto !border-transparent !bg-transparent !p-1" /></div>
        {p.thumbnail && <img src={p.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-36 w-full border-b border-line object-cover object-top" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 text-[17px] font-bold capitalize leading-snug group-hover:text-brand">{p.title}</h3>
            <span className={`mono shrink-0 rounded px-2 py-0.5 text-xs font-bold ${p.isFree ? 'bg-brand/15 text-[color:var(--brand-text)]' : 'border border-line'}`}>{p.isFree ? '$0' : formatINR(p.pricePaise)}</span>
          </div>
          <p className="line-clamp-2 text-sm text-muted">{p.summary}</p>
          <dl className="mono mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-1 text-xs">
            <dt className="text-muted">lang</dt><dd className="truncate text-[color:var(--brand-text)]">{lang}</dd>
            <dt className="text-muted">level</dt><dd className={`capitalize ${diffColor[p.difficulty]}`}>{p.difficulty}</dd>
            <dt className="text-muted">license</dt><dd className="truncate">{p.source?.license ?? '—'}</dd>
          </dl>
          <div className="mono flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            {p.technologies.slice(1, 4).map((t) => <span key={t} className="rounded bg-surface-2 px-1.5 py-0.5">#{t}</span>)}
            {external && <span className="inline-flex items-center gap-1"><ExternalLink className="size-3" />src</span>}
            {p.verification === 'verified' && <span className="inline-flex items-center gap-1 text-brand"><BadgeCheck className="size-3" />verified</span>}
          </div>
        </div>
      </Link>
    </Tilt>
  );
}
export const ProjectCardSkeleton = () => <div className="skeleton h-72" />;
