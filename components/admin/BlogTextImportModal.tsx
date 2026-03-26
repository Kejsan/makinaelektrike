import React, { ChangeEvent, useRef, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileText, Loader2, Upload, Download } from 'lucide-react';
import { DataContext } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { BlogPost } from '../../types';

interface BlogTextImportModalProps {
  onClose: () => void;
}

const TEMPLATE_CONTENT = `=== BLOG ===
Title: Shembull Titulli për Blogun
Slug: shembull-titulli
Excerpt: Përmbledhje e shkurtër (1-2 fjali).
Author: Admin
Date: 2024-03-24
ReadTime: 5 minuta lexim
ImageUrl: https://example.com/image.jpg
MetaTitle: Meta Titulli i SEO
MetaDescription: Meta Përshkrimi i SEO...
FocusKeyword: fjala kyc
CanonicalUrl: 
MetaRobots: index, follow
Tags: EV, Teknologji

--- SECTIONS ---

## Seksioni 1
Highlight: Tekst i theksuar opsional.
ListItems: (mbaj 1 per rresht, ndaje me \`-\`)
- Pika 1
- Pika 2
Këtu fillon teksti i paragrafit të parë. 
Mund të ketë disa paragrafë njëri pas tjetrit pa problem.

## Seksioni 2
Këtu është përmbajtja e dytë.

--- FAQS ---
Q: Pyetja e parë këtu?
A: Përgjigjja e parë këtu.

Q: Pyetja e dytë?
A: Përgjigjja e dytë.
=== END BLOG ===
`;

// Helper to parse the uploaded text chunk
const parseBlogChunk = (chunk: string, ownerUid: string | null): Partial<Omit<BlogPost, 'id'>> => {
  const blog: any = { published: true, sections: [], faqs: [] };
  
  const sectionsSplit = chunk.split('--- SECTIONS ---');
  if (sectionsSplit.length < 2) throw new Error("Missing '--- SECTIONS ---' divider.");
  
  const headerPart = sectionsSplit[0].trim();
  const restPart = sectionsSplit[1].trim();
  
  const faqsSplit = restPart.split('--- FAQS ---');
  const sectionsPart = faqsSplit[0].trim();
  const faqsPart = faqsSplit.length > 1 ? faqsSplit[1].trim() : '';

  // Parse header
  const headerLines = headerPart.split('\n');
  headerLines.forEach(line => {
    const splitIndex = line.indexOf(':');
    if (splitIndex !== -1) {
      const key = line.slice(0, splitIndex).trim();
      const value = line.slice(splitIndex + 1).trim();
      if (!value) return;

      switch(key) {
        case 'Title': blog.title = value; break;
        case 'Slug': blog.slug = value; break;
        case 'Excerpt': blog.excerpt = value; break;
        case 'Author': blog.author = value; break;
        case 'Date': blog.date = value; break;
        case 'ReadTime': blog.readTime = value; break;
        case 'ImageUrl': blog.imageUrl = value; break;
        case 'MetaTitle': blog.metaTitle = value; break;
        case 'MetaDescription': blog.metaDescription = value; break;
        case 'FocusKeyword': blog.focusKeyword = value; break;
        case 'CanonicalUrl': blog.canonicalUrl = value; break;
        case 'MetaRobots': blog.metaRobots = value; break;
        case 'Tags': blog.tags = value.split(',').map(t => t.trim()); break;
      }
    }
  });

  // Parse Sections
  const sectionChunks = sectionsPart.split('## ').filter(s => s.trim().length > 0);
  sectionChunks.forEach(sc => {
    const lines = sc.split('\n');
    const heading = lines[0].trim();
    let highlight = '';
    const listItems: string[] = [];
    const contents: string[] = [];

    let insideList = false;
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith('Highlight:')) {
        highlight = l.substring('Highlight:'.length).trim();
      } else if (l.startsWith('ListItems:')) {
        insideList = true;
      } else if (insideList && l.startsWith('-')) {
        listItems.push(l.substring(1).trim());
      } else {
        if (l) insideList = false; // exit list tracking when content begins
        if (l) contents.push(l);
      }
    }

    blog.sections.push({
      id: Math.random().toString(36).substr(2, 9),
      heading,
      paragraphs: contents,
      highlight: highlight || undefined,
      list: listItems.length > 0 ? { items: listItems } : undefined
    });
  });

  // Parse FAQs
  if (faqsPart) {
    const faqBlocks = faqsPart.split('Q:').filter(f => f.trim().length > 0);
    faqBlocks.forEach(fb => {
      const qSplit = fb.split('A:');
      if (qSplit.length === 2) {
        blog.faqs.push({
          question: qSplit[0].trim(),
          answer: qSplit[1].trim()
        });
      }
    });
  }

  // Set ownership
  if (ownerUid) {
    blog.ownerUid = ownerUid;
    blog.createdBy = ownerUid;
    blog.updatedBy = ownerUid;
  }

  return blog;
};

