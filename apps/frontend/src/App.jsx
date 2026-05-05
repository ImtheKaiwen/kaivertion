import { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileText, Image as ImageIcon, Download, RefreshCw,
  CheckCircle2, Sparkles, X, Search, Zap, LayoutGrid, ChevronLeft,
  FileStack, Settings2, Lock, Cpu, Globe, Mail, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

const CATEGORIES = [
  {
    id: 'pdf',
    name: 'PDF Tools',
    icon: FileText,
    accent: '#FF3B30',
    tools: [
      { id: 'pdf-to-word', name: 'To Word', desc: 'DOCX', accept: '.pdf' },
      { id: 'pdf-to-excel', name: 'To Excel', desc: 'XLSX', accept: '.pdf' },
      { id: 'pdf-protect', name: 'Protect', desc: 'Lock', accept: '.pdf', needs: ['password'] },
    ]
  },
  {
    id: 'image',
    name: 'Image Tools',
    icon: ImageIcon,
    accent: '#007AFF',
    tools: [
      { id: 'img-to-jpg', name: 'To JPG', desc: 'Convert', accept: '.png,.webp,.bmp' },
      { id: 'img-to-png', name: 'To PNG', desc: 'Convert', accept: '.jpg,.jpeg,.webp' },
      { id: 'img-to-webp', name: 'To WebP', desc: 'Convert', accept: '.png,.jpg,.jpeg' },
      { id: 'img-to-pdf', name: 'To PDF', desc: 'Convert', accept: 'image/*' },
      { id: 'img-resize', name: 'Resize', desc: 'Size', accept: 'image/*', needs: ['width', 'height'] },
      { id: 'img-remove-bg', name: 'Remove BG', desc: 'AI', accept: 'image/*' },
    ]
  },
  {
    id: 'office',
    name: 'Office Hub',
    icon: FileStack,
    accent: '#34C759',
    tools: [
      { id: 'word-to-pdf', name: 'Word to PDF', desc: 'DOCX', accept: '.docx,.doc' },
      { id: 'excel-to-pdf', name: 'Excel to PDF', desc: 'XLSX', accept: '.xlsx,.xls' },
      { id: 'pptx-to-pdf', name: 'PPTX to PDF', desc: 'PPTX', accept: '.pptx,.ppt' },
    ]
  },
  {
    id: 'utils',
    name: 'Utilities',
    icon: Settings2,
    accent: '#5856D6',
    tools: [
      { id: 'qr-generate', name: 'QR Code', desc: 'Generate', accept: '', needs: ['text'] },
      { id: 'svg-to-png', name: 'SVG to PNG', desc: 'Convert', accept: '.svg' },
      { id: 'pdf-to-text', name: 'Extract Text', desc: 'PDF to TXT', accept: '.pdf' },
    ]
  }
];

export default function App() {
  const [view, setView] = useState('landing');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [config, setConfig] = useState({ width: 800, height: 600, password: '', text: '', pages: 'all' });
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isHomeHovered, setIsHomeHovered] = useState(false);
  const [showIslandLogo, setShowIslandLogo] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowIslandLogo(window.scrollY > 150);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const reset = () => {
    setView('landing'); setFile(null); setFiles([]); setSelectedTool(null);
    setResult(null); setError(null); setSearchQuery(''); setIsSearchExpanded(false);
    setConfig({ width: 800, height: 600, password: '', text: '', pages: 'all' });
  };

  const handleToolClick = (tool) => {
    setSelectedTool(tool);
    if (fileInputRef.current) {
      fileInputRef.current.accept = tool.accept || "*/*";
      fileInputRef.current.multiple = tool.multiple || false;
    }
    if (tool.id === 'qr-generate') setView('config');
    else fileInputRef.current.click();
  };

  const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.svg', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
  const MAX_SIZE = 10 * 1024 * 1024;

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      for (const f of selectedFiles) {
        const ext = '.' + f.name.split('.').pop().toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) { setError(`Unsupported: ${ext}`); e.target.value = ''; return; }
        if (f.size > MAX_SIZE) { setError(`Too large: ${f.name}`); e.target.value = ''; return; }
      }
      if (selectedTool?.multiple) { setFiles(selectedFiles); setView('config'); }
      else {
        setFile(selectedFiles[0]);
        if (view !== 'smart-detect' && !selectedTool?.needs) startTask(selectedTool?.id, selectedFiles[0]);
        else if (selectedTool?.needs) setView('config');
      }
    }
    e.target.value = '';
  };

  const startTask = async (toolId, overrideFile = null) => {
    const fToUse = overrideFile || file;
    setView('processing'); setProgress(0); setError(null);
    const fd = new FormData();
    if (selectedTool?.multiple) files.forEach(f => fd.append('files', f));
    else if (fToUse) fd.append('file', fToUse);
    fd.append('operation', toolId);
    Object.keys(config).forEach(k => { if (config[k]) fd.append(k, config[k]); });
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Alchemy failed');
      poll(data.task_id);
    } catch (e) { setError(e.message); setView('landing'); }
  };

  const poll = (id) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${id}`);
        const data = await res.json();
        if (data.status === 'SUCCESS') {
          clearInterval(timer);
          if (data.result?.error) { setError(data.result.error); setView('landing'); }
          else { setResult(data.result); setProgress(100); setView('completed'); }
        } else if (data.status === 'FAILURE') { clearInterval(timer); setError('Task failed'); setView('landing'); }
        else setProgress(p => Math.min(p + 5, 90));
      } catch (e) { }
    }, 1500);
  };

  const filteredTools = useMemo(() => {
    if (!file) return [];
    return CATEGORIES.flatMap(c => c.tools).filter(t => {
      if (!t.accept) return false;
      return t.accept.split(',').some(a => file.name.toLowerCase().endsWith(a.trim().toLowerCase()) || file.type.startsWith(a.trim().replace('/*', '')));
    });
  }, [file]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return CATEGORIES.flatMap(c => c.tools).filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  return (
    <div className="app-shell">
      <div className="island-container">
        <motion.div className={`dynamic-island ${error ? 'error-state' : ''}`}>
          <AnimatePresence mode="wait">
            {error ? (
              <motion.div key="err" className="island-error-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="island-error-header"><span>Alert</span><button className="island-close" onClick={() => setError(null)}><X size={14} /></button></div>
                <div className="island-error-body">{error}</div>
              </motion.div>
            ) : view === 'processing' ? (
              <div className="island-nav"><RefreshCw size={14} className="spin" /><span>Processing {Math.round(progress)}%</span></div>
            ) : !isSearchExpanded ? (
              <div className="island-nav">
                <a href="https://kaiwen.com.tr" className="island-item island-home-link" title="Back to Portfolio">
                  <ChevronLeft size={16} />
                  <AnimatePresence>
                    {showIslandLogo && (
                      <motion.img 
                        initial={{ opacity: 0, scale: 0, width: 0 }} 
                        animate={{ opacity: 1, scale: 1, width: 24 }} 
                        exit={{ opacity: 0, scale: 0, width: 0 }}
                        src="/kaivertion.jpg" 
                        className="island-logo-tiny" 
                      />
                    )}
                  </AnimatePresence>
                </a>
                <div className="island-divider" />
                <div 
                  className={`island-item ${view === 'landing' ? 'active' : ''}`} 
                  onClick={reset}
                >
                  <LayoutGrid size={14} />
                  <span>Home</span>
                </div>
                <div className="island-divider" />
                <div className={`island-item ${view === 'smart-detect' ? 'active' : ''}`} onClick={() => { reset(); setView('smart-detect'); fileInputRef.current.multiple = false; fileInputRef.current.accept = "*/*"; fileInputRef.current.click(); }}><Sparkles size={14} /><span>Smart</span></div>
                <div className="island-divider" />
                <div className="island-search-trigger" onClick={() => setIsSearchExpanded(true)}><Search size={14} /></div>
              </div>
            ) : (
              <div className="island-search-full">
                <Search size={14} style={{ opacity: 0.5 }} />
                <input placeholder="Search..." autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                <button className="island-close" onClick={() => { setIsSearchExpanded(false); setSearchQuery(''); }}><X size={14} /></button>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <main style={{ width: '100%', maxWidth: '750px', padding: '0 24px' }}>
        <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} />

        <AnimatePresence mode="wait">
          {searchQuery ? (
            <motion.div key="search" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card">
              <div className="category-header"><button className="back-btn" onClick={() => setSearchQuery('')}><ChevronLeft size={22} /></button><h2>Search Results</h2></div>
              <div className="tool-grid">
                {searchResults.map(t => <button key={t.id} className="tool-card-premium" onClick={() => { handleToolClick(t); setSearchQuery(''); setIsSearchExpanded(false); }}><b>{t.name}</b></button>)}
              </div>
            </motion.div>
          ) : view === 'landing' ? (
            <motion.div key="landing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card">
              <div className="hero-section">
                <span className="hero-tag">Kaivertion v2.0</span>
                <motion.img 
                  src="/kaivertion.jpg" 
                  alt="Kaivertion Logo" 
                  className="hero-logo-img" 
                  animate={{ opacity: showIslandLogo ? 0 : 1, scale: showIslandLogo ? 0.8 : 1 }}
                  transition={{ duration: 0.3 }}
                />
                <p>Private digital alchemy for your assets. Precise, secure, and instant transformations in a cloudless environment.</p>
              </div>

              <div className="features-badges">
                <div className="feature-item"><Lock size={14} /> Private</div>
                <div className="feature-item"><Cpu size={14} /> AI Powered</div>
                <div className="feature-item"><Globe size={14} /> Local</div>
              </div>

              <div className="category-grid">
                {CATEGORIES.map(cat => (
                  <div key={cat.id} className="category-card" onClick={() => { setSelectedCategory(cat); setView('category'); }}>
                    <div className="cat-icon" style={{ background: cat.accent + '15' }}><cat.icon size={20} color={cat.accent} /></div>
                    <div className="cat-info"><h3>{cat.name}</h3><p>{cat.tools.length} Operations</p></div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : view === 'category' && selectedCategory ? (
            <motion.div key="category" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card">
              <div className="category-header"><button className="back-btn" onClick={() => setView('landing')}><ChevronLeft size={22} /></button><h2>{selectedCategory.name}</h2></div>
              <div className="tool-grid">
                {selectedCategory.tools.map(t => <button key={t.id} className="tool-card-premium" onClick={() => handleToolClick(t)}><b>{t.name}</b><span>{t.desc}</span></button>)}
              </div>
            </motion.div>
          ) : view === 'config' && selectedTool ? (
            <motion.div key="config" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card">
              <div className="category-header">
                <button className="back-btn" onClick={() => setView('landing')}><ChevronLeft size={22} /></button>
                <h2>{selectedTool.name}</h2>
              </div>
              
              <div className="config-form">
                {selectedTool.id !== 'qr-generate' && (
                  <div className="form-group">
                    <label>Source Asset</label>
                    <div className="file-badge">{file?.name || 'No file selected'}</div>
                  </div>
                )}

                <div className="config-inputs-grid">
                  {selectedTool.needs?.includes('width') && (
                    <div className="form-group">
                      <label>Width (px)</label>
                      <input 
                        type="number" 
                        value={config.width} 
                        onChange={e => setConfig({...config, width: e.target.value})} 
                        placeholder="800"
                      />
                    </div>
                  )}
                  {selectedTool.needs?.includes('height') && (
                    <div className="form-group">
                      <label>Height (px)</label>
                      <input 
                        type="number" 
                        value={config.height} 
                        onChange={e => setConfig({...config, height: e.target.value})} 
                        placeholder="600"
                      />
                    </div>
                  )}
                  {selectedTool.needs?.includes('password') && (
                    <div className="form-group">
                      <label>Password</label>
                      <input 
                        type="password" 
                        value={config.password} 
                        onChange={e => setConfig({...config, password: e.target.value})} 
                        placeholder="Set secure password..."
                      />
                    </div>
                  )}
                  {selectedTool.needs?.includes('text') && (
                    <div className="form-group full-width">
                      <label>Content / URL</label>
                      <textarea 
                        value={config.text} 
                        onChange={e => setConfig({...config, text: e.target.value})} 
                        placeholder="Enter text or URL for QR code..."
                        rows={3}
                      />
                    </div>
                  )}
                </div>

                <button className="btn-primary-premium" onClick={() => startTask(selectedTool.id)}>
                  <Zap size={18} /> Process Asset
                </button>
              </div>
            </motion.div>
          ) : view === 'smart-detect' && file ? (
            <motion.div key="smart" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="glass-card">
              <div className="category-header"><button className="back-btn" onClick={() => setView('landing')}><X size={20} /></button><h2>Smart Analysis</h2></div>
              <div className="file-badge" style={{ marginBottom: '1.5rem' }}>{file.name}</div>
              <div className="tool-grid">
                {filteredTools.map(t => <button key={t.id} className="tool-card-premium" onClick={() => { setSelectedTool(t); if (t.needs) setView('config'); else startTask(t.id); }}><b>{t.name}</b><span>{t.desc}</span></button>)}
              </div>
            </motion.div>
          ) : view === 'completed' && result ? (
            <motion.div key="completed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card" style={{ textAlign: 'center' }}>
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ background: 'var(--success)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <CheckCircle2 size={40} color="white" />
                </div>
                <h2>Success</h2>
                <p>Your refined asset is ready.</p>
              </div>
              <div className="success-actions-grid">
                <a href={`/api${result.download_url}`} className="btn-primary-premium" download>Download</a>
                <button className="btn-primary-premium secondary" onClick={reset}>Back</button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <footer className="site-footer">
          <div className="footer-main">
            <div className="footer-col footer-profile">
              <div className="footer-brand">
                <img src="/kaivertion.jpg" alt="Kaivertion Logo" className="footer-logo" />
                <h3>Kaivertion</h3>
              </div>
              <p>Advanced digital laboratory for secure asset transformation.</p>
            </div>
            <div className="footer-col footer-links">
              <h4>Contact</h4>
              <a href="mailto:hi@kaiwen.com.tr" className="footer-link"><Mail size={16} /> kaiwen.info@gmail.com</a>
              <a href="https://kaiwen.com.tr" target="_blank" rel="noreferrer" className="footer-link"><Globe size={16} /> kaiwen.com.tr</a>
            </div>
            <div className="footer-col footer-links">
              <h4>Project</h4>
              <a href="https://kaiwen.com.tr" className="footer-link"><ExternalLink size={16} /> Portfolio</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
