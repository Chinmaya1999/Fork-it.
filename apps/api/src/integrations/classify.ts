// Heuristic classification for imported third-party projects. Pure functions: easy to unit test and tune.
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
const has = (t: string, ...w: string[]) => w.some((x) => t.includes(x));

export function classify(text: string): { cat: string; appType: string } {
  const t = text.toLowerCase();
  if (has(t, 'flutter', 'android', 'react-native', 'react native', 'ios app', 'kotlin', 'swift')) return { cat: 'mobile-apps', appType: 'mobile' };
  if (has(t, 'electron', 'wpf', 'winforms', 'desktop', 'tkinter', 'javafx', 'java swing', 'swing gui')) return { cat: 'desktop-software', appType: 'desktop' };
  if (has(t, 'machine-learning', 'machine learning', 'deep-learning', 'deep learning', 'nlp', 'tensorflow', 'pytorch', 'computer-vision', 'opencv', 'neural', ' ai ', 'ai-', 'kmeans', 'chatbot', 'llm')) return { cat: 'ai-machine-learning', appType: 'ai-ml' };
  if (has(t, 'blockchain', 'solidity', 'ethereum', 'smart-contract', 'smart contract')) return { cat: 'blockchain', appType: 'blockchain' };
  if (has(t, 'iot', 'arduino', 'esp32', 'raspberry')) return { cat: 'iot-embedded', appType: 'iot' };
  if (has(t, 'security', 'pentest', 'vulnerab', 'cyber')) return { cat: 'cybersecurity', appType: 'cybersecurity' };
  if (has(t, 'devops', 'docker', 'kubernetes', 'terraform')) return { cat: 'cloud-devops', appType: 'cloud-devops' };
  if (has(t, 'data-science', 'data science', 'analytics', 'jupyter', 'forecast')) return { cat: 'data-science', appType: 'data-science' };
  return { cat: 'web-applications', appType: has(t, 'spring', 'enterprise') ? 'enterprise' : 'web' };
}

export function difficultyFor(text: string, appType: string): Difficulty {
  const t = text.toLowerCase();
  if (has(t, 'calculator', 'todo', 'to-do', 'quiz', 'portfolio', 'landing page', 'tic-tac', 'snake', 'weather', 'simple', 'basic', 'beginner', 'hangman', 'notes app', 'student project', 'mini project', 'sip calc', 'unit converter', 'password generator')) return 'beginner';
  if (['ai-ml', 'blockchain', 'cloud-devops', 'cybersecurity'].includes(appType) || has(t, 'microservice', 'spring cloud', 'kubernetes', 'deep learning', 'deep-learning', 'distributed', 'advanced')) return 'advanced';
  return 'intermediate';
}

export const degreesFor = (d: Difficulty, appType: string): string[] =>
  d === 'beginner' ? ['BCA', 'Diploma', 'B.Sc CS']
    : d === 'advanced' ? ['MCA', 'B.Tech', 'M.Tech', 'M.Sc CS', 'BE CSE/IT']
      : appType === 'enterprise' ? ['MCA', 'B.Tech', 'BE CSE/IT'] : ['BCA', 'MCA', 'B.Tech', 'B.Sc CS', 'BE CSE/IT'];

/** Setup & support fee in paise for a third-party listing. Beginner projects are free. */
export function priceFor(d: Difficulty, stars = 0): number {
  if (d === 'beginner') return 0;
  const tier = stars < 100 ? 0 : stars < 1000 ? 1 : 2;
  return (d === 'intermediate' ? [9900, 14900, 19900] : [24900, 34900, 49900])[tier];
}

const TECH = ['PHP', 'MySQL', 'Python', 'Django', 'Flask', 'Java', 'Spring Boot', 'Android', 'Kotlin', 'Flutter', 'React', 'Node.js', 'MongoDB', 'JavaScript', 'TypeScript', 'Angular', 'Vue', 'Laravel', 'ASP.NET', 'C#', '.NET', 'C++', 'OpenCV', 'TensorFlow', 'Tkinter', 'Java Swing', 'Machine Learning', 'Firebase', 'SQLite', 'Express'];
export const techFromTitle = (title: string) => TECH.filter((t) => new RegExp(`(^|[^a-z])${t.replace(/[.+]/g, '\\$&')}([^a-z]|$)`, 'i').test(title));

const LANGS = ['PHP', 'Python', 'Java', 'Kotlin', 'C#', 'C++', 'JavaScript', 'TypeScript', 'Dart'];
const DBS = ['MySQL', 'MongoDB', 'SQLite', 'Firebase', 'PostgreSQL', 'SQL Server'];
/** Primary language and database inferred from a title/tech list (not from list order). */
export const languageFrom = (tech: string[]) => LANGS.find((l) => tech.includes(l));
export const databaseFrom = (tech: string[]) => { const d = DBS.find((x) => tech.includes(x)); return d; };
