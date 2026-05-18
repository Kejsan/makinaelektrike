import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  Check,
  ClipboardList,
  Download,
  Eye,
  ImageIcon,
  Loader2,
  Mail,
  Megaphone,
  Plus,
  RefreshCcw,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  PublicAnnouncement,
  PublicAnnouncementAnalyticsSummary,
  PublicAnnouncementDisplayMode,
  PublicAnnouncementFormValues,
  PublicAnnouncementSegment,
  PublicAnnouncementSeverity,
  PublicAnnouncementStatus,
  PublicAnnouncementType,
  NewsletterSubscriber,
} from '../../types';
import {
  archiveAdminAnnouncement,
  listAdminAnnouncementSuggestions,
  listAdminAnnouncements,
  saveAdminAnnouncement,
} from '../../services/adminAnnouncements';
import { listAdminNewsletterSubscribers } from '../../services/newsletter';
import { uploadAnnouncementImage } from '../../services/storage';
import { useToast } from '../../contexts/ToastContext';

type EngagementSubtab = 'announcements' | 'drafts' | 'modules' | 'analytics' | 'subscribers';

const ANNOUNCEMENT_TYPES: PublicAnnouncementType[] = [
  'feature_release',
  'model_batch',
  'dealer_added',
  'blog_post',
  'charging_update',
  'platform_notice',
  'promotion',
  'maintenance',
];

const SEVERITIES: PublicAnnouncementSeverity[] = ['info', 'highlight', 'critical'];
const STATUSES: PublicAnnouncementStatus[] = ['draft', 'scheduled', 'active', 'paused', 'archived'];
const DISPLAY_MODES: PublicAnnouncementDisplayMode[] = ['feed_only', 'banner', 'modal'];
const SEGMENTS: PublicAnnouncementSegment[] = ['all', 'anonymous', 'signed_in', 'dealer'];

const emptyForm: PublicAnnouncementFormValues = {
  type: 'platform_notice',
  severity: 'info',
  status: 'draft',
  displayMode: 'feed_only',
  title: '',
  summary: '',
  body: '',
  ctaLabel: '',
  destinationUrl: '',
  imageUrl: '',
  localeTargets: [],
  pageTargets: [],
  segmentTargets: ['all'],
  startAt: '',
  endAt: '',
  priority: 0,
  dismissible: true,
  maxViewsPerVisitor: 1,
  sourceType: 'manual',
  sourceEntityType: '',
  sourceEntityId: '',
};

const templates: Array<{
  label: string;
  values: Partial<PublicAnnouncementFormValues>;
}> = [
  {
    label: 'New feature',
    values: {
      type: 'feature_release',
      severity: 'highlight',
      displayMode: 'banner',
      title: 'New platform feature is live',
      summary: 'A new Makina Elektrike feature is available to help visitors make better EV decisions.',
      ctaLabel: 'See what changed',
      destinationUrl: '/',
      priority: 25,
      sourceEntityType: 'feature',
    },
  },
  {
    label: 'EV model batch',
    values: {
      type: 'model_batch',
      severity: 'highlight',
      displayMode: 'banner',
      title: 'New EV model cards added',
      summary: 'Fresh EV model data is now available in the Makina Elektrike catalog.',
      ctaLabel: 'Browse models',
      destinationUrl: '/models',
      pageTargets: ['/', '/models'],
      priority: 24,
    },
  },
  {
    label: 'New dealer',
    values: {
      type: 'dealer_added',
      severity: 'highlight',
      displayMode: 'feed_only',
      title: 'New verified EV dealer added',
      summary: 'A new verified dealer is now available in the Makina Elektrike dealer network.',
      ctaLabel: 'Browse dealers',
      destinationUrl: '/dealers',
      pageTargets: ['/', '/dealers'],
      priority: 20,
    },
  },
  {
    label: 'New guide',
    values: {
      type: 'blog_post',
      severity: 'info',
      displayMode: 'feed_only',
      title: 'New EV guide published',
      summary: 'A new guide is available for visitors researching electric mobility in Albania.',
      ctaLabel: 'Read guide',
      destinationUrl: '/blog',
      pageTargets: ['/', '/blog'],
      priority: 12,
    },
  },
  {
    label: 'Charging update',
    values: {
      type: 'charging_update',
      severity: 'info',
      displayMode: 'feed_only',
      title: 'Charging map updated',
      summary: 'Charging information has been refreshed to help visitors plan with more confidence.',
      ctaLabel: 'Open charging map',
      destinationUrl: '/albania-charging-stations',
      pageTargets: ['/', '/albania-charging-stations'],
      priority: 12,
    },
  },
  {
    label: 'Important notice',
    values: {
      type: 'platform_notice',
      severity: 'critical',
      displayMode: 'modal',
      title: 'Important platform notice',
      summary: 'There is an important update for Makina Elektrike visitors.',
      priority: 100,
      maxViewsPerVisitor: 1,
      sourceEntityType: 'system',
    },
  },
];

