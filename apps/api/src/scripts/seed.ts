// DEVELOPMENT-ONLY seed. All records are flagged isSample=true. No reviews, payments or customers are fabricated.
import mongoose from 'mongoose';
import { env, isProd } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Project } from '../models/Project.js';
import { slugify } from '../utils/slug.js';

if (isProd) { console.error('Refusing to seed in production'); process.exit(1); }

const cats = [
  ['Web Applications', 'Globe', 'Full-stack web apps across popular stacks'],
  ['Mobile Apps', 'Smartphone', 'Android, iOS, Flutter and React Native'],
  ['Desktop Software', 'Monitor', 'Windows desktop apps with Electron, .NET, Python'],
  ['AI & Machine Learning', 'Brain', 'ML, NLP and computer vision'],
  ['Data Science', 'BarChart3', 'Analytics and visualisation'],
  ['Cybersecurity', 'ShieldCheck', 'Ethical security labs'],
  ['Cloud & DevOps', 'Cloud', 'Automation and infrastructure'],
  ['IoT & Embedded', 'Cpu', 'Sensors, devices and firmware'],
  ['Blockchain', 'Link', 'Smart contracts and dApps'],
  ['Research Projects', 'FlaskConical', 'Academic demonstrations'],
] as const;

type P = [string, string, number, string, string[], string, string, string, string[]];
// title, summary, priceRupees, catName, tech, appType, difficulty, database, degrees
const projects: P[] = [
  ['College Management System', 'Students, faculty, courses, attendance and fee modules with role-based access.', 1499, 'Web Applications', ['MongoDB', 'Express', 'React', 'Node.js'], 'web', 'intermediate', 'MongoDB', ['BCA', 'B.Tech', 'MCA']],
  ['Hospital Appointment Portal', 'Doctor scheduling, patient records and prescriptions with admin analytics.', 1799, 'Web Applications', ['Laravel', 'PHP', 'MySQL'], 'web', 'intermediate', 'MySQL', ['BCA', 'MCA', 'Diploma']],
  ['E-commerce Storefront', 'Catalog, cart, checkout flow and order management.', 1999, 'Web Applications', ['Next.js', 'Node.js', 'PostgreSQL'], 'web', 'advanced', 'PostgreSQL', ['B.Tech', 'M.Tech', 'MCA']],
  ['Library Management System', 'Book issue/return, fines and member management.', 0, 'Web Applications', ['Django', 'Python', 'SQLite'], 'web', 'beginner', 'SQLite', ['BCA', 'Diploma', 'B.Sc CS']],
  ['Spring Boot Inventory API', 'Enterprise inventory service with JWT auth and reporting.', 1699, 'Web Applications', ['Java', 'Spring Boot', 'MySQL'], 'enterprise', 'advanced', 'MySQL', ['B.Tech', 'MCA', 'BE CSE/IT']],
  ['Expense Tracker App', 'Track spending by category with charts and monthly budgets.', 1299, 'Mobile Apps', ['Flutter', 'Dart', 'Firebase'], 'mobile', 'intermediate', 'Firestore', ['BCA', 'B.Tech', 'Diploma']],
  ['Attendance App', 'QR-based class attendance for Android with a teacher dashboard.', 1399, 'Mobile Apps', ['React Native', 'TypeScript', 'Node.js'], 'mobile', 'intermediate', 'MongoDB', ['BCA', 'B.Tech', 'MCA']],
  ['Fitness Tracker', 'Native Android workout logging and progress charts.', 999, 'Mobile Apps', ['Kotlin', 'Android', 'Room'], 'mobile', 'beginner', 'SQLite', ['BCA', 'Diploma']],
  ['Billing & POS Desktop App', 'Offline point-of-sale with invoice printing.', 1599, 'Desktop Software', ['Electron', 'React', 'SQLite'], 'desktop', 'intermediate', 'SQLite', ['BCA', 'B.Tech', 'Diploma']],
  ['Payroll Manager (.NET)', 'Employee payroll and payslip generation for Windows.', 1699, 'Desktop Software', ['.NET', 'C#', 'WPF', 'SQL Server'], 'desktop', 'advanced', 'SQL Server', ['MCA', 'B.Tech']],
  ['Sentiment Analysis Dashboard', 'NLP pipeline classifying reviews with a web dashboard.', 1899, 'AI & Machine Learning', ['Python', 'scikit-learn', 'Flask'], 'ai-ml', 'intermediate', 'SQLite', ['MCA', 'M.Tech', 'B.Tech']],
  ['Face Recognition Attendance', 'OpenCV-based attendance marking with enrollment tools.', 2199, 'AI & Machine Learning', ['Python', 'OpenCV', 'TensorFlow'], 'ai-ml', 'advanced', 'SQLite', ['B.Tech', 'M.Tech', 'MCA']],
  ['Sales Forecasting Notebook', 'Time-series forecasting with documented notebooks.', 0, 'Data Science', ['Python', 'pandas', 'Prophet'], 'data-science', 'beginner', 'CSV', ['B.Sc CS', 'M.Sc CS', 'BCA']],
  ['Network Port Scanner Lab', 'Educational scanner for an isolated lab network, with safe-use guide.', 1199, 'Cybersecurity', ['Python', 'Scapy'], 'cybersecurity', 'intermediate', 'None', ['B.Tech', 'M.Tech', 'MCA']],
  ['CI/CD Pipeline Starter', 'GitHub Actions + Docker pipeline template with deployment guide.', 1399, 'Cloud & DevOps', ['Docker', 'GitHub Actions', 'AWS'], 'cloud-devops', 'intermediate', 'None', ['B.Tech', 'MCA']],
  ['Smart Home Monitor', 'ESP32 sensor dashboard with MQTT and web UI.', 1599, 'IoT & Embedded', ['ESP32', 'MQTT', 'Node.js'], 'iot', 'intermediate', 'MongoDB', ['B.Tech', 'Diploma']],
  ['Certificate Verification dApp', 'Ethereum smart contract for tamper-proof certificates.', 2299, 'Blockchain', ['Solidity', 'Hardhat', 'React'], 'blockchain', 'advanced', 'None', ['B.Tech', 'M.Tech', 'MCA']],
];

