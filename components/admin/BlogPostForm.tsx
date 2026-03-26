import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronUp, ChevronDown, Info, Settings, FileText, Globe, Loader2, Sparkles } from 'lucide-react';
import { BlogPost, BlogPostSection, BlogPostFaq, BlogPostTranslation } from '../../types';
import { translateText, DeepLTargetLang } from '../../services/deepl';

export interface BlogPostFormValues extends Omit<BlogPost, 'id'> {
  id?: string;
}

interface BlogPostFormProps {
  initialValues?: BlogPost;
  onSubmit: (values: BlogPostFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

type EditLanguage = 'sq' | 'en' | 'it';

interface LangContent {
  title: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  sections: {
    id: string;
    heading: string;
    content: string; // Will be split into paragraphs
    highlight: string;
    listItems: string; // Will be split into items
  }[];
  faqs: BlogPostFaq[];
}

interface BlogPostFormState {
  author: string;
  date: string;
  imageUrl: string;
  slug: string;
  readTime: string;
  tags: string;

  // Language specific fields
  sq: LangContent;
  en: LangContent;
  it: LangContent;
}

const defaultSection = () => ({
  id: Math.random().toString(36).substr(2, 9),
  heading: '',
  content: '',
  highlight: '',
  listItems: '',
});

const defaultLangContent = (): LangContent => ({
  title: '',
  excerpt: '',
  metaTitle: '',
  metaDescription: '',
  focusKeyword: '',
  canonicalUrl: '',
  metaRobots: 'index, follow',
  sections: [defaultSection()],
  faqs: [],
});

const defaultState: BlogPostFormState = {
  author: '',
  date: new Date().toISOString().split('T')[0],
  imageUrl: '',
  slug: '',
  readTime: '5 minuta lexim',
  tags: '',
  sq: defaultLangContent(),
  en: defaultLangContent(),
  it: defaultLangContent(),
};

const mapDBSectionToForm = (sections?: BlogPostSection[]) => {
  if (!sections || !sections.length) return [defaultSection()];
  return sections.map(s => ({
    id: s.id,
    heading: s.heading,
    content: s.paragraphs?.join('\n') ?? '',
    highlight: s.highlight ?? '',
    listItems: s.list?.items?.join('\n') ?? '',
  }));
};

const mapFormSectionToDB = (sections: LangContent['sections']): BlogPostSection[] => {
  return sections.map(s => ({
    id: s.id,
    heading: s.heading.trim(),
    paragraphs: s.content.split('\n').map(p => p.trim()).filter(Boolean),
    highlight: s.highlight.trim() || undefined,
    list: s.listItems.trim() ? {
      items: s.listItems.split('\n').map(i => i.trim()).filter(Boolean)
    } : undefined
  }));
};

const mapDBTranslationToForm = (t?: BlogPostTranslation): LangContent => {
  if (!t) return defaultLangContent();
  return {
    title: t.title ?? '',
    excerpt: t.excerpt ?? '',
    metaTitle: t.metaTitle ?? '',
    metaDescription: t.metaDescription ?? '',
    focusKeyword: t.focusKeyword ?? '',
    canonicalUrl: t.canonicalUrl ?? '',
    metaRobots: t.metaRobots ?? 'index, follow',
    sections: mapDBSectionToForm(t.sections),
    faqs: t.faqs ?? [],
  };
};

const BlogPostForm: React.FC<BlogPostFormProps> = ({ initialValues, onSubmit, onCancel, isSubmitting }) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<BlogPostFormState>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'faq'>('content');
  const [currentLang, setCurrentLang] = useState<EditLanguage>('sq');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialValues) {
      setFormState(defaultState);
      return;
    }

