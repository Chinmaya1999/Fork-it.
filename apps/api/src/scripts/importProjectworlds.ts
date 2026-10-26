// Lists projects from projectworlds.com/free-projects as LINK-ONLY entries (title + link + attribution). No files are copied.
// robots.txt permits crawling; we make a single request. Their license is unverified, so redistribution is never enabled.
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Project } from '../models/Project.js';
import { slugify } from '../utils/slug.js';
import { classify, difficultyFor, degreesFor, techFromTitle, languageFrom, databaseFrom } from '../integrations/classify.js';

const URL_ = 'https://projectworlds.com/free-projects/';
const html = await (await fetch(URL_, { headers: { 'User-Agent': 'ProjectForge-importer (+listing only)' } })).text();
const decode = (s: string) => s.replace(/&#038;|&amp;/g, '&').replace(/&#8211;/g, '-').replace(/&#8217;/g, "'").replace(/&quot;/g, '"').replace(/&#\d+;/g, '');
const found = [...html.matchAll(/class="title" href="(https:\/\/projectworlds\.com\/[^"]+)"[^>]*>([^<]+)</g)].map((m) => ({ url: m[1], title: decode(m[2]).trim() }));
console.log(`Found ${found.length} entries`);

await mongoose.connect(env.MONGODB_URI);
const cats = new Map((await Category.find()).map((c) => [c.slug, c._id]));
let n = 0;
for (const { url, title } of found) {
  const { cat, appType } = classify(title);
  const difficulty = difficultyFor(title, appType);
  const tech = techFromTitle(title);
  await Project.findOneAndUpdate({ 'source.repoUrl': url }, { $set: { language: languageFrom(tech), database: databaseFrom(tech) }, $setOnInsert: {
    title: title.slice(0, 140), slug: `pw-${slugify(url.split('/').filter(Boolean).pop()!)}`.slice(0, 80), summary: `${title}. Free student project listed on ProjectWorlds.`.slice(0, 300),
    description: `Listed from ProjectWorlds (${url}). ProjectForge links to the original page and does not host or redistribute these files. Not tested by our team.`,
    category: cats.get(cat), appType, technologies: tech.length ? tech : ['See source'], difficulty, degreeLevels: degreesFor(difficulty, appType),
    pricePaise: 0, isFree: true, 'source.type': 'external-link', 'source.repoUrl': url, 'source.author': 'ProjectWorlds', 'source.license': 'See source site',
    'source.redistributionAllowed': false, 'source.licenseReviewed': false, 'source.attribution': `Listed from projectworlds.com. Original: ${url}`,
    verification: 'unverified', supportPolicy: 'Third-party project. No support included.', status: 'published', isSample: false,
  } }, { upsert: true });
  n++;
}
console.log(`Upserted ${n} link-only listings`);
await mongoose.disconnect();
