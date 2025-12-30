import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, ChevronUp, ChevronDown, Info, Settings, FileText } from 'lucide-react';
import { BlogPost, BlogPostSection, BlogPostFaq } from '../../types';

export interface BlogPostFormValues extends Omit<BlogPost, 'id'> {
  id?: string;
}

interface BlogPostFormProps {
  initialValues?: BlogPost;
  onSubmit: (values: BlogPostFormValues) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

interface BlogPostFormState {
  title: string;
  excerpt: string;
  author: string;
  date: string;
  imageUrl: string;
  slug: string;
  readTime: string;
  metaTitle: string;
  metaDescription: string;
  tags: string;
  sections: {
    id: string;
    heading: string;
    content: string; // Will be split into paragraphs
    highlight: string;
    listItems: string; // Will be split into items
  }[];
  faqs: BlogPostFaq[];
}

const defaultSection = () => ({
  id: Math.random().toString(36).substr(2, 9),
  heading: '',
  content: '',
  highlight: '',
  listItems: '',
});

const defaultState: BlogPostFormState = {
  title: '',
  excerpt: '',
  author: '',
  date: new Date().toISOString().split('T')[0],
  imageUrl: '',
  slug: '',
  readTime: '5 minuta lexim',
  metaTitle: '',
  metaDescription: '',
  tags: '',
  sections: [defaultSection()],
  faqs: [],
};

const BlogPostForm: React.FC<BlogPostFormProps> = ({ initialValues, onSubmit, onCancel, isSubmitting }) => {
  const { t } = useTranslation();
  const [formState, setFormState] = useState<BlogPostFormState>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'faq'>('content');

  useEffect(() => {
    if (!initialValues) {
      setFormState(defaultState);
      return;
    }

    setFormState({
      title: initialValues.title ?? '',
      excerpt: initialValues.excerpt ?? '',
      author: initialValues.author ?? '',
      date: initialValues.date ?? '',
      imageUrl: initialValues.imageUrl ?? '',
      slug: initialValues.slug ?? '',
      readTime: initialValues.readTime ?? '5 minuta lexim',
      metaTitle: initialValues.metaTitle ?? '',
      metaDescription: initialValues.metaDescription ?? '',
      tags: initialValues.tags?.join(', ') ?? '',
      sections: initialValues.sections?.length
        ? initialValues.sections.map(s => ({
          id: s.id,
          heading: s.heading,
          content: s.paragraphs?.join('\n') ?? '',
          highlight: s.highlight ?? '',
          listItems: s.list?.items?.join('\n') ?? '',
        }))
        : [defaultSection()],
      faqs: initialValues.faqs ?? [],
    });
  }, [initialValues]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => {
      const next = { ...prev, [name]: value };

      // Auto-generate slug from title if not manually edited
      if (name === 'title' && !initialValues) {
        next.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/gi, '')
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        // Also sync metaTitle and metaDescription if empty
        if (!next.metaTitle) next.metaTitle = value;
      }
      return next;
    });
  };

  const updateSection = (index: number, field: string, value: string) => {
    const newSections = [...formState.sections];
    newSections[index] = { ...newSections[index], [field]: value };
    setFormState(prev => ({ ...prev, sections: newSections }));
  };

  const addSection = () => {
    setFormState(prev => ({ ...prev, sections: [...prev.sections, defaultSection()] }));
  };

  const removeSection = (index: number) => {
    if (formState.sections.length <= 1) return;
    setFormState(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }));
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...formState.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;

    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setFormState(prev => ({ ...prev, sections: newSections }));
  };

  const addFaq = () => {
    setFormState(prev => ({ ...prev, faqs: [...prev.faqs, { question: '', answer: '' }] }));
  };

  const updateFaq = (index: number, field: string, value: string) => {
    const newFaqs = [...formState.faqs];
    newFaqs[index] = { ...newFaqs[index], [field]: value } as BlogPostFaq;
    setFormState(prev => ({ ...prev, faqs: newFaqs }));
  };

  const removeFaq = (index: number) => {
    setFormState(prev => ({ ...prev, faqs: prev.faqs.filter((_, i) => i !== index) }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!formState.title.trim()) nextErrors.title = t('admin.required');
    if (!formState.author.trim()) nextErrors.author = t('admin.required');
    if (!formState.date.trim()) nextErrors.date = t('admin.required');

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: BlogPostFormValues = {
      title: formState.title.trim(),
      excerpt: formState.excerpt.trim() || formState.sections[0]?.content.split('\n')[0] || '',
      author: formState.author.trim(),
      date: formState.date,
      imageUrl: formState.imageUrl.trim(),
      slug: formState.slug.trim(),
      readTime: formState.readTime.trim(),
      metaTitle: formState.metaTitle.trim(),
      metaDescription: formState.metaDescription.trim(),
      tags: formState.tags.split(',').map(t => t.trim()).filter(Boolean),
      sections: formState.sections.map(s => ({
        id: s.id,
        heading: s.heading.trim(),
        paragraphs: s.content.split('\n').map(p => p.trim()).filter(Boolean),
        highlight: s.highlight.trim() || undefined,
        list: s.listItems.trim() ? {
          items: s.listItems.split('\n').map(i => i.trim()).filter(Boolean)
        } : undefined
      })),
      faqs: formState.faqs.filter(f => f.question.trim() && f.answer.trim()),
    };

    if (initialValues?.id) payload.id = initialValues.id;
    await onSubmit(payload);
  };

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-cyan";
  const labelClass = "block text-sm font-medium text-gray-400 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
              <div>
                <label className={labelClass}>{t('admin.fields.title')}</label>
                <input name="title" value={formState.title} onChange={handleChange} className={inputClass} />
                {errors.title && <span className="text-xs text-red-400">{errors.title}</span>}
              </div>
              <div>
                <label className={labelClass}>{t('admin.fields.author')}</label>
                <input name="author" value={formState.author} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('admin.fields.publishDate')}</label>
                <input type="date" name="date" value={formState.date} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>{t('admin.fields.imageUrl')}</label>
                <input name="imageUrl" value={formState.imageUrl} onChange={handleChange} className={inputClass} placeholder="https://..." />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="text-lg font-bold text-white">{t('admin.sections.contentSections', { defaultValue: 'Content Sections' })}</h3>
                <button
                  type="button"
                  onClick={addSection}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-cyan hover:text-white"
                >
                  <Plus size={16} /> {t('admin.actions.addSection', { defaultValue: 'Add Section' })}
                </button>
              </div>

              {formState.sections.map((section, idx) => (
                <div key={section.id} className="relative rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm transition-all hover:bg-white/[0.07]">
                  <div className="absolute right-4 top-4 flex gap-2">
                    <button type="button" onClick={() => moveSection(idx, 'up')} className="text-gray-400 hover:text-white disabled:opacity-30" disabled={idx === 0}><ChevronUp size={18} /></button>
                    <button type="button" onClick={() => moveSection(idx, 'down')} className="text-gray-400 hover:text-white disabled:opacity-30" disabled={idx === formState.sections.length - 1}><ChevronDown size={18} /></button>
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
              <h3 className="text-lg font-bold text-white">{t('admin.sections.faqs', { defaultValue: 'Frequently Asked Questions' })}</h3>
              <button type="button" onClick={addFaq} className="flex items-center gap-2 text-sm font-semibold text-gray-cyan hover:text-white">
                <Plus size={16} /> {t('admin.actions.addFaq', { defaultValue: 'Add Question' })}
              </button>
            </div>
            {formState.faqs.map((faq, idx) => (
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
            {formState.faqs.length === 0 && (
              <p className="py-4 text-center text-sm text-gray-500">{t('admin.messages.noFaqs', { defaultValue: 'No FAQs added yet.' })}</p>
            )}
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>{t('admin.fields.slug')}</label>
              <input name="slug" value={formState.slug} onChange={handleChange} className={inputClass} placeholder="my-awesome-post" />
              <p className="mt-1 text-[10px] text-gray-500">URL path: /blog/{formState.slug}</p>
            </div>
            <div>
              <label className={labelClass}>{t('admin.fields.readTime')}</label>
              <input name="readTime" value={formState.readTime} onChange={handleChange} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('admin.fields.tags')}</label>
              <input name="tags" value={formState.tags} onChange={handleChange} className={inputClass} placeholder="EV, Tech, News (comma separated)" />
            </div>
            <div className="pt-4 border-t border-white/10">
              <h3 className="mb-4 font-bold text-white">{t('admin.sections.metaMetadata', { defaultValue: 'Search Engine Preview' })}</h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>{t('admin.fields.metaTitle')}</label>
                  <input name="metaTitle" value={formState.metaTitle} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>{t('admin.fields.metaDescription')}</label>
                  <textarea name="metaDescription" value={formState.metaDescription} onChange={handleChange} className={inputClass} rows={3} />
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