const labelize = (value: string) =>
  value
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const toDateTimeLocal = (value?: string | null) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromAnnouncement = (announcement: PublicAnnouncement): PublicAnnouncementFormValues => ({
  type: announcement.type,
  severity: announcement.severity,
  status: announcement.status,
  displayMode: announcement.displayMode,
  title: announcement.title,
  summary: announcement.summary,
  body: announcement.body ?? '',
  ctaLabel: announcement.ctaLabel ?? '',
  destinationUrl: announcement.destinationUrl ?? '',
  imageUrl: announcement.imageUrl ?? '',
  localeTargets: announcement.localeTargets ?? [],
  pageTargets: announcement.pageTargets ?? [],
  segmentTargets: announcement.segmentTargets?.length ? announcement.segmentTargets : ['all'],
  startAt: toDateTimeLocal(announcement.startAt),
  endAt: toDateTimeLocal(announcement.endAt),
  priority: announcement.priority,
  dismissible: announcement.dismissible,
  maxViewsPerVisitor: announcement.maxViewsPerVisitor,
  sourceType: announcement.sourceType,
  sourceEntityType: announcement.sourceEntityType ?? '',
  sourceEntityId: announcement.sourceEntityId ?? '',
});

const previewAnnouncement = (form: PublicAnnouncementFormValues): PublicAnnouncement => ({
  id: 'preview',
  type: form.type,
  severity: form.severity,
  status: form.status,
  displayMode: form.displayMode,
  title: form.title || 'Announcement title',
  summary: form.summary || 'Short visitor-facing summary for this update.',
  body: form.body || null,
  ctaLabel: form.ctaLabel || null,
  destinationUrl: form.destinationUrl || null,
  imageUrl: form.imageUrl || null,
  localeTargets: form.localeTargets,
  pageTargets: form.pageTargets,
  segmentTargets: form.segmentTargets,
  startAt: form.startAt || null,
  endAt: form.endAt || null,
  priority: typeof form.priority === 'number' ? form.priority : 0,
  dismissible: form.dismissible,
  maxViewsPerVisitor: typeof form.maxViewsPerVisitor === 'number' ? form.maxViewsPerVisitor : 1,
  sourceType: form.sourceType,
  sourceEntityType: form.sourceEntityType || null,
  sourceEntityId: form.sourceEntityId || null,
});

const analyticsFor = (
  analytics: PublicAnnouncementAnalyticsSummary[],
  announcementId: string,
) => analytics.find(entry => entry.announcementId === announcementId);

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Not recorded';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const providerStatusClass = (status: NewsletterSubscriber['providerSyncStatus']) => {
  if (status === 'synced') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  }
  if (status === 'failed') {
    return 'border-red-400/30 bg-red-500/10 text-red-100';
  }
  return 'border-white/10 bg-white/5 text-gray-300';
};

