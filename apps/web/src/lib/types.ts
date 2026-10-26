export interface Category { _id: string; name: string; slug: string; description: string; icon: string; projectCount: number }
export interface ProjectCardData {
  _id: string; title: string; slug: string; summary: string; appType: string; technologies: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced'; pricePaise: number; isFree: boolean; verification: 'verified' | 'unverified';
  thumbnail?: string; category?: { name: string; slug: string }; language?: string; degreeLevels: string[]; source?: { type: string; license?: string };
}
export interface ProjectDetail extends ProjectCardData {
  description: string; abstract: string; features: string[]; prerequisites: string[]; version: string; supportPolicy?: string;
  requirements?: { hardware: string[]; software: string[] }; database?: string; language?: string; framework?: string;
  screenshots?: string[]; demoUrl?: string; videoUrl?: string; purchasable?: boolean; lastTestedAt?: string; isSample?: boolean;
  source: { type: string; repoUrl?: string; author?: string; license?: string; attribution?: string; redistributionAllowed?: boolean };
}
export interface Paged<T> { items: T[]; total: number; page: number; pages: number }
export interface User { id: string; name: string; email: string; role: 'student' | 'admin' | 'support' | 'developer'; emailVerified: boolean; degree?: string; college?: string; semester?: number }
export interface Facet { name: string; count: number }
export interface Facets { technologies: Facet[]; languages: Facet[]; databases: Facet[]; licenses: Facet[]; degrees: Facet[]; appTypes: Facet[]; difficulty: Facet[]; sourceTypes: Facet[] }
