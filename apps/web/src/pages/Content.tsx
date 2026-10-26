import { Link, useParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { Card, LinkButton } from '@/components/ui';

const Page = ({ title, children }: { title: string; children: React.ReactNode }) => { document.title = `${title} — ProjectForge`; return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><h1 className="text-3xl font-bold tracking-tight">{title}</h1><div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">{children}</div></div>; };

export const HowItWorks = () => <Page title="How it works">
  {[['Explore', 'Filter by technology, degree, application type, difficulty and price. Read the features, requirements, license and verification status.'], ['Buy or access', 'Paid projects are delivered through authorised downloads after your payment is verified server-side. Free projects link to their original licensed source.'], ['Set up', 'Follow the documentation: prerequisites, environment, database and run commands.'], ['Get help', 'Open a support ticket for installation or configuration problems.'], ['Custom builds', 'Submit requirements, receive a quotation with scope and milestones, pay an advance, track progress, then pay the balance for final delivery.']].map(([t, d], i) => <Card key={t} className="p-5"><p className="font-semibold text-ink">{i + 1}. {t}</p><p className="mt-1">{d}</p></Card>)}
</Page>;

const faqs = [['Can I submit these projects as my own?', 'Check your institution’s academic integrity rules. Our projects are learning resources and starting points; you are responsible for understanding, adapting and disclosing the work as your institution requires. The project report kit credits the original source and licence and asks you to state exactly what you did yourself.'], ['What is the project report kit?', 'A 50+ page, editable report scaffold in the standard college format, generated from the project’s real details. It includes technology background, theory, test-case tables, diagram and screenshot pages and a viva question bank. You complete it with your own screenshots, results and explanations — it does not contain results for tests nobody ran.'], ['Is every public GitHub project free to reuse?', 'No. A public repository is not automatically free to redistribute. We check licenses and link to the original when redistribution is not permitted.'], ['What does “verified” mean?', 'Our team has actually run the project and recorded the date. Anything else is labelled as not yet tested.'], ['Are payments safe?', 'Payments are handled by Razorpay. We never see or store card details, and access is granted only after server-side payment verification.']];
export const FAQ = () => <Page title="Frequently asked questions">{faqs.map(([q, a]) => <details key={q} className="rounded-xl border border-line bg-surface p-4"><summary className="cursor-pointer font-medium text-ink">{q}</summary><p className="mt-2">{a}</p></details>)}</Page>;

export const Custom = () => <Page title="Custom project development">
  <p>Have a specific idea? We scope it with you, quote it transparently and build it in milestones you can follow.</p>
  <Card className="space-y-2 p-5"><p className="font-semibold text-ink">Process</p><ol className="list-decimal space-y-1 pl-5"><li>Submit your idea, deadline, stack and budget.</li><li>Discuss scope with us and receive a quotation.</li><li>Accept the quotation and pay the agreed advance.</li><li>Follow milestones in your dashboard.</li><li>Pay the balance and receive final source, database and documentation.</li></ol></Card>
  <Card className="flex gap-3 border-amber-500/40 p-4"><Info className="size-5 shrink-0 text-amber-500" /><p>The request form, quotations and payments are being built in the next stage. You can create an account now so you’re ready.</p></Card>
  <LinkButton to="/register">Create an account</LinkButton>
</Page>;

const legal: Record<string, [string, string[]]> = {
  terms: ['Terms of service', ['Draft terms for review by a qualified legal professional before launch.', 'Projects are provided for learning and development. You must comply with each project’s license and your institution’s rules.', 'Accounts may be suspended for abuse, including sharing paid downloads.']],
  privacy: ['Privacy policy', ['Draft policy for legal review before launch.', 'We store your account details, orders and messages to provide the service. Payment card data is handled only by Razorpay.', 'Contact support to request access to or deletion of your data.']],
  refunds: ['Refund and cancellation policy', ['Draft policy for legal review before launch.', 'Digital downloads are generally non-refundable once delivered, except where the project is materially not as described.', 'Custom projects follow the refund and cancellation terms stated in the accepted quotation.']],
  licenses: ['License and academic use', ['Original projects are licensed for personal academic use unless stated otherwise.', 'Third-party projects keep their original license, author and attribution. Where redistribution is not permitted we link to the original repository.', 'A repository with no license is not free to redistribute; we do not host such files.']],
};
export function Legal() {
  const { doc = '' } = useParams(); const e = legal[doc];
  if (!e) return <Page title="Page not found"><Link to="/" className="text-brand">Go home</Link></Page>;
  return <Page title={e[0]}>{e[1].map((t) => <p key={t}>{t}</p>)}</Page>;
}
export const NotFound = () => <Page title="404: command not found"><p className="mono">bash: this route does not exist.</p><LinkButton to="/">cd ~</LinkButton></Page>;