await mongoose.connect(env.MONGODB_URI);
const catIds = new Map<string, any>();
for (const [i, [name, icon, description]] of cats.entries()) {
  const c = await Category.findOneAndUpdate({ slug: slugify(name) }, { name, icon, description, order: i, slug: slugify(name) }, { upsert: true, new: true });
  catIds.set(name, c._id);
}
let n = 0;
for (const [i, [title, summary, rupees, cat, tech, appType, difficulty, database, degrees]] of projects.entries()) {
  const slug = slugify(title);
  await Project.findOneAndUpdate({ slug }, {
    title, slug, summary, isSample: true, category: catIds.get(cat), appType, difficulty, database, degreeLevels: degrees,
    technologies: tech, language: tech[0], framework: tech[1], pricePaise: rupees * 100, isFree: rupees === 0,
    description: `${summary}\n\n[SAMPLE LISTING] Seeded for development. Replace via the admin panel.`,
    features: ['Documented setup guide', 'Database schema included', 'Role-based access where applicable'],
    prerequisites: ['Basic programming knowledge'],
    requirements: { software: ['Node.js / runtime for the listed stack', 'A code editor'], hardware: ['4 GB RAM minimum'] },
    source: { type: 'original', author: 'ProjectForge (sample)', license: 'Proprietary - academic use', redistributionAllowed: false, licenseReviewed: true },
    verification: 'unverified', supportPolicy: 'Setup support via tickets for 30 days after purchase.',
    status: 'published', featured: i < 6,
  }, { upsert: true, setDefaultsOnInsert: true });
  n++;
}
console.log(`Seeded ${catIds.size} categories, ${n} sample projects`);
await mongoose.disconnect();
