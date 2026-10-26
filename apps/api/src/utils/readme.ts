// Fallback README for projects that have no real README. Clearly labelled as generic guidance, never as verified steps.
const GENERIC: Record<string, string[]> = {
  javascript: ['Install Node.js (LTS) from nodejs.org.', 'In the project folder run `npm install`.', 'Look in `package.json` → `scripts` and run the start/dev script (commonly `npm start` or `npm run dev`).', 'If it needs a database, check for a `.env.example` file and copy it to `.env`.'],
  typescript: ['Install Node.js (LTS).', 'Run `npm install`, then check `package.json` → `scripts` for `dev` / `start` / `build`.', 'Copy `.env.example` to `.env` if present.'],
  python: ['Install Python 3.10+.', 'Create a virtual environment: `python -m venv venv` and activate it.', 'Run `pip install -r requirements.txt` (if the file exists).', 'Run the main file (e.g. `python app.py` / `python manage.py runserver` for Django).'],
  java: ['Install JDK 17+ and Maven or Gradle (or open the folder in IntelliJ / Eclipse).', 'Maven: `mvn clean install` then `mvn spring-boot:run` (Spring Boot) — Gradle: `./gradlew bootRun`.', 'Create the database described in the project and update the connection settings.'],
  php: ['Install XAMPP/WAMP (PHP + MySQL) or use `php -S localhost:8000`.', 'Copy the project into `htdocs`, import the `.sql` file using phpMyAdmin, and update DB credentials in the config file.', 'Laravel: `composer install`, copy `.env.example` to `.env`, `php artisan key:generate`, `php artisan migrate`, `php artisan serve`.'],
  'c#': ['Install the .NET SDK and Visual Studio (or VS Code).', 'Open the `.sln` file, restore NuGet packages, update the connection string, and run.', 'CLI: `dotnet restore` then `dotnet run`.'],
  dart: ['Install the Flutter SDK and Android Studio.', 'Run `flutter pub get`, start an emulator, then `flutter run`.'],
  kotlin: ['Open the project in Android Studio, let Gradle sync, start an emulator, and press Run.'],
};
export function generateReadme(p: { title: string; summary: string; language?: string | null; technologies: string[]; difficulty: string; prerequisites: string[]; database?: string | null; source?: { repoUrl?: string | null; license?: string | null; author?: string | null } | null }): string {
  const key = (p.language ?? '').toLowerCase();
  const steps = GENERIC[key];
  const repo = p.source?.repoUrl;
  return `# ${p.title}

${p.summary}

> **Note:** the author of this project has not published a README here, and our team has **not tested** it. The steps below are *general guidance for ${p.language ?? 'this kind of'} projects* — always check the original source${repo ? ` (${repo})` : ''} for exact instructions.

## Overview
- **Language:** ${p.language ?? 'not specified'}
- **Technologies:** ${p.technologies.join(', ') || 'not specified'}
- **Database:** ${p.database ?? 'not specified'}
- **Difficulty:** ${p.difficulty}
- **License:** ${p.source?.license ?? 'not stated'}${p.source?.author ? ` · **Author:** ${p.source.author}` : ''}

## Prerequisites
${(p.prerequisites.length ? p.prerequisites : ['A code editor (VS Code recommended)', 'Git', 'Basic knowledge of ' + (p.language ?? 'the language used')]).map((x) => `- ${x}`).join('\n')}

## General setup (unverified)
${steps ? steps.map((x, i) => `${i + 1}. ${x}`).join('\n') : '1. Download or clone the project from its source.\n2. Read any files named README, INSTALL or docs/.\n3. Install the language runtime and dependencies the project lists.\n4. Configure the database/environment as described by the author, then run the main entry point.'}

## Stuck?
Open a support ticket from your dashboard and include the exact error message and your operating system.
`;
}

/** Removes "Clone the repository" steps (the heading/list line plus its `git clone …` command) from a README, since the project ships as a ZIP. */
export function stripCloneSteps(md: string): string {
  const CLONE_LINE = /^\s*(?:(?:\d+[.)]|[-*+]|#{1,6})\s*)?\**\s*(?:step\s*\d+\s*[:.-]?\s*)?(?:1\.\s*)?clone\b[^\n]{0,120}$/i;
  const lines = md.replace(/\r/g, '').split('\n'); const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) { // fenced block: drop it if it holds a clone command
      let j = i + 1; while (j < lines.length && !/^\s*(```|~~~)/.test(lines[j])) j++;
      if (lines.slice(i + 1, j).some((x) => /\bgit\s+clone\b/i.test(x))) {
        while (out.length && out[out.length - 1].trim() === '') out.pop();
        if (out.length && /clone/i.test(out[out.length - 1]) && out[out.length - 1].length < 200) out.pop(); // its intro line
        i = j; continue;
      }
      out.push(...lines.slice(i, j + 1)); i = j; continue;
    }
    if (/\bgit\s+clone\b/i.test(l) || CLONE_LINE.test(l)) continue;
    out.push(l);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}