    setFormState({
      author: initialValues.author ?? '',
      date: initialValues.date ?? '',
      imageUrl: initialValues.imageUrl ?? '',
      slug: initialValues.slug ?? '',
      readTime: initialValues.readTime ?? '5 minuta lexim',
      tags: initialValues.tags?.join(', ') ?? '',
      sq: {
        title: initialValues.title ?? '',
        excerpt: initialValues.excerpt ?? '',
        metaTitle: initialValues.metaTitle ?? '',
        metaDescription: initialValues.metaDescription ?? '',
        focusKeyword: initialValues.focusKeyword ?? '',
        canonicalUrl: initialValues.canonicalUrl ?? '',
        metaRobots: initialValues.metaRobots ?? 'index, follow',
        sections: mapDBSectionToForm(initialValues.sections),
        faqs: initialValues.faqs ?? [],
      },
      en: mapDBTranslationToForm(initialValues.translations?.en),
      it: mapDBTranslationToForm(initialValues.translations?.it),
    });
  }, [initialValues]);

  const handleChangeGlobal = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleChangeLanguageContent = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => {
      const nextLang = { ...prev[currentLang], [name]: value };
      const nextState = { ...prev, [currentLang]: nextLang };

      // Auto-generate slug and meta from Albanian title if not manually edited
      if (name === 'title' && currentLang === 'sq') {
        if (!initialValues?.slug && !prev.slug) {
          nextState.slug = value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/gi, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        }
        if (!initialValues?.metaTitle && !prev.sq.metaTitle) {
          nextState.sq.metaTitle = value;
        }
      }
      return nextState;
    });
  };

  const updateSection = (index: number, field: string, value: string) => {
    setFormState(prev => {
      const newSections = [...prev[currentLang].sections];
      newSections[index] = { ...newSections[index], [field]: value };
      return { ...prev, [currentLang]: { ...prev[currentLang], sections: newSections } };
    });
  };

  const addSection = () => {
    setFormState(prev => ({
      ...prev,
      [currentLang]: { ...prev[currentLang], sections: [...prev[currentLang].sections, defaultSection()] }
    }));
  };

  const removeSection = (index: number) => {
    setFormState(prev => {
      if (prev[currentLang].sections.length <= 1) return prev;
      return {
        ...prev,
        [currentLang]: { ...prev[currentLang], sections: prev[currentLang].sections.filter((_, i) => i !== index) }
      };
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setFormState(prev => {
      const newSections = [...prev[currentLang].sections];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newSections.length) return prev;

      [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
      return { ...prev, [currentLang]: { ...prev[currentLang], sections: newSections } };
    });
  };

  const addFaq = () => {
    setFormState(prev => ({
      ...prev,
      [currentLang]: { ...prev[currentLang], faqs: [...prev[currentLang].faqs, { question: '', answer: '' }] }
    }));
  };

  const updateFaq = (index: number, field: string, value: string) => {
    setFormState(prev => {
      const newFaqs = [...prev[currentLang].faqs];
      newFaqs[index] = { ...newFaqs[index], [field]: value } as BlogPostFaq;
      return { ...prev, [currentLang]: { ...prev[currentLang], faqs: newFaqs } };
    });
  };

  const removeFaq = (index: number) => {
    setFormState(prev => ({
      ...prev,
      [currentLang]: { ...prev[currentLang], faqs: prev[currentLang].faqs.filter((_, i) => i !== index) }
    }));
  };

  const handleAutoTranslate = async () => {
    if (currentLang === 'sq') return;
    setTranslationError(null);
    setIsTranslating(true);

    try {
      const targetLang: DeepLTargetLang = currentLang === 'en' ? 'EN-US' : 'IT';
      const src = formState.sq;
      const tl = async (text: string) => await translateText(text, targetLang, false);

      const newTitle = await tl(src.title);
      const newExcerpt = await tl(src.excerpt);
      const newMetaTitle = await tl(src.metaTitle);
      const newMetaDesc = await tl(src.metaDescription);
      const newFocusKeyword = src.focusKeyword ? await tl(src.focusKeyword) : '';

      const newSections = await Promise.all(src.sections.map(async (s) => ({
        id: s.id, // Keep the same section IDs for sanity, though not strictly required
        heading: await tl(s.heading),
        content: await tl(s.content), // Translating split text blocks
        highlight: await tl(s.highlight),
        listItems: await tl(s.listItems),
      })));

      const newFaqs = await Promise.all(src.faqs.map(async (f) => ({
        question: await tl(f.question),
        answer: await tl(f.answer),
      })));

      setFormState(prev => ({
        ...prev,
        [currentLang]: {
          title: newTitle,
          excerpt: newExcerpt,
          metaTitle: newMetaTitle,
          metaDescription: newMetaDesc,
          focusKeyword: newFocusKeyword,
          canonicalUrl: src.canonicalUrl, // Don't translate URLs
          metaRobots: src.metaRobots, // Don't translate standard robot strings
          sections: newSections,
          faqs: newFaqs
        }
      }));
    } catch (err: any) {
      setTranslationError(err.message || 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formState.sq.title.trim()) nextErrors.title = t('admin.required');
    if (!formState.author.trim()) nextErrors.author = t('admin.required');
    if (!formState.date.trim()) nextErrors.date = t('admin.required');

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      setCurrentLang('sq'); // Switch to main lang to show errors
      return;
    }

    const mapLangPayload = (langData: LangContent) => ({
      title: langData.title.trim(),
      excerpt: langData.excerpt.trim() || langData.sections[0]?.content.split('\n')[0] || '',
      metaTitle: langData.metaTitle.trim(),
      metaDescription: langData.metaDescription.trim(),
      focusKeyword: langData.focusKeyword?.trim() || undefined,
      canonicalUrl: langData.canonicalUrl?.trim() || undefined,
      metaRobots: langData.metaRobots?.trim() || 'index, follow',
      sections: mapFormSectionToDB(langData.sections),
      faqs: langData.faqs.filter(f => f.question.trim() && f.answer.trim()),
    });

    const sqPayload = mapLangPayload(formState.sq);
    const enPayload = mapLangPayload(formState.en);
    const itPayload = mapLangPayload(formState.it);

    const payload: BlogPostFormValues = {
      ...sqPayload,
      author: formState.author.trim(),
      date: formState.date,
      imageUrl: formState.imageUrl.trim(),
      slug: formState.slug.trim(),
      readTime: formState.readTime.trim(),
      tags: formState.tags.split(',').map(t => t.trim()).filter(Boolean),
      translations: {
        en: enPayload,
        it: itPayload,
      }
    };

    if (initialValues?.id) payload.id = initialValues.id;
    await onSubmit(payload);
  };

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-cyan transition-colors";
  const labelClass = "block text-sm font-medium text-gray-400 mb-1";
  
  const curLangData = formState[currentLang];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {/* Language Switcher */}
      <div className="flex border-b border-white/10">
        {[
          { id: 'sq', label: 'Albanian (Shqip)' },
          { id: 'en', label: 'English' },
          { id: 'it', label: 'Italiano' }
        ].map(lang => (
          <button
            key={lang.id}
            type="button"
            onClick={() => setCurrentLang(lang.id as EditLanguage)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors border-b-2 ${
              currentLang === lang.id
                ? 'border-gray-cyan text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Globe size={16} />
            {lang.label}
          </button>
        ))}
      </div>

      {currentLang !== 'sq' && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 flex items-center justify-between">
          <p className="text-sm text-blue-200">
            You are editing the <strong>{currentLang.toUpperCase()}</strong> translation. Start with auto-translate, then refine manually.
          </p>
          <button
            type="button"
            onClick={handleAutoTranslate}
            disabled={isTranslating}
            className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/30 hover:text-white disabled:opacity-50"
          >
            {isTranslating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Auto-Translate from Albanian
          </button>
        </div>
      )}
      {translationError && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
          {translationError}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 rounded-xl bg-white/5 p-1">
        {[
          { id: 'content', icon: FileText, label: t('admin.tabs.content', { defaultValue: 'Main Content' }) },
          { id: 'faq', icon: Info, label: t('admin.tabs.faq', { defaultValue: 'FAQs' }) },
          { id: 'seo', icon: Settings, label: t('admin.tabs.seo', { defaultValue: 'SEO & Meta' }) },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
              ${activeTab === tab.id
                ? 'bg-gray-cyan text-white shadow'
                : 'text-gray-400 hover:bg-white/[0.08] hover:text-white'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {activeTab === 'content' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('admin.fields.title')} ({currentLang.toUpperCase()})</label>
                <input name="title" value={curLangData.title} onChange={handleChangeLanguageContent} className={inputClass} />
                {currentLang === 'sq' && errors.title && <span className="text-xs text-red-400">{errors.title}</span>}
              </div>
              
              {/* Global Fields - Only editable in base language for sanity, or shown in all but syncing. Better show them in all. */}
              <div>
                <label className={labelClass}>{t('admin.fields.author')}</label>
                <input name="author" value={formState.author} onChange={handleChangeGlobal} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('admin.fields.publishDate')}</label>
                <input type="date" name="date" value={formState.date} onChange={handleChangeGlobal} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('admin.fields.imageUrl')}</label>
                <input name="imageUrl" value={formState.imageUrl} onChange={handleChangeGlobal} className={inputClass} placeholder="https://..." />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-lg font-bold text-white">{t('admin.sections.contentSections', { defaultValue: 'Content Sections' })} ({currentLang.toUpperCase()})</h3>
                <button
                  type="button"
                  onClick={addSection}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-cyan hover:text-white"
                >
                  <Plus size={16} /> {t('admin.actions.addSection', { defaultValue: 'Add Section' })}
                </button>
              </div>

              {curLangData.sections.map((section, idx) => (
                <div key={section.id} className="relative rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm transition-all hover:bg-white/[0.07]">
                  <div className="absolute right-4 top-4 flex gap-2">
                    <button type="button" onClick={() => moveSection(idx, 'up')} className="text-gray-400 hover:text-white disabled:opacity-30" disabled={idx === 0}><ChevronUp size={18} /></button>
                    <button type="button" onClick={() => moveSection(idx, 'down')} className="text-gray-400 hover:text-white disabled:opacity-30" disabled={idx === curLangData.sections.length - 1}><ChevronDown size={18} /></button>
                    <button type="button" onClick={() => removeSection(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                  </div>

                  <div className="mt-2 space-y-4">
                    <div>
                      <label className={labelClass}>{t('admin.fields.sectionHeading', { defaultValue: 'Heading' })}</label>
                      <input
                        value={section.heading}
                        onChange={(e) => updateSection(idx, 'heading', e.target.value)}
                        className={inputClass}
                        placeholder={t('admin.placeholders.sectionHeading', { defaultValue: 'Optional heading...' })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t('admin.fields.sectionContent', { defaultValue: 'Paragraphs (new line for new paragraph)' })}</label>
                      <textarea
                        value={section.content}
                        onChange={(e) => updateSection(idx, 'content', e.target.value)}
                        className={`${inputClass} min-h-[150px] font-sans`}
                        placeholder={t('admin.placeholders.sectionContent', { defaultValue: 'Write your story here...' })}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={labelClass}>{t('admin.fields.sectionHighlight', { defaultValue: 'Highlight (Quote/Note)' })}</label>
                        <input
                          value={section.highlight}
                          onChange={(e) => updateSection(idx, 'highlight', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('admin.fields.sectionList', { defaultValue: 'List Items (one per line)' })}</label>
                        <textarea
                          rows={2}
                          value={section.listItems}
                          onChange={(e) => updateSection(idx, 'listItems', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="text-lg font-bold text-white">{t('admin.sections.faqs', { defaultValue: 'Frequently Asked Questions' })} ({currentLang.toUpperCase()})</h3>
              <button type="button" onClick={addFaq} className="flex items-center gap-2 text-sm font-semibold text-gray-cyan hover:text-white">
                <Plus size={16} /> {t('admin.actions.addFaq', { defaultValue: 'Add Question' })}
              </button>
            </div>
            {curLangData.faqs.map((faq, idx) => (
              <div key={idx} className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="flex justify-between">
                  <span className="text-xs font-bold text-gray-500 uppercase">Q&A #{idx + 1}</span>
                  <button type="button" onClick={() => removeFaq(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                </div>
                <input
                  className={inputClass}
                  placeholder="Question..."
                  value={faq.question}
                  onChange={(e) => updateFaq(idx, 'question', e.target.value)}
                />
                <textarea
                  className={inputClass}
                  placeholder="Answer..."
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => updateFaq(idx, 'answer', e.target.value)}
                />
              </div>
            ))}
            {curLangData.faqs.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">{t('admin.messages.noFaqs', { defaultValue: 'No FAQs added yet.' })}</p>
            )}
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('admin.fields.slug')} (Global)</label>
              <input name="slug" value={formState.slug} onChange={handleChangeGlobal} className={inputClass} placeholder="my-awesome-post" />
              <p className="mt-1 text-[10px] text-gray-500">URL path: /blog/{formState.slug}</p>
            </div>
            <div>
              <label className={labelClass}>{t('admin.fields.readTime')} (Global)</label>
              <input name="readTime" value={formState.readTime} onChange={handleChangeGlobal} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('admin.fields.tags')} (Global)</label>
              <input name="tags" value={formState.tags} onChange={handleChangeGlobal} className={inputClass} placeholder="EV, Tech, News (comma separated)" />
            </div>
            <div className="pt-4 border-t border-white/10">
              <h3 className="mb-4 font-bold text-white">{t('admin.sections.metaMetadata', { defaultValue: 'Search Engine Preview' })} ({currentLang.toUpperCase()})</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{t('admin.fields.metaTitle')}</label>
                  <input name="metaTitle" value={curLangData.metaTitle} onChange={handleChangeLanguageContent} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('admin.fields.metaDescription')}</label>
                  <textarea name="metaDescription" value={curLangData.metaDescription} onChange={handleChangeLanguageContent} className={inputClass} rows={3} />
                </div>
                <div>
                  <label className={labelClass}>
                    {t('admin.fields.focusKeyword', { defaultValue: 'Focus Keyword' })}
                    <div className="group relative ml-2 inline-block">
                      <Info size={14} className="text-gray-400 hover:text-white" />
                      <div className="absolute left-1/2 -ml-24 bottom-full mb-2 hidden w-48 rounded bg-gray-800 p-2 text-xs text-white group-hover:block z-50">
                        {t('admin.tooltips.focusKeyword', { defaultValue: 'The main keyword you want to rank for on Google/Bing.' })}
                      </div>
                    </div>
                  </label>
                  <input name="focusKeyword" value={curLangData.focusKeyword || ''} onChange={handleChangeLanguageContent} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>
                    {t('admin.fields.canonicalUrl', { defaultValue: 'Canonical URL' })}
                    <div className="group relative ml-2 inline-block">
                      <Info size={14} className="text-gray-400 hover:text-white" />
                      <div className="absolute left-1/2 -ml-24 bottom-full mb-2 hidden w-48 rounded bg-gray-800 p-2 text-xs text-white group-hover:block z-50">
                        {t('admin.tooltips.canonicalUrl', { defaultValue: 'Set if this content originally appeared elsewhere. Prevents duplicate content issues.' })}
                      </div>
                    </div>
                  </label>
                  <input name="canonicalUrl" value={curLangData.canonicalUrl || ''} onChange={handleChangeLanguageContent} className={inputClass} placeholder="https://..." />
                </div>
                <div>
                  <label className={labelClass}>
                    {t('admin.fields.metaRobots', { defaultValue: 'Meta Robots' })}
                    <div className="group relative ml-2 inline-block">
                      <Info size={14} className="text-gray-400 hover:text-white" />
                      <div className="absolute left-1/2 -ml-24 bottom-full mb-2 hidden w-48 rounded bg-gray-800 p-2 text-xs text-white group-hover:block z-50">
                        {t('admin.tooltips.metaRobots', { defaultValue: 'Control crawler behavior (e.g., index, follow, noindex, nofollow).' })}
                      </div>
                    </div>
                  </label>
                  <select name="metaRobots" value={curLangData.metaRobots || 'index, follow'} onChange={handleChangeLanguageContent as any} className={inputClass}>
                    <option value="index, follow">Index, Follow</option>
                    <option value="noindex, follow">Noindex, Follow</option>
                    <option value="index, nofollow">Index, Nofollow</option>
                    <option value="noindex, nofollow">Noindex, Nofollow</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/5 px-6 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
        >
          {t('admin.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-gray-cyan px-6 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? `${t('admin.save')}...` : t('admin.save')}
        </button>
      </div>
    </form>
  );
};

export default BlogPostForm;
