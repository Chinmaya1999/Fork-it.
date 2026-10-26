// GitHub public API adapter: repository discovery only. Never downloads or executes repository code.
export interface GhRepo {
  full_name: string; html_url: string; description: string | null; language: string | null; topics?: string[];
  stargazers_count: number; pushed_at: string; archived: boolean; fork: boolean;
  owner: { login: string }; license: { spdx_id: string | null; name: string } | null;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function searchRepos(q: string, perPage = 30, token = process.env.GITHUB_TOKEN, page = 1, sort = 'stars', order = 'desc'): Promise<GhRepo[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=${sort}&order=${order}&per_page=${perPage}&page=${page}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ProjectForge-importer', ...(token && { Authorization: `Bearer ${token}` }) } });
    if (res.ok) return ((await res.json()) as { items: GhRepo[] }).items;
    if (res.status === 403 || res.status === 429) { await sleep(65_000); continue; } // respect rate limits
    throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  }
  throw new Error('GitHub rate limit persisted');
}

const PERMISSIVE = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Unlicense', '0BSD', 'CC0-1.0', 'Zlib']);
export const isPermissive = (spdx?: string | null) => !!spdx && PERMISSIVE.has(spdx);
export const hasUsableLicense = (spdx?: string | null) => !!spdx && spdx !== 'NOASSERTION';

export const parseRepo = (url?: string | null) => { const m = url?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/); return m ? { owner: m[1], repo: m[2] } : null; };

/** Fetches a repo's README as raw markdown (max 200 KB). Returns null if unavailable. Never executes or downloads code. */
export async function fetchReadme(repoUrl?: string | null, token = process.env.GITHUB_TOKEN): Promise<string | null> {
  const r = parseRepo(repoUrl); if (!r) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}/readme`, {
      headers: { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'ProjectForge-importer', ...(token && { Authorization: `Bearer ${token}` }) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 200_000);
  } catch { return null; }
}