const BlogTextImportModal: React.FC<BlogTextImportModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addBlogPost } = useContext(DataContext);
  const { addToast } = useToast();

  const [importing, setImporting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ processed: number; succeeded: number; failed: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const downloadTemplate = () => {
    const element = document.createElement("a");
    const file = new Blob([TEMPLATE_CONTENT], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "blog_template.txt";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileError(null);
    setSummary(null);

    const text = await file.text();
    const blogChunks = text.split('=== BLOG ===').filter(chunk => chunk.trim().length > 0);
    
    if (blogChunks.length === 0) {
      setFileError("No blocks starting with '=== BLOG ===' found.");
      return;
    }

    setImporting(true);
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let index = 0; index < blogChunks.length; index++) {
      let chunk = blogChunks[index];
      // remove the trailing === END BLOG === if present
      chunk = chunk.split('=== END BLOG ===')[0].trim();
      
      if (!chunk) continue;

      try {
        const payload = parseBlogChunk(chunk, user?.uid || null);
        if (!payload.title || !payload.slug) {
          throw new Error("Missing Title or Slug in the header.");
        }

        await addBlogPost(payload as any);
        succeeded++;
      } catch (err: any) {
        failed++;
        errors.push(`Blog ${index + 1}: ${err.message}`);
      }
    }

    setSummary({ processed: succeeded + failed, succeeded, failed });
    
    if (errors.length > 0) {
      addToast(`Import completed with ${failed} errors. Check console for details.`, 'warning');
      console.error("Bulk Blog Import Errors:", errors);
    } else if (succeeded > 0) {
      addToast(`Successfully imported ${succeeded} blogs!`, 'success');
    }

    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
        <h3 className="mb-2 font-bold text-blue-200">How to use Text Bulk Import</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-300">
          <li><strong>Download Template</strong> to see the exact required text format.</li>
          <li>Write your blogs in the <code>.txt</code> file following the structure.</li>
          <li>For multiple blogs, separate them using <code>=== BLOG ===</code> and <code>=== END BLOG ===</code> markers.</li>
          <li><strong>Upload</strong> the completed <code>.txt</code> file below. Auto-translation can be done later by editing them one by one, or extending logic in the future.</li>
        </ol>
        
        <button
          onClick={downloadTemplate}
          className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Download size={16} />
          Download Template.txt
        </button>
      </div>

      <div className="rounded-xl border border-dashed border-gray-600 bg-black/20 p-8 text-center transition hover:bg-white/5">
        <input
          type="file"
          accept=".txt,.md"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={importing}
        />

        {importing ? (
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-gray-cyan" />
            <p className="text-sm text-gray-400">Importing blogs... Please wait.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="rounded-full bg-white/5 p-3 text-gray-400">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-2">Upload your completed `.txt` file</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-gray-500"
              >
                <Upload size={14} /> Select File
              </button>
            </div>
          </div>
        )}
      </div>

      {fileError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
          <AlertTriangle size={18} />
          <p>{fileError}</p>
        </div>
      )}

      {summary && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h4 className="mb-3 font-semibold text-white">Import Summary</h4>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-black/20 p-3 text-center">
              <p className="text-2xl font-bold text-white">{summary.processed}</p>
              <p className="text-xs text-gray-400">Total Found</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-3 text-center border border-green-500/20">
              <p className="text-2xl font-bold text-green-400">{summary.succeeded}</p>
              <p className="text-xs text-green-500/80">Imported</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center border border-red-500/20">
              <p className="text-2xl font-bold text-red-400">{summary.failed}</p>
              <p className="text-xs text-red-500/80">Failed</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-white/10">
        <button
          onClick={onClose}
          disabled={importing}
          className="rounded-lg border border-white/10 bg-white/5 px-6 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
        >
          {summary ? 'Close' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

export default BlogTextImportModal;
