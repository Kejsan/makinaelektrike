import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Copy,
  Gauge,
  Heart,
  Info,
  LayoutGrid,
  Search,
  ShieldCheck,
  Tag,
} from 'lucide-react';

const brandColors = [
  { name: 'Gray cyan', value: '#54a09b', usage: 'Primary actions, highlights, focus states, active navigation.' },
  { name: 'Navy blue', value: '#000080', usage: 'Brand base, large dark surfaces, admin/product depth.' },
  { name: 'Vivid red', value: '#fb6163', usage: 'Destructive actions, favorite state, urgent warnings.' },
  { name: 'White', value: '#ffffff', usage: 'Primary text, high contrast controls, key dividers.' },
];

const systemText = `Makina Elektrike Design System

Brand colors
- Gray cyan: #54a09b
- Navy blue: #000080
- Vivid red: #fb6163
- White: #ffffff

Design principles
- Marketplace first: every public page should help users find a dealer, model, listing, charger, or guide quickly.
- Clear hierarchy: one primary CTA per section, secondary actions as outlines, destructive actions in vivid red.
- Trust close to action: badges, counts, verification notes, and operational snapshots appear near search and decision points.
- Dense but calm admin UI: admin views prioritize scannable grouped controls, sticky navigation, and viewport-contained panels.
- Mobile first: no horizontal overflow, controls stack predictably, and card grids become single-column workflows.

Core classes
- .me-page: dark brand page surface with overflow protection.
- .me-shell: max-width content container with responsive gutters.
- .me-section: consistent vertical rhythm for public page sections.
- .me-card: reusable glass/dark card with 8px radius.
- .me-card-hover: interactive card hover treatment.
- .me-button-primary: gray-cyan filled action.
- .me-button-secondary: white/navy outline action.
- .me-input: dark field with cyan focus ring.
- .me-eyebrow: compact cyan label for section context.
- .me-heading: responsive section heading.
- .me-copy: readable body copy.

Common patterns
- Hero: real vehicle or platform imagery, strong H1, two CTAs, live snapshot or trust proof.
- Search/filter: visible fields, immediate preview, clear empty state, link to full index page.
- Cards: image or icon, clear title, one metadata row, one final action.
- Tables: reserved for admin density, with sticky/contained navigation and explicit row actions.
- Alerts: cyan for information, green for success, amber for caution, vivid red for destructive/error.
`;

const DesignSystemPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const componentExamples = useMemo(
    () => [
      {
        title: 'Vehicle cards',
        body: 'Use for EV models, listings, and saved vehicles. Keep specs compact and actions predictable.',
        icon: BatteryCharging,
      },
      {
        title: 'Dealer cards',
        body: 'Use verification, city, brand chips, and a single detail action to reduce scanning effort.',
        icon: ShieldCheck,
      },
      {
        title: 'Search panels',
        body: 'Keep filters visible, show live result feedback, and avoid blank states after filtering.',
        icon: Search,
      },
    ],
    [],
  );

  const copySystem = async () => {
    try {
      await navigator.clipboard.writeText(systemText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020817] text-white">
      <section className="border-b border-white/10 bg-[#000080]/35">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-gray-cyan/30 bg-gray-cyan/10 px-3 py-1 text-xs font-semibold uppercase text-gray-cyan">
                <LayoutGrid className="h-4 w-4" />
                Design system
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-normal text-white sm:text-5xl">
                Makina Elektrike interface language
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-gray-300">
                A practical reference for the brand colors, reusable UI primitives, content patterns, and admin/public page rules used across the platform.
              </p>
            </div>
            <button
              type="button"
              onClick={copySystem}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-cyan px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy system'}
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-lg border border-white/10 bg-white/5 p-4">
          <nav className="space-y-2 text-sm font-semibold text-gray-300">
            {['Colors', 'Typography', 'Buttons', 'Forms', 'Cards', 'States', 'Admin patterns'].map(item => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`} className="block rounded-lg px-3 py-2 transition hover:bg-white/10 hover:text-white">
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-10">
          <section id="colors" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Colors</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {brandColors.map(color => (
                <article key={color.value} className="overflow-hidden rounded-lg border border-white/10 bg-slate-950/70">
                  <div className="h-24" style={{ backgroundColor: color.value }} />
                  <div className="p-4">
                    <h3 className="font-bold">{color.name}</h3>
                    <p className="mt-1 font-mono text-sm text-gray-300">{color.value}</p>
                    <p className="mt-3 text-sm leading-6 text-gray-400">{color.usage}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="typography" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Typography</h2>
            <div className="mt-5 space-y-4">
              <p className="text-5xl font-black leading-none">Hero headline</p>
              <p className="text-3xl font-bold">Section heading</p>
              <p className="text-lg leading-8 text-gray-300">Body copy uses generous line-height for education, dealer trust notes, and public guidance.</p>
              <p className="text-xs font-semibold uppercase text-gray-cyan">Eyebrow labels use uppercase but normal letter spacing.</p>
            </div>
          </section>

          <section id="buttons" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Buttons</h2>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="rounded-lg bg-gray-cyan px-5 py-3 text-sm font-bold text-slate-950">Primary action</button>
              <button className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white">Secondary action</button>
              <button className="rounded-lg bg-vivid-red px-5 py-3 text-sm font-bold text-white">Danger action</button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-5 py-3 text-sm font-bold text-white">
                <Heart className="h-4 w-4" />
                Icon action
              </button>
            </div>
          </section>

          <section id="forms" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Forms and filters</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-semibold text-gray-300">
                City
                <input className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-gray-cyan focus:ring-2 focus:ring-gray-cyan/30" placeholder="Tirana" />
              </label>
              <label className="text-sm font-semibold text-gray-300">
                Brand
                <input className="mt-2 block w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-gray-cyan focus:ring-2 focus:ring-gray-cyan/30" placeholder="BYD" />
              </label>
              <button className="mt-7 rounded-lg bg-gray-cyan px-5 py-3 text-sm font-bold text-slate-950">Search</button>
            </div>
          </section>

          <section id="cards" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Cards</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {componentExamples.map(example => {
                const Icon = example.icon;
                return (
                  <article key={example.title} className="rounded-lg border border-white/10 bg-slate-950/70 p-5 transition hover:border-gray-cyan/50">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-cyan/15 text-gray-cyan">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{example.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-gray-300">{example.body}</p>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="states" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">States</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="flex gap-3 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 p-4 text-cyan-50"><Info className="h-5 w-5" /> Informational state</div>
              <div className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-50"><CheckCircle2 className="h-5 w-5" /> Success state</div>
              <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-50"><AlertTriangle className="h-5 w-5" /> Warning state</div>
              <div className="flex gap-3 rounded-lg border border-vivid-red/40 bg-vivid-red/10 p-4 text-red-100"><AlertTriangle className="h-5 w-5" /> Error or destructive state</div>
            </div>
          </section>

          <section id="admin-patterns" className="rounded-lg border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-bold">Admin patterns</h2>
            <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
              <div className="grid grid-cols-[180px_1fr_120px] bg-[#000080]/40 px-4 py-3 text-sm font-bold">
                <span>Area</span>
                <span>Rule</span>
                <span>Status</span>
              </div>
              {[
                ['Sidebar', 'Stays inside viewport, scrolls internally, can collapse from top-left control.', 'Required'],
                ['Tables', 'Use compact rows, clear actions, and sticky context when possible.', 'Required'],
                ['Reports', 'Pair data with CSV/export actions and explain scope.', 'Recommended'],
              ].map(row => (
                <div key={row[0]} className="grid grid-cols-[180px_1fr_120px] border-t border-white/10 px-4 py-3 text-sm text-gray-300">
                  <span className="font-semibold text-white">{row[0]}</span>
                  <span>{row[1]}</span>
                  <span className="text-gray-cyan">{row[2]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default DesignSystemPage;
