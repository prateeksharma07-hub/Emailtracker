import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Eye, 
  Cpu, 
  Binary, 
  FileCode, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Search, 
  SlidersHorizontal,
  Fingerprint,
  ChevronRight,
  Database,
  Lock,
  ArrowRight,
  UserCheck,
  Check,
  Ban,
  HelpCircle,
  Info
} from 'lucide-react';
import { apiFetch } from '../../utils/api';

/**
 * Safely format findings that may be strings or { signal, reason } objects
 */
function formatFinding(finding) {
  if (!finding) return '';
  if (typeof finding === 'string') return finding;
  if (finding.reason) {
    return finding.signal ? `[${finding.signal}] ${finding.reason}` : finding.reason;
  }
  if (finding.signal) return finding.signal;
  try {
    return JSON.stringify(finding);
  } catch (_) {
    return String(finding);
  }
}

/**
 * CheckpointErrorBoundary: Guards CheckpointView from React 19 rendering crashes
 */
class CheckpointErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Checkpoint X-Ray Error Caught]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-3xl bg-rose-500/10 border-2 border-rose-500/30 text-center space-y-4 font-mono text-rose-300 my-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto text-rose-400 text-xl font-bold">
            ⚠️
          </div>
          <h3 className="text-base font-bold text-rose-200">Checkpoint X-Ray Inspector Encountered an Issue</h3>
          <p className="text-xs max-w-md mx-auto text-rose-300/80">
            {this.state.error?.message || 'An unexpected rendering error occurred while displaying message diagnostics.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer"
          >
            Reset Scanner
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * CheckpointView — MailMind AI Email Firewall (Phase 1: Shield + X-Ray)
 * 
 * Airport security / customs control interface contrasting:
 * "Aap Kya Dekhte Ho" (Human visible text) vs "AI Kya Dekhta Hai" (Naive parser text with hidden prompt injections)
 * 
 * STRICT SECURITY:
 * Pure React text tokenization. ZERO dangerouslySetInnerHTML.
 */
function CheckpointViewInner({ initialEmailId, onSelectEmailById }) {
  const [emails, setEmails] = useState([]);
  const [selectedEmailId, setSelectedEmailId] = useState(initialEmailId || null);
  const [scanData, setScanData] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingScan, setIsLoadingScan] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [filterVerdict, setFilterVerdict] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanStats, setScanStats] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  // Fetch list of emails
  const fetchEmailsList = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const res = await apiFetch('/api/emails?limit=100');
      const data = await res.json();
      if (data.success && data.emails) {
        setEmails(data.emails);
        if (!selectedEmailId && data.emails.length > 0) {
          setSelectedEmailId(data.emails[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load email list for Checkpoint', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [selectedEmailId]);

  // Fetch Shield stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/api/shield/stats');
      const data = await res.json();
      if (data.success && data.stats) {
        setScanStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to load shield stats', err);
    }
  }, []);

  // Fetch Scan details for selected email
  const fetchScanDetail = useCallback(async (emailId) => {
    if (!emailId) return;
    try {
      setIsLoadingScan(true);
      setErrorNotice(null);
      const res = await apiFetch(`/api/shield/emails/${emailId}`);
      const data = await res.json();
      if (data.success) {
        setScanData(data.scan || data);
      } else {
        setErrorNotice(data.error || 'Failed to load X-Ray scan');
      }
    } catch (err) {
      setErrorNotice('Network error fetching X-Ray inspection data.');
      console.error(err);
    } finally {
      setIsLoadingScan(false);
    }
  }, []);

  // Update sender trust state directly from Checkpoint view
  const handleUpdateSenderTrust = async (nextState) => {
    const profile = scanData?.senderProfile;
    if (!profile || !profile.id) return;
    try {
      const res = await apiFetch(`/api/senders/${profile.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ trust_state: nextState })
      });
      const data = await res.json();
      if (data.success) {
        fetchScanDetail(selectedEmailId);
      }
    } catch (err) {
      console.error('Failed to update sender trust state', err);
    }
  };

  useEffect(() => {
    fetchEmailsList();
    fetchStats();
  }, [fetchEmailsList, fetchStats]);

  useEffect(() => {
    if (initialEmailId) {
      setSelectedEmailId(initialEmailId);
    }
  }, [initialEmailId]);

  useEffect(() => {
    if (selectedEmailId) {
      fetchScanDetail(selectedEmailId);
    }
  }, [selectedEmailId, fetchScanDetail]);

  // Rescan email
  const handleRescan = async () => {
    if (!selectedEmailId) return;
    try {
      setIsRescanning(true);
      setErrorNotice(null);
      const res = await apiFetch(`/api/shield/rescan/${selectedEmailId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.scan) {
        setScanData(data.scan);
        fetchStats();
        // Update local email item in list
        setEmails(prev => prev.map(e => e.id === selectedEmailId ? { ...e, shield_verdict: data.scan.verdict } : e));
      } else if (data.success) {
        await fetchScanDetail(selectedEmailId);
        fetchStats();
      } else {
        setErrorNotice(data.error || 'Rescan failed');
      }
    } catch (err) {
      setErrorNotice('Failed to trigger firewall rescan.');
    } finally {
      setIsRescanning(false);
    }
  };

  // Seed sample vectors for instant test
  const handleSeedSamples = async () => {
    try {
      setIsSeeding(true);
      setErrorNotice(null);
      const res = await apiFetch('/api/shield/seed-samples', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchEmailsList();
        await fetchStats();
      } else {
        setErrorNotice(data.error || 'Sample injection seeding failed');
      }
    } catch (err) {
      setErrorNotice('Network error during sample seeding');
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered emails
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const matchesVerdict = 
        filterVerdict === 'ALL' || 
        (filterVerdict === 'DETAINED' && email.shield_verdict === 'DETAINED') ||
        (filterVerdict === 'SUSPICIOUS' && email.shield_verdict === 'SUSPICIOUS') ||
        (filterVerdict === 'CLEARED' && (email.shield_verdict === 'CLEARED' || !email.shield_verdict));

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q || 
        (email.subject && email.subject.toLowerCase().includes(q)) ||
        (email.sender && email.sender.toLowerCase().includes(q));

      return matchesVerdict && matchesSearch;
    });
  }, [emails, filterVerdict, searchQuery]);

  // Safe Tokenizer: splits aiText into clean spans and highlighted hiddenSegments
  // Completely safe with React text nodes (no dangerouslySetInnerHTML)
  const renderedAiTextSegments = useMemo(() => {
    if (!scanData) return null;
    const aiText = scanData.aiText || '';
    const hiddenSegments = scanData.hiddenSegments || [];

    if (!hiddenSegments || hiddenSegments.length === 0 || !aiText) {
      return (
        <span className="text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">
          {aiText || '(Empty content)'}
        </span>
      );
    }

    // Build ranges to highlight
    const validHidden = hiddenSegments.filter(h => h && h.text && typeof h.text === 'string' && h.text.trim().length > 0);
    const ranges = [];
    let searchCursor = 0;

    for (const item of validHidden) {
      const idx = aiText.indexOf(item.text, searchCursor);
      if (idx !== -1) {
        ranges.push({
          start: idx,
          end: idx + item.text.length,
          item
        });
        searchCursor = idx + item.text.length;
      } else {
        const fallbackIdx = aiText.indexOf(item.text);
        if (fallbackIdx !== -1) {
          ranges.push({
            start: fallbackIdx,
            end: fallbackIdx + item.text.length,
            item
          });
        }
      }
    }

    ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    const nonOverlapping = [];
    let lastEnd = 0;
    for (const r of ranges) {
      if (r.start >= lastEnd) {
        nonOverlapping.push(r);
        lastEnd = r.end;
      }
    }

    if (nonOverlapping.length === 0) {
      return (
        <span className="text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed select-text">
          {aiText}
        </span>
      );
    }

    const segments = [];
    let currentIdx = 0;

    nonOverlapping.forEach((range, i) => {
      if (range.start > currentIdx) {
        segments.push({
          type: 'normal',
          key: `norm-${i}`,
          text: aiText.slice(currentIdx, range.start)
        });
      }

      segments.push({
        type: 'hidden',
        key: `hidden-${i}`,
        text: range.item.text,
        reason: range.item.reason,
        segmentType: range.item.type
      });

      currentIdx = range.end;
    });

    if (currentIdx < aiText.length) {
      segments.push({
        type: 'normal',
        key: 'norm-end',
        text: aiText.slice(currentIdx)
      });
    }

    return segments.map(seg => {
      if (seg.type === 'normal') {
        return (
          <span key={seg.key} className="text-slate-300 select-text">
            {seg.text}
          </span>
        );
      }
      return (
        <mark
          key={seg.key}
          className="relative inline-block bg-rose-500/25 border border-rose-500 text-rose-200 px-1.5 py-0.5 rounded my-0.5 font-bold shadow-xs transition-all hover:bg-rose-500/40 select-text"
          title={`Hidden Vector [${seg.segmentType}]: ${seg.reason || ''}`}
        >
          <span className="inline-flex items-center space-x-1 text-[10px] uppercase font-mono tracking-wider bg-rose-950/80 text-rose-400 px-1 py-0.2 rounded border border-rose-800/80 mr-1.5 align-middle select-none">
            <ShieldAlert className="w-2.5 h-2.5 text-rose-400 inline" />
            <span>HIDDEN [{seg.segmentType}]</span>
          </span>
          <span>{seg.text}</span>
        </mark>
      );
    });
  }, [scanData]);

  // Verdict styling details
  const getVerdictDetails = (verdict) => {
    switch (verdict) {
      case 'DETAINED':
        return {
          label: 'DETAINED',
          sub: 'Blocked Adversarial Vector',
          color: 'text-rose-500',
          bg: 'bg-rose-500/10 border-rose-500/30',
          stampBorder: 'border-rose-500',
          stampColor: 'text-rose-500',
          badgeBg: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
          icon: ShieldAlert
        };
      case 'SUSPICIOUS':
        return {
          label: 'SUSPICIOUS',
          sub: 'Anomalous Payload Flagged',
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/30',
          stampBorder: 'border-amber-400',
          stampColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          icon: AlertTriangle
        };
      default:
        return {
          label: 'CLEARED',
          sub: 'Firewall Integrity Verified',
          color: 'text-emerald-400',
          bg: 'bg-emerald-500/10 border-emerald-500/30',
          stampBorder: 'border-emerald-400',
          stampColor: 'text-emerald-400',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          icon: ShieldCheck
        };
    }
  };

  const currentVerdict = scanData?.verdict || 'CLEARED';
  const vDetails = getVerdictDetails(currentVerdict);
  const VerdictIcon = vDetails.icon;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Top Airport Security Terminal Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B0F19] border border-slate-800 text-white p-6 shadow-2xl">
        {/* Animated Laser Scanning Beam */}
        <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
          <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Fingerprint className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black tracking-tight text-white uppercase">
                    AI Security Checkpoint & X-Ray
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
                    Firewall Active
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">
                  Multi-layer prompt injection detection, hidden instruction inspection, and bi-directional steganography barrier
                </p>
              </div>
            </div>
          </div>

          {/* Global Firewall Telemetry Stats */}
          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Total Scanned</span>
              <span className="text-sm font-black font-mono text-white">{scanStats?.totalScanned ?? scanStats?.total ?? 0}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-rose-950/40 border border-rose-900/60">
              <span className="text-[10px] uppercase font-mono text-rose-400 block">Detained (Blocked)</span>
              <span className="text-sm font-black font-mono text-rose-400">{scanStats?.detained ?? scanStats?.DETAINED ?? 0}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-amber-950/40 border border-amber-900/60">
              <span className="text-[10px] uppercase font-mono text-amber-400 block">Suspicious</span>
              <span className="text-sm font-black font-mono text-amber-400">{scanStats?.suspicious ?? scanStats?.SUSPICIOUS ?? 0}</span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-950/40 border border-emerald-900/60">
              <span className="text-[10px] uppercase font-mono text-emerald-400 block">Cleared</span>
              <span className="text-sm font-black font-mono text-emerald-400">{scanStats?.cleared ?? scanStats?.CLEARED ?? 0}</span>
            </div>

            <button
              onClick={handleSeedSamples}
              disabled={isSeeding}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold font-mono bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 transition-all cursor-pointer disabled:opacity-50"
              title="Inject synthetic test vectors (malicious prompt injections + benign newsletters) for testing"
            >
              <Database className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSeeding ? 'Seeding...' : 'Load Attack Samples'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorNotice && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorNotice}</span>
          </div>
          <button onClick={() => setErrorNotice(null)} className="font-bold underline text-rose-300">Dismiss</button>
        </div>
      )}

      {/* Main Grid: Email Selector Sidebar (Left) + Inspection Terminal (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Email Target Selector */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-2xl p-4 border border-slate-200/80 dark:border-white/10 space-y-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject or sender..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-transparent focus:border-violet-500 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Verdict Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {['ALL', 'DETAINED', 'SUSPICIOUS', 'CLEARED'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterVerdict(tab)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    filterVerdict === tab
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Email List Feed */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {isLoadingList ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-violet-500" />
                <span>Loading email registry...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center text-xs text-slate-400 space-y-3 border border-slate-200/80 dark:border-white/10">
                <p>No emails match current filter.</p>
                <button
                  onClick={handleSeedSamples}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 text-white font-bold text-xs"
                >
                  Load 40 Benchmark Vectors
                </button>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmailId === email.id;
                const v = email.shield_verdict || 'CLEARED';
                const isDetained = v === 'DETAINED';
                const isSuspicious = v === 'SUSPICIOUS';

                return (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-slate-900 text-white border-cyan-500 ring-1 ring-cyan-500/50 shadow-md'
                        : 'glass-card border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold font-mono truncate max-w-[150px] opacity-80">
                        {email.sender_name || email.sender}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                        isDetained 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                          : isSuspicious 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      }`}>
                        {v}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold line-clamp-1 mb-1">
                      {email.subject || '(No Subject)'}
                    </h4>
                    <p className="text-[11px] opacity-60 line-clamp-1 font-mono">
                      {email.snippet || email.body_text || ''}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: X-Ray Scanner & Diagnostics Terminal */}
        <div className="lg:col-span-8 space-y-6">
          
          {isLoadingScan ? (
            <div className="glass-card rounded-3xl p-16 text-center text-slate-400 space-y-3 border border-slate-200/80 dark:border-white/10">
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-mono">Executing Multi-Layer Checkpoint Inspection...</p>
            </div>
          ) : !scanData ? (
            <div className="glass-card rounded-3xl p-16 text-center text-slate-400 space-y-3 border border-slate-200/80 dark:border-white/10">
              <Eye className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Select an email from the left sidebar to perform X-Ray inspection
              </p>
              <p className="text-xs text-slate-500">
                Contrast human rendered content against naive LLM parsing to detect invisible prompt overrides.
              </p>
            </div>
          ) : (
            <>
              {/* Checkpoint Header Card: Verdict, Stamp & Threat Gauge */}
              <div className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 space-y-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-white/10">
                  
                  {/* Left: Email metadata */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Target Message ID:</span>
                      <span className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400 truncate max-w-[200px]">
                        {scanData.emailId || scanData.id || scanData.email?.id || selectedEmailId}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                      {scanData.subject || scanData.email?.subject || '(No Subject)'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      Sender: &lt;{scanData.sender || scanData.email?.sender || 'Unknown'}&gt;
                    </p>
                  </div>

                  {/* Right: Rescan & Quick Actions */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <button
                      onClick={handleRescan}
                      disabled={isRescanning}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRescanning ? 'animate-spin' : ''}`} />
                      <span>{isRescanning ? 'Scanning...' : 'Rescan Target'}</span>
                    </button>

                    {onSelectEmailById && (
                      <button
                        onClick={() => onSelectEmailById(selectedEmailId)}
                        className="inline-flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors"
                      >
                        <span>View in Inbox</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Verdict Stamp & Composite Threat Score */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  
                  {/* Airport Security Official Stamp Box */}
                  <div className="md:col-span-2 flex items-center space-x-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                    {/* Stamp Visual Effect */}
                    <div className={`px-4 py-2 rounded-xl border-2 font-mono font-black text-lg tracking-widest uppercase transform -rotate-2 select-none shadow-sm ${vDetails.stampBorder} ${vDetails.stampColor}`}>
                      {vDetails.label}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-1.5">
                        <VerdictIcon className={`w-4 h-4 ${vDetails.color}`} />
                        <span className={`text-xs font-extrabold uppercase font-mono tracking-wide ${vDetails.color}`}>
                          {vDetails.sub}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                        {currentVerdict === 'DETAINED'
                          ? 'Automated response drafts suppressed. Email isolated to prevent LLM prompt override.'
                          : currentVerdict === 'SUSPICIOUS'
                            ? 'Anomalous structural artifacts detected. AI restricted to visible text only.'
                            : 'All structural layers verified. No adversarial overrides detected.'}
                      </p>
                    </div>
                  </div>

                  {/* Threat Score Dial / Metric */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 text-center">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block mb-1">
                      Composite Threat Score
                    </span>
                    <div className="flex items-baseline justify-center space-x-1">
                      <span className={`text-3xl font-black font-mono ${
                        (scanData.threatScore ?? 0) >= 60 ? 'text-rose-500' : (scanData.threatScore ?? 0) >= 25 ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {scanData.threatScore ?? 0}
                      </span>
                      <span className="text-xs font-mono text-slate-400">/ 100</span>
                    </div>
                    {/* Mini Progress Bar */}
                    <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (scanData.threatScore ?? 0) >= 60 ? 'bg-rose-500' : (scanData.threatScore ?? 0) >= 25 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, scanData.threatScore ?? 0))}%` }}
                      />
                    </div>
                  </div>

                </div>

                {/* 4 Diagnostic Layer Cards */}
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">
                    Defensive Inspection Layers
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {(scanData.layers || []).map((layer, idx) => {
                      const isDanger = layer.score >= 50 || layer.status === 'danger';
                      const isWarn = (layer.score > 0 && layer.score < 50) || layer.status === 'warning';
                      const isUnavailable = layer.status === 'unavailable';

                      return (
                        <div
                          key={layer.name || idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                              {layer.name}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              isDanger
                                ? 'bg-rose-500/20 text-rose-500'
                                : isWarn
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : isUnavailable
                                    ? 'bg-slate-500/20 text-slate-400'
                                    : 'bg-emerald-500/20 text-emerald-500'
                            }`}>
                              {isUnavailable ? 'OFFLINE' : `${layer.score || 0}/100`}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                            {layer.findings && layer.findings.length > 0 ? (
                              layer.findings.slice(0, 2).map((f, fi) => (
                                <p key={fi} className="truncate text-rose-400" title={formatFinding(f)}>
                                  • {formatFinding(f)}
                                </p>
                              ))
                            ) : (
                              <p className="text-emerald-500/80">• Clean / Zero findings</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Layer 4: Sender Trust & Authentication Card */}
                {(() => {
                  const layer4 = (scanData.layers || []).find(l => l.name?.includes('Sender') || l.label);
                  const profile = scanData.senderProfile;
                  const headersMeta = scanData.headersMeta;
                  const senderEmail = headersMeta?.from_addr || scanData.email?.sender || scanData.sender;
                  const trustState = profile?.trust_state || 'unknown';

                  return (
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-white/10">
                        <div className="flex items-center space-x-2">
                          <UserCheck className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                            Layer 4: Sender Trust & Identity Memory
                          </span>
                        </div>

                        {/* Quick Trust Action Buttons */}
                        {profile?.id && (
                          <div className="flex items-center space-x-1.5">
                            {trustState !== 'trusted' && (
                              <button
                                onClick={() => handleUpdateSenderTrust('trusted')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                              >
                                Mark Trusted
                              </button>
                            )}
                            {trustState !== 'blocked' && (
                              <button
                                onClick={() => handleUpdateSenderTrust('blocked')}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer"
                              >
                                Block Sender
                              </button>
                            )}
                            {trustState !== 'unknown' && (
                              <button
                                onClick={() => handleUpdateSenderTrust('unknown')}
                                className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                                title="Reset to unknown"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* Sender Label */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Identity Status</span>
                          <div>
                            <span className={`inline-block font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              layer4?.label === 'blocked' || trustState === 'blocked'
                                ? 'bg-rose-500/20 text-rose-500'
                                : layer4?.label === 'trusted' || trustState === 'trusted'
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : 'bg-amber-500/20 text-amber-500'
                            }`}>
                              {layer4?.label ? layer4.label.replace(/_/g, ' ').toUpperCase() : trustState.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {/* SPF / DKIM / DMARC Authentication */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Google MTA Auth</span>
                          <div className="flex items-center space-x-1 font-mono text-[11px]">
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              headersMeta?.spf === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : headersMeta?.spf === 'fail' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>SPF:{headersMeta?.spf || 'none'}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              headersMeta?.dkim === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : headersMeta?.dkim === 'fail' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>DKIM:{headersMeta?.dkim || 'none'}</span>
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              headersMeta?.dmarc === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : headersMeta?.dmarc === 'fail' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-400'
                            }`}>DMARC:{headersMeta?.dmarc || 'none'}</span>
                          </div>
                        </div>

                        {/* History Telemetry */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Relationship Telemetry</span>
                          <p className="font-mono text-slate-600 dark:text-slate-300">
                            Received: <strong>{profile?.received_count || 1}</strong> | Sent to: <strong>{profile?.sent_to_count || 0}</strong>
                          </p>
                        </div>

                        {/* Sender Domain */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Sender Domain</span>
                          <p className="font-mono text-slate-600 dark:text-slate-300 truncate">
                            {profile?.sender_domain || senderEmail?.split('@')[1] || 'Unknown'}
                          </p>
                        </div>
                      </div>

                      {/* Findings */}
                      {layer4?.findings && layer4.findings.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/40 dark:border-white/5 space-y-1">
                          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">Layer 4 Findings:</span>
                          {layer4.findings.map((f, i) => (
                            <p key={i} className="text-xs font-mono text-rose-500 dark:text-rose-400">
                              • {formatFinding(f)}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Honest Disclaimer */}
                      <p className="text-[10px] text-slate-400 font-mono italic">
                        * Best-effort identity heuristic. Trusted status increases relationship confidence but never exempts emails from prompt injection quarantine.
                      </p>
                    </div>
                  );
                })()}

              </div>

              {/* Side-by-Side Dual Column X-Ray View */}
              <div className="glass-card rounded-3xl p-6 border border-slate-200/80 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/10">
                  <div className="flex items-center space-x-2">
                    <Binary className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      Dual-Layer Inspection: Human Eye vs Naive AI Parser
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Pure Tokenization — Zero Script Execution
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left Column: What You See (Human Rendered View) */}
                  <div className="rounded-2xl p-4 bg-slate-50 dark:bg-[#0A0D14] border border-slate-200/80 dark:border-white/10 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
                      <div className="flex items-center space-x-2">
                        <Eye className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Aap Kya Dekhte Ho
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                        Visible Canvas
                      </span>
                    </div>

                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 min-h-[220px] max-h-[380px] overflow-y-auto p-2 rounded-xl bg-white/50 dark:bg-black/30 select-text">
                      {scanData.visibleText || '(No visible text)'}
                    </div>

                    <p className="text-[10px] text-slate-400 font-mono italic">
                      This is the sanitized text presented on screen to human readers after stripping hidden CSS / zero-width tokens.
                    </p>
                  </div>

                  {/* Right Column: What AI Sees (Naive Extractor with Hidden Injections) */}
                  <div className="rounded-2xl p-4 bg-slate-900 dark:bg-[#070A0F] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center space-x-2">
                        <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-xs font-bold text-white">
                          AI Kya Dekhta Hai
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-400 font-semibold">
                        Full Ingestion Stream
                      </span>
                    </div>

                    <div className="font-mono text-xs whitespace-pre-wrap leading-relaxed min-h-[220px] max-h-[380px] overflow-y-auto p-2 rounded-xl bg-black/40 border border-slate-800/80 select-text">
                      {renderedAiTextSegments}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Hidden segments flagged: {scanData.hiddenSegments?.length || 0}</span>
                      <span className="text-rose-400 font-bold">Highlighted in Crimson</span>
                    </div>
                  </div>

                </div>

                {/* Hidden Segments Table Breakdown if present */}
                {scanData.hiddenSegments && scanData.hiddenSegments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10 space-y-2">
                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-rose-500 block">
                      Steganographic / Hidden Payload Breakdown ({scanData.hiddenSegments.length} detected)
                    </span>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {scanData.hiddenSegments.map((seg, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 font-mono flex items-start justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                                {seg.type}
                              </span>
                              <span className="text-slate-400 text-[11px]">{seg.reason}</span>
                            </div>
                            <p className="text-white text-xs font-mono break-all select-text">
                              "{seg.text}"
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Best-Effort Security Policy Notice */}
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                <span className="font-bold text-slate-700 dark:text-slate-300">🛡️ Defense-in-Depth Policy: </span>
                MailMind AI Email Firewall implements multi-layered structural, pattern-based, and transformer screening to mitigate prompt injection. No automated defense is 100% impenetrable against novel adversarial perturbations. Critical transactions and sensitive requests should always be verified out-of-band.
              </div>
            </>
          )}

        </div>

      </div>

    </div>
  );
}

export default function CheckpointView(props) {
  return (
    <CheckpointErrorBoundary>
      <CheckpointViewInner {...props} />
    </CheckpointErrorBoundary>
  );
}
