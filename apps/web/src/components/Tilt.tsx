import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** 3D pointer-tilt with a moving glare highlight. Disabled for touch & reduced-motion. */
export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current!, r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
    el.style.setProperty('--gx', `${x * 100}%`); el.style.setProperty('--gy', `${y * 100}%`);
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn('tilt relative transition-transform duration-200 ease-out', className)}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity [div:hover>&]:opacity-100" style={{ background: 'radial-gradient(260px circle at var(--gx,50%) var(--gy,50%), rgba(74,222,128,.12), transparent 60%)' }} />
    </div>
  );
}
