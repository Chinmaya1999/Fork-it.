import { useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

const gh = (repoUrl?: string | null) => repoUrl?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);

function CodeBlock({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(false);
  const text = (node: ReactNode): string => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join('') : (node as any)?.props?.children ? text((node as any).props.children) : '';
  return (
    <pre>
      <button type="button" aria-label="Copy code" className="absolute right-2 top-2 rounded border border-line bg-surface p-1.5 text-muted hover:text-brand"
        onClick={async () => { try { await navigator.clipboard.writeText(text(children)); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}>
        {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
      {children}
    </pre>
  );
}

/**
 * Safe markdown: react-markdown does NOT render raw HTML, and only http(s)/mailto/relative URLs are allowed.
 * Relative links/images in GitHub READMEs are rewritten to the original repository.
 */
export function Markdown({ source, repoUrl }: { source: string; repoUrl?: string | null }) {
  const m = gh(repoUrl);
  const fix = (u: string | undefined, kind: 'img' | 'link') => {
    if (!u) return u;
    if (/^(https?:|mailto:|#)/i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return undefined; // blocks javascript:, data:, etc.
    if (!m) return undefined;
    const path = u.replace(/^\.?\//, '');
    return kind === 'img' ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/HEAD/${path}` : `https://github.com/${m[1]}/${m[2]}/blob/HEAD/${path}`;
  };
  const components: Components = {
    a: ({ href, children }) => { const h = fix(href, 'link'); return h ? <a href={h} target={h.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer nofollow">{children}</a> : <span>{children}</span>; },
    img: ({ src, alt }) => { const s = fix(typeof src === 'string' ? src : undefined, 'img'); return s ? <img src={s} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" /> : null; },
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  };
  return <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={components} urlTransform={(u) => u}>{source}</ReactMarkdown></div>;
}
