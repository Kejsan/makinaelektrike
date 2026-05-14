import React, { useEffect, useState } from 'react';
import {
  Bell,
  BookOpen,
  Camera,
  CarFront,
  ClipboardList,
  CreditCard,
  Megaphone,
  ShieldCheck,
  Store,
  Users,
  Wrench,
} from 'lucide-react';
import SEO from '../components/SEO';
import Link from '../components/LocalizedLink';
import { BASE_URL } from '../constants/seo';
import {
  fetchInternalGuideContent,
  type InternalGuideContent,
  type InternalGuideSection,
} from '../services/internalGuides';

interface DealerGuidePageProps {
  adminView?: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  bell: Bell,
  book: BookOpen,
  camera: Camera,
  car: CarFront,
  clipboard: ClipboardList,
  credit: CreditCard,
  megaphone: Megaphone,
  shield: ShieldCheck,
  store: Store,
  users: Users,
  wrench: Wrench,
};

const GuideActionLink: React.FC<{ link: { label: string; to: string; note?: string }; compact?: boolean }> = ({
  link,
  compact = false,
}) => {
  const className = compact
    ? 'inline-flex items-center rounded-lg border border-gray-cyan/25 bg-gray-cyan/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-gray-cyan/60 hover:bg-gray-cyan/15'
    : 'rounded-2xl border border-gray-cyan/25 bg-gray-cyan/10 p-4 transition hover:border-gray-cyan/60 hover:bg-gray-cyan/15';

  if (link.to.startsWith('#')) {
    return (
      <a href={link.to} className={className}>
        {compact ? (
          link.label
        ) : (
          <>
            <p className="font-semibold text-white">{link.label}</p>
            {link.note && <p className="mt-1 text-sm text-gray-300">{link.note}</p>}
          </>
        )}
      </a>
    );
  }

  return (
    <Link to={link.to} className={className}>
      {compact ? (
        link.label
      ) : (
        <>
          <p className="font-semibold text-white">{link.label}</p>
          {link.note && <p className="mt-1 text-sm text-gray-300">{link.note}</p>}
        </>
      )}
    </Link>
  );
};

const GuideSectionCard: React.FC<{ section: InternalGuideSection }> = ({ section }) => {
  const Icon = iconMap[section.icon] ?? BookOpen;

  return (
    <section
      id={section.id}
      className="scroll-mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl md:p-8"
    >
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-cyan/15 text-gray-cyan">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-2xl font-black text-white">{section.title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-gray-300">{section.summary}</p>

      <div className="mt-6 grid gap-4">
        {section.steps.map((step, index) => (
          <article key={step.title} className="rounded-2xl border border-white/10 bg-gray-950/50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-cyan text-sm font-black text-gray-950">
                {index + 1}
              </span>
              <div>
                <h3 className="text-base font-bold text-white">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-300">{step.body}</p>
              </div>
            </div>
            {step.bullets && (
              <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-300">
                {step.bullets.map(item => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-cyan" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
            {step.warning && (
              <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                {step.warning}
              </p>
            )}
            {step.result && (
              <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
                {step.result}
              </p>
            )}
            {step.links && (
              <div className="mt-4 flex flex-wrap gap-2">
                {step.links.map(link => (
                  <GuideActionLink key={`${step.title}:${link.to}:${link.label}`} link={link} compact />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {section.checklist && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-white">Operational checklist</h3>
          <ul className="mt-4 grid gap-2 text-sm leading-6 text-gray-300 md:grid-cols-2">
            {section.checklist.map(item => (
              <li key={item} className="flex gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section.links && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {section.links.map(link => (
            <GuideActionLink key={link.to} link={link} />
          ))}
        </div>
      )}
    </section>
  );
};

const DealerGuidePage: React.FC<DealerGuidePageProps> = ({ adminView = false }) => {
  const [guide, setGuide] = useState<InternalGuideContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canonical = adminView ? `${BASE_URL}/admin/dealer-guide/` : `${BASE_URL}/dealer/guide/`;

  useEffect(() => {
    let cancelled = false;
    setError(null);

    void fetchInternalGuideContent('dealer')
      .then(content => {
        if (!cancelled) {
          setGuide({
            ...content,
            quickLinks: adminView
              ? [
                  { label: 'Admin dashboard', to: '/admin', note: 'Return to the main control center.' },
                  { label: 'Admin guide', to: '/admin/guide', note: 'Open platform-admin operating guide.' },
                  { label: 'Review dealers', to: '/admin?tab=dealers', note: 'Open dealer operations from the dashboard.' },
                ]
              : content.quickLinks,
          });
        }
      })
      .catch(fetchError => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'The private guide could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [adminView]);

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <SEO
        title="Private dealer dashboard guide | Makina Elektrike"
        description="Private guide for dealership admins using the Makina Elektrike dealer dashboard."
        canonical={canonical}
        robots="noindex, nofollow, noarchive, noimageindex"
        additionalMeta={[
          { name: 'googlebot', content: 'noindex, nofollow, noarchive, noimageindex' },
          { name: 'bingbot', content: 'noindex, nofollow, noarchive, noimageindex' },
        ]}
      />

      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <Link
            to={adminView ? '/admin' : '/dealer/dashboard'}
            className="mb-4 inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 hover:text-white"
          >
            {adminView ? 'Back to admin dashboard' : 'Back to dealer dashboard'}
          </Link>
          <nav className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-cyan">
              Dealer Guide
            </p>
            <div className="space-y-1">
              {(guide?.sections ?? []).map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        <main className="space-y-8">
          <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-gray-cyan/10 p-6 shadow-2xl md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-1 text-sm font-semibold text-gray-cyan">
              <ShieldCheck className="h-4 w-4" />
              {guide?.eyebrow ?? 'Private dealership documentation'}
            </div>
            <h1 className="mt-6 text-4xl font-black tracking-tight md:text-5xl">
              {guide?.title ?? 'Dealer Dashboard Guide'}
            </h1>
            <p className="mt-4 max-w-4xl text-base leading-8 text-gray-300 md:text-lg">
              {guide?.subtitle ?? 'This private content is loaded only after authenticated authorization.'}
            </p>
            {guide && (
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {guide.quickLinks.map((link, index) => {
                  const className =
                    index === 0
                      ? 'rounded-xl bg-gray-cyan px-4 py-3 text-center text-sm font-bold text-gray-950 transition hover:bg-cyan-300'
                      : 'rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10';

                  return link.to.startsWith('#') ? (
                    <a key={`${link.label}:${link.to}`} href={link.to} className={className}>
                      {link.label}
                    </a>
                  ) : (
                    <Link key={`${link.label}:${link.to}`} to={link.to} className={className}>
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </header>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100">
              {error}
            </div>
          )}
          {!guide && !error && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-gray-300">
              Loading private guide...
            </div>
          )}
          {guide?.sections.map(section => <GuideSectionCard key={section.id} section={section} />)}
        </main>
      </div>
    </div>
  );
};

export default DealerGuidePage;