const exportSubscribersCsv = (subscribers: NewsletterSubscriber[]) => {
  const rows = [
    [
      'Email',
      'Name',
      'Status',
      'Provider',
      'Provider sync',
      'Locale',
      'Source',
      'Page path',
      'Consent at',
      'Created at',
      'Provider error',
    ],
    ...subscribers.map(subscriber => [
      subscriber.email,
      subscriber.name ?? '',
      subscriber.status,
      subscriber.providerName ?? '',
      subscriber.providerSyncStatus,
      subscriber.locale ?? '',
      subscriber.source,
      subscriber.pagePath ?? '',
      subscriber.consentAt ?? '',
      subscriber.createdAt ?? '',
      subscriber.providerError ?? '',
    ]),
  ];
  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const VisitorEngagementTab: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [activeSubtab, setActiveSubtab] = useState<EngagementSubtab>('announcements');
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [analytics, setAnalytics] = useState<PublicAnnouncementAnalyticsSummary[]>([]);
  const [suggestions, setSuggestions] = useState<PublicAnnouncementFormValues[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [form, setForm] = useState<PublicAnnouncementFormValues>(() => ({ ...emptyForm }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribersError, setSubscribersError] = useState<string | null>(null);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listAdminAnnouncements();
      setAnnouncements(response.announcements);
      setAnalytics(response.analytics);
    } catch (loadError) {
      console.error('Failed to load public announcements', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load public announcements.');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const response = await listAdminAnnouncementSuggestions();
      setSuggestions(response.suggestions);
    } catch (loadError) {
      console.error('Failed to load announcement suggestions', loadError);
      addToast(
        loadError instanceof Error ? loadError.message : 'Failed to load announcement suggestions.',
        'error',
      );
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const loadSubscribers = async () => {
    setSubscribersLoading(true);
    setSubscribersError(null);
    try {
      const response = await listAdminNewsletterSubscribers();
      setSubscribers(response.subscribers);
    } catch (loadError) {
      console.error('Failed to load newsletter subscribers', loadError);
      setSubscribersError(loadError instanceof Error ? loadError.message : 'Failed to load newsletter subscribers.');
    } finally {
      setSubscribersLoading(false);
    }
  };

  useEffect(() => {
    void loadAnnouncements();
    void loadSuggestions();
    void loadSubscribers();
  }, []);

  const stats = useMemo(() => {
    const active = announcements.filter(item => item.status === 'active').length;
    const scheduled = announcements.filter(item => item.status === 'scheduled').length;
    const drafts = announcements.filter(item => item.status === 'draft').length + suggestions.length;
    const totalImpressions = analytics.reduce((sum, entry) => sum + entry.impressions, 0);
    const totalClicks = analytics.reduce((sum, entry) => sum + entry.clicks, 0);
    return {
      active,
      scheduled,
      drafts,
      subscribers: subscribers.filter(item => item.status === 'active').length,
      totalImpressions,
      totalClicks,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    };
  }, [analytics, announcements, subscribers, suggestions.length]);

  const updateForm = <TKey extends keyof PublicAnnouncementFormValues>(
    key: TKey,
    value: PublicAnnouncementFormValues[TKey],
  ) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const toggleListValue = <TValue extends string>(
    key: 'localeTargets' | 'pageTargets' | 'segmentTargets',
    value: TValue,
  ) => {
    setForm(current => {
      const currentList = current[key] as string[];
      const nextList = currentList.includes(value)
        ? currentList.filter(entry => entry !== value)
        : [...currentList, value];
      return {
        ...current,
        [key]: key === 'segmentTargets' && nextList.length === 0 ? ['all'] : nextList,
      };
    });
  };

  const applyTemplate = (values: Partial<PublicAnnouncementFormValues>) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      ...values,
      localeTargets: values.localeTargets ? [...values.localeTargets] : [],
      pageTargets: values.pageTargets ? [...values.pageTargets] : [],
      segmentTargets: values.segmentTargets ? [...values.segmentTargets] : ['all'],
    });
  };

  const handleEdit = (announcement: PublicAnnouncement) => {
    setEditingId(announcement.id);
    setForm(fromAnnouncement(announcement));
    setActiveSubtab('announcements');
  };

  const handleSave = async (statusOverride?: PublicAnnouncementStatus) => {
    setSaving(true);
    try {
      const response = await saveAdminAnnouncement({
        id: editingId ?? undefined,
        values: {
          ...form,
          status: statusOverride ?? form.status,
        },
      });
      setAnnouncements(current => {
        const without = current.filter(item => item.id !== response.announcement.id);
        return [response.announcement, ...without];
      });
      setEditingId(response.announcement.id);
      setForm(fromAnnouncement(response.announcement));
      addToast('Public announcement saved.', 'success');
    } catch (saveError) {
      console.error('Failed to save public announcement', saveError);
      addToast(saveError instanceof Error ? saveError.message : 'Failed to save public announcement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (announcement: PublicAnnouncement) => {
    setSaving(true);
    try {
      const response = await archiveAdminAnnouncement(announcement.id);
      setAnnouncements(current =>
        current.map(item => (item.id === response.announcement.id ? response.announcement : item)),
      );
      addToast('Public announcement archived.', 'success');
    } catch (archiveError) {
      console.error('Failed to archive public announcement', archiveError);
      addToast(archiveError instanceof Error ? archiveError.message : 'Failed to archive public announcement.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAnnouncementImage(file);
      updateForm('imageUrl', url);
      addToast('Announcement image uploaded. Save the announcement to publish it.', 'success');
    } catch (uploadError) {
      console.error('Failed to upload announcement image', uploadError);
      addToast(uploadError instanceof Error ? uploadError.message : 'Image upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const formPreview = previewAnnouncement(form);
  const subtabItems: Array<{ id: EngagementSubtab; label: string; icon: React.ElementType }> = [
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'drafts', label: 'Auto drafts', icon: Wand2 },
    { id: 'modules', label: 'Engagement modules', icon: Sparkles },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'subscribers', label: 'Subscribers', icon: Mail },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-cyan">
            Visitor engagement
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white">Public updates and interaction tools</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Publish visitor-facing platform updates, prepare auto-drafted announcements, and track the modules that make EV research more interactive.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setForm({ ...emptyForm });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-gray-cyan/20"
          >
            <Plus className="h-4 w-4" />
            New announcement
          </button>
          <button
            type="button"
            onClick={() => {
              void loadAnnouncements();
              void loadSubscribers();
            }}
            disabled={loading || subscribersLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-60"
          >
            <RefreshCcw className={`h-4 w-4 ${loading || subscribersLoading ? 'animate-spin' : ''}`} />
            Reload
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Active', value: stats.active, icon: Bell },
          { label: 'Scheduled', value: stats.scheduled, icon: ClipboardList },
          { label: 'Drafts', value: stats.drafts, icon: Wand2 },
          { label: 'CTR', value: `${(stats.ctr * 100).toFixed(1)}%`, icon: BarChart3 },
          { label: 'Subscribers', value: stats.subscribers, icon: Mail },
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-gray-400">{item.label}</span>
                <Icon className="h-5 w-5 text-gray-cyan" />
              </div>
              <p className="mt-3 text-2xl font-black text-white">{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {subtabItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSubtab(item.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeSubtab === item.id
                  ? 'bg-gray-cyan text-slate-950'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {activeSubtab === 'announcements' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit announcement' : 'Create announcement'}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  Routine updates should stay in the inbox. Use banners for important non-blocking updates and modals only for rare critical notices.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {templates.slice(0, 4).map(template => (
                  <button
                    key={template.label}
                    type="button"
                    onClick={() => applyTemplate(template.values)}
                    className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Type</span>
                <select
                  value={form.type}
                  onChange={event => updateForm('type', event.target.value as PublicAnnouncementType)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                >
                  {ANNOUNCEMENT_TYPES.map(type => (
                    <option key={type} value={type}>{labelize(type)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Display</span>
                <select
                  value={form.displayMode}
                  onChange={event => updateForm('displayMode', event.target.value as PublicAnnouncementDisplayMode)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                >
                  {DISPLAY_MODES.map(mode => (
                    <option key={mode} value={mode}>{labelize(mode)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Status</span>
                <select
                  value={form.status}
                  onChange={event => updateForm('status', event.target.value as PublicAnnouncementStatus)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                >
                  {STATUSES.map(status => (
                    <option key={status} value={status}>{labelize(status)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Title</span>
                <input
                  value={form.title}
                  onChange={event => updateForm('title', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                  placeholder="New charging map improvements"
                />
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Severity</span>
                <select
                  value={form.severity}
                  onChange={event => updateForm('severity', event.target.value as PublicAnnouncementSeverity)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                >
                  {SEVERITIES.map(severity => (
                    <option key={severity} value={severity}>{labelize(severity)}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-4 block text-sm text-gray-300">
              <span className="font-semibold text-gray-200">Summary</span>
              <textarea
                value={form.summary}
                onChange={event => updateForm('summary', event.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                placeholder="Short, visitor-facing explanation..."
              />
            </label>

            <label className="mt-4 block text-sm text-gray-300">
              <span className="font-semibold text-gray-200">Long body</span>
              <textarea
                value={form.body}
                onChange={event => updateForm('body', event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                placeholder="Optional additional context shown in the inbox and modal..."
              />
            </label>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">CTA label</span>
                <input
                  value={form.ctaLabel}
                  onChange={event => updateForm('ctaLabel', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                  placeholder="Open update"
                />
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">CTA URL</span>
                <input
                  value={form.destinationUrl}
                  onChange={event => updateForm('destinationUrl', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                  placeholder="/models or https://..."
                />
              </label>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="grid gap-4 xl:grid-cols-[180px_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-950">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="aspect-video w-full object-cover" />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center text-gray-500">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="block text-sm text-gray-300">
                    <span className="font-semibold text-gray-200">Image URL</span>
                    <input
                      value={form.imageUrl}
                      onChange={event => updateForm('imageUrl', event.target.value)}
                      className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                      placeholder="Upload to R2 or paste an existing URL"
                    />
                  </label>
                  <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    uploading
                      ? 'border border-white/10 bg-white/5 text-gray-300'
                      : 'border border-gray-cyan/30 bg-gray-cyan/10 text-cyan-100 hover:bg-gray-cyan/20'
                  }`}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? 'Uploading...' : 'Upload announcement image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Page targets</span>
                <input
                  value={form.pageTargets.join(', ')}
                  onChange={event =>
                    updateForm('pageTargets', event.target.value.split(',').map(entry => entry.trim()).filter(Boolean))
                  }
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                  placeholder="/, /models, /blog/*"
                />
                <span className="mt-1 block text-xs text-gray-500">Leave empty for all public pages.</span>
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Locale targets</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['sq', 'en', 'it'].map(locale => (
                    <button
                      key={locale}
                      type="button"
                      onClick={() => toggleListValue('localeTargets', locale)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        form.localeTargets.includes(locale)
                          ? 'border-gray-cyan bg-gray-cyan/15 text-cyan-100'
                          : 'border-white/10 bg-black/20 text-gray-300'
                      }`}
                    >
                      {locale.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span className="mt-1 block text-xs text-gray-500">Leave empty for every language.</span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <label className="block text-sm text-gray-300 md:col-span-2">
                <span className="font-semibold text-gray-200">Segments</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SEGMENTS.map(segment => (
                    <button
                      key={segment}
                      type="button"
                      onClick={() => toggleListValue('segmentTargets', segment)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                        form.segmentTargets.includes(segment)
                          ? 'border-gray-cyan bg-gray-cyan/15 text-cyan-100'
                          : 'border-white/10 bg-black/20 text-gray-300'
                      }`}
                    >
                      {labelize(segment)}
                    </button>
                  ))}
                </div>
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Priority</span>
                <input
                  type="number"
                  value={form.priority}
                  onChange={event => updateForm('priority', event.target.value === '' ? '' : Number(event.target.value))}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                />
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Max views</span>
                <input
                  type="number"
                  min={1}
                  value={form.maxViewsPerVisitor}
                  onChange={event => updateForm('maxViewsPerVisitor', event.target.value === '' ? '' : Number(event.target.value))}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">Start at</span>
                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={event => updateForm('startAt', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                />
              </label>
              <label className="block text-sm text-gray-300">
                <span className="font-semibold text-gray-200">End at</span>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={event => updateForm('endAt', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-gray-cyan/70"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={form.dismissible}
                onChange={event => updateForm('dismissible', event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/30 text-gray-cyan"
              />
              Visitors can dismiss this update
            </label>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-cyan px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => void handleSave('active')}
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-gray-cyan/20 disabled:opacity-60"
              >
                <Megaphone className="h-4 w-4" />
                Save and publish
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-2">
                <Eye className="h-5 w-5 text-gray-cyan" />
                <h3 className="text-lg font-semibold text-white">Preview</h3>
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-[#000080] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-cyan">Banner</p>
                  <p className="mt-2 text-sm font-bold text-white">{formPreview.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{formPreview.summary}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-cyan">Inbox card</p>
                  <p className="mt-2 text-sm font-bold text-white">{formPreview.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{formPreview.summary}</p>
                </div>
                <div className="rounded-xl border border-gray-cyan/20 bg-slate-950 p-4 shadow-xl">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-cyan">Modal</p>
                  <p className="mt-3 text-lg font-black text-white">{formPreview.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{formPreview.summary}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold text-white">Active catalog</h3>
              <div className="mt-4 max-h-[38rem] space-y-3 overflow-y-auto pr-1">
                {loading ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">Loading...</div>
                ) : announcements.length ? (
                  announcements.map(announcement => {
                    const metric = analyticsFor(analytics, announcement.id);
                    return (
                      <article key={announcement.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-white">{announcement.title}</p>
                            <p className="mt-1 text-xs text-gray-400">
                              {labelize(announcement.status)} · {labelize(announcement.displayMode)} · {metric?.impressions ?? 0} views
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-300">
                            {labelize(announcement.type)}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(announcement)}
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                          >
                            Edit
                          </button>
                          {announcement.status !== 'archived' && (
                            <button
                              type="button"
                              onClick={() => void handleArchive(announcement)}
                              disabled={saving}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
                            >
                              <Archive className="h-3.5 w-3.5" />
                              Archive
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
                    No announcements yet.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      )}

      {activeSubtab === 'drafts' && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Auto drafts</h3>
              <p className="mt-1 text-sm text-gray-400">
                Generated from recent dealer, blog, model, and charging activity. Nothing is published until an admin reviews it.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSuggestions()}
              disabled={suggestionsLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${suggestionsLoading ? 'animate-spin' : ''}`} />
              Refresh drafts
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.map(template => (
              <article key={template.label} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-bold text-white">{template.label}</p>
                <p className="mt-2 text-sm leading-6 text-gray-400">{template.values.summary}</p>
                <button
                  type="button"
                  onClick={() => {
                    applyTemplate(template.values);
                    setActiveSubtab('announcements');
                  }}
                  className="mt-4 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-gray-cyan/20"
                >
                  Use template
                </button>
              </article>
            ))}
            {suggestions.map((suggestion, index) => (
              <article key={`${suggestion.sourceEntityType}-${suggestion.sourceEntityId}-${index}`} className="rounded-xl border border-gray-cyan/20 bg-gray-cyan/10 p-4">
                <p className="text-sm font-bold text-white">{suggestion.title}</p>
                <p className="mt-2 text-sm leading-6 text-cyan-100/80">{suggestion.summary}</p>
                <button
                  type="button"
                  onClick={() => {
                    applyTemplate(suggestion);
                    setActiveSubtab('announcements');
                  }}
                  className="mt-4 rounded-lg bg-gray-cyan px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-white"
                >
                  Edit draft
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeSubtab === 'modules' && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold text-white">Engagement modules</h3>
          <p className="mt-1 text-sm text-gray-400">
            Homepage modules now focus on visitor decision support instead of passive reading.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ['EV finder quiz', 'Matches visitors to model cards using budget, range, charging access, body style, and seats.'],
              ['Model comparison', 'Lets visitors open the existing comparison tool directly from the homepage decision section.'],
              ['Charging confidence', 'Shows station coverage and common route confidence before visitors choose a model.'],
              ['Ownership cost', 'Gives a simple monthly electricity-versus-fuel estimate using visitor inputs.'],
            ].map(([title, description]) => (
              <article key={title} className="rounded-xl border border-white/10 bg-black/20 p-4">
                <Sparkles className="h-5 w-5 text-gray-cyan" />
                <h4 className="mt-4 text-base font-bold text-white">{title}</h4>
                <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeSubtab === 'analytics' && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold text-white">Announcement analytics</h3>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Announcement</th>
                  <th className="px-3 py-2">Views</th>
                  <th className="px-3 py-2">Clicks</th>
                  <th className="px-3 py-2">CTR</th>
                  <th className="px-3 py-2">Dismissals</th>
                  <th className="px-3 py-2">Modal</th>
                  <th className="px-3 py-2">Banner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {announcements.map(announcement => {
                  const metric = analyticsFor(analytics, announcement.id);
                  return (
                    <tr key={announcement.id} className="text-gray-300">
                      <td className="px-3 py-3 font-semibold text-white">{announcement.title}</td>
                      <td className="px-3 py-3">{metric?.impressions ?? 0}</td>
                      <td className="px-3 py-3">{metric?.clicks ?? 0}</td>
                      <td className="px-3 py-3">{(((metric?.ctr ?? 0) * 100)).toFixed(1)}%</td>
                      <td className="px-3 py-3">{metric?.dismissals ?? 0}</td>
                      <td className="px-3 py-3">{metric?.modalViews ?? 0}</td>
                      <td className="px-3 py-3">{metric?.bannerViews ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSubtab === 'subscribers' && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Newsletter subscribers</h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-400">
                Footer newsletter registrations are stored here first. If a newsletter provider webhook is configured, each record also shows the sync status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadSubscribers()}
                disabled={subscribersLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${subscribersLoading ? 'animate-spin' : ''}`} />
                Reload
              </button>
              <button
                type="button"
                onClick={() => exportSubscribersCsv(subscribers)}
                disabled={!subscribers.length}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/30 bg-gray-cyan/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-gray-cyan/20 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          {subscribersError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {subscribersError}
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            {subscribersLoading ? (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm font-semibold text-gray-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-gray-cyan" />
                Loading subscribers...
              </div>
            ) : subscribers.length ? (
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Subscriber</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Consent</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {subscribers.map(subscriber => (
                    <tr key={subscriber.id} className="align-top text-gray-300">
                      <td className="px-3 py-4">
                        <p className="font-semibold text-white">{subscriber.email}</p>
                        {subscriber.name && (
                          <p className="mt-1 text-xs text-gray-500">{subscriber.name}</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-medium text-gray-200">{subscriber.source}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {[subscriber.locale?.toUpperCase(), subscriber.pagePath].filter(Boolean).join(' · ') || 'No page context'}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${providerStatusClass(subscriber.providerSyncStatus)}`}>
                          {subscriber.providerSyncStatus === 'not_configured'
                            ? 'No provider connected'
                            : `${subscriber.providerName || 'Provider'}: ${labelize(subscriber.providerSyncStatus)}`}
                        </span>
                        {subscriber.providerError && (
                          <p className="mt-2 max-w-md text-xs leading-5 text-red-100">{subscriber.providerError}</p>
                        )}
                      </td>
                      <td className="px-3 py-4">
                        <p>{formatDateTime(subscriber.consentAt)}</p>
                        <p className="mt-1 text-xs text-gray-500">Created {formatDateTime(subscriber.createdAt)}</p>
                      </td>
                      <td className="px-3 py-4">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold uppercase text-gray-200">
                          {subscriber.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-sm text-gray-300">
                No newsletter subscribers yet. New footer registrations will appear here.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default VisitorEngagementTab;
