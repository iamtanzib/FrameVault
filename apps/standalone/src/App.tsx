import { useState, useEffect, useRef } from 'react';
import { Button, Input, Dropdown, ProgressBar, RangeSlider } from '@aio-downloader/ui';
import {
  Folder, Clock, CheckCircle, ExternalLink, X, Filter, PlayCircle, Music,
  SearchX, RotateCcw, Link2, Scissors, Pencil, Loader2, AlertCircle, Settings,
  Download, Trash2, ChevronLeft, DownloadCloud, RefreshCw
} from 'lucide-react';
import { Onboarding } from './components/Onboarding';
import { TitleBar } from './components/TitleBar';

export interface HistoryEntry {
  id: string;
  url: string;
  source: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  format: 'video' | 'audio';
}

const deriveSource = (hostname: string) => {
  const h = hostname.replace('www.', '');
  if (h.includes('youtube') || h.includes('youtu.be')) return 'YouTube';
  if (h.includes('instagram')) return 'Instagram';
  if (h.includes('tiktok')) return 'TikTok';
  if (h.includes('twitter') || h.includes('x.com')) return 'X / Twitter';
  if (h.includes('facebook') || h.includes('fb.watch')) return 'Facebook';
  if (h.includes('vimeo')) return 'Vimeo';
  return 'Web';
};

function App() {
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState('');
  const [format, setFormat] = useState<'video' | 'audio'>('video');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [formError, setFormError] = useState('');
  const [fileName, setFileName] = useState('');
  const [quality, setQuality] = useState('best');
  const [destPath, setDestPath] = useState(localStorage.getItem('lastDestPath') || '');
  const [maxDuration, setMaxDuration] = useState(0);
  const [sliderRange, setSliderRange] = useState<[number, number]>([0, 0]);
  const [startText, setStartText] = useState('00:00:00');
  const [endText, setEndText] = useState('00:00:00');
  const [status, setStatus] = useState('Ensuring backend binaries...');
  const [isYoutubeUrl, setIsYoutubeUrl] = useState(false);
  const [isShortsUrl, setIsShortsUrl] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [binariesReady, setBinariesReady] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlreadyExistsModal, setShowAlreadyExistsModal] = useState(false);
  const [downloadedFilePath, setDownloadedFilePath] = useState('');
  const [extensionCookies, setExtensionCookies] = useState<any[]>([]);
  const [wsError, setWsError] = useState('');

  // Card / metadata state
  const [metadata, setMetadata] = useState<{ title: string; thumbnail: string; duration: number; id?: string } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [thumbError, setThumbError] = useState(false);
  const [showRename, setShowRename] = useState(false);

  // Settings & Updates State
  const [showSettings, setShowSettings] = useState(false);
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  // History State
  const [activeTab, setActiveTab] = useState<'download' | 'history'>('download');
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [filterSource, setFilterSource] = useState('All Sources');

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'history') {
      setFilterSource('All Sources');
    }
  }, [activeTab]);

  useEffect(() => {
    // Get version and check for update notes
    (window as any).electronAPI.getAppVersion?.().then((version: string) => {
      setAppVersion(version);

      (window as any).electronAPI.getSettings?.().then((settings: any) => {
        setLaunchOnStartup(settings?.launchOnStartup === true);
      });

      const lastVersion = localStorage.getItem('framevault-last-version');
      fetch(`https://api.github.com/repos/iamtanzib/FrameVault/releases/tags/v${version}`)
        .then(res => res.json())
        .then(data => {
          if (data.body) {
            setCurrentReleaseNotes(data.body);
            if (lastVersion && lastVersion !== version) {
              setUpdateNotes(data.body);
            }
          } else if (lastVersion && lastVersion !== version) {
            setUpdateNotes(`Successfully updated to version ${version}!`);
          }
        })
        .catch(() => {
          if (lastVersion && lastVersion !== version) {
            setUpdateNotes(`Successfully updated to version ${version}!`);
          }
        });
        
      if (lastVersion !== version) {
        localStorage.setItem('framevault-last-version', version);
      }
      
      // Auto-check for updates silently in the background on boot
      (window as any).electronAPI.checkForUpdates?.();
    });

    // Setup listeners
    (window as any).electronAPI.onProgress((payload: any) => {
      if (typeof payload === 'number') {
        setProgress(payload);
        setStatus('Downloading...');
      } else if (payload) {
        if (payload.percent !== undefined) setProgress(payload.percent);
        if (payload.eta) {
          const isTimeFormat = /^[\d:]+$/.test(payload.eta.trim());
          if (isTimeFormat) {
            setEta(payload.eta);
            setStatus('Downloading...');
          } else {
            setEta('');
            setStatus(payload.eta);
          }
        } else {
          setStatus(payload.percent === 100 ? 'Finalizing...' : 'Downloading...');
        }
      } else {
        setStatus('Downloading...');
      }
    });

    (window as any).electronAPI.onLog((line: string) => {
      const clean = line.trim();
      if (clean && clean.startsWith('[') && !clean.includes('[download]')) {
        setStatus(clean);
      }
    });

    (window as any).electronAPI.onUpdateStarted?.((info: any) => {
      setIsCheckingUpdate(false);
      setUpdateCheckMessage('');
      setUpdateInfo({ downloading: true, percent: 0 });
    });

    (window as any).electronAPI.onUpdateNotAvailable?.(() => {
      setIsCheckingUpdate(false);
      setUpdateCheckMessage("You're already on the latest version!");
      setTimeout(() => setUpdateCheckMessage(''), 3000);
    });

    (window as any).electronAPI.onUpdateError?.((err: string) => {
      setIsCheckingUpdate(false);
      setUpdateCheckMessage(`Error: ${err}`);
      setTimeout(() => setUpdateCheckMessage(''), 3000);
    });

    (window as any).electronAPI.onUpdateProgress?.((progressObj: any) => {
      setUpdateInfo({ downloading: true, percent: progressObj.percent });
    });

    (window as any).electronAPI.onUpdateDownloadedReady?.((info: any) => {
      setUpdateInfo({ downloading: false, percent: 100 });
      if (info && info.releaseNotes) {
        let notes = info.releaseNotes;
        if (typeof notes !== 'string') {
          // electron-updater sometimes returns an array of release notes
          notes = Array.isArray(notes) ? notes.map((n: any) => n.note || n).join('\n') : String(notes);
        }
        setPendingUpdateNotes(notes);
      }
      setUpdateReady(true);
    });

    // Init binaries
    (window as any).electronAPI.ensureBinaries().then((res: any) => {
      if (res.success) {
        setStatus('');
        setBinariesReady(true);
      } else {
        setStatus(`Error: ${res.error}`);
      }
    });

    // Listen for Chrome extension download requests
    (window as any).electronAPI.onExtensionDownload((data: any) => {
      if (data && data.url) {
        setActiveTab('download');
        setShowSettings(false);
        setUrl(data.url);
        setExtensionCookies(data.cookies || []);
        setFormat(data.format === 'mp3' ? 'audio' : 'video');
      }
    });

    // Listen for incoming extension cookies (JIT)
    (window as any).electronAPI.onExtensionCookies?.((data: any) => {
      if (data && data.cookies) {
        setExtensionCookies(data.cookies || []);
      }
    });

    (window as any).electronAPI.onWsError?.((msg: string) => {
      setWsError(msg);
    });

    // Check for updates manually from frontend to prevent race conditions
    (window as any).electronAPI.checkForUpdates?.();

    loadHistory();

    return () => {
      (window as any).electronAPI.removeAllListeners('download-progress');
    };
  }, []);

  const loadHistory = async () => {
    try {
      const items = await (window as any).electronAPI.getHistory();
      setHistoryItems(items || []);
    } catch (e) {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    await (window as any).electronAPI.clearHistory();
    setHistoryItems([]);
  };

  const resetForm = () => {
    setUrl('');
    setFileName('');
    setProgress(0);
    setEta('');
    setStatus('');
    setFormError('');
    setShowRename(false);
  };

  const getValidUrl = (input: string) => {
    let u = input.trim();
    if (!u) return null;
    if (!u.startsWith('http://') && !u.startsWith('https://')) {
      if (u.includes('.')) {
        u = 'https://' + u;
      } else {
        return null;
      }
    }
    try {
      const parsed = new URL(u);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return u;
      }
      return null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (!url) {
      setUrlError('');
      setIsYoutubeUrl(false);
      setIsShortsUrl(false);
      setMaxDuration(0);
      setSliderRange([0, 0]);
      setStatus('');
      setFormError('');
      setMetadata(null);
      setMetaLoading(false);
      setSourceName('');
      setThumbError(false);
      return () => { isMounted = false; };
    }

    const validUrl = getValidUrl(url);
    if (!validUrl) {
      setUrlError('Please enter a valid URL');
      setIsYoutubeUrl(false);
      setIsShortsUrl(false);
      setMaxDuration(0);
      setSliderRange([0, 0]);
      setStatus('');
      setFormError('');
      setMetadata(null);
      setMetaLoading(false);
      setSourceName('');
      setThumbError(false);
      return () => { isMounted = false; };
    }

    setUrlError('');
    const parsed = new URL(validUrl);
    
    // Request cookies for the new URL from the extension immediately
    (window as any).electronAPI.requestExtensionCookies?.(validUrl);
    const isYoutube = parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
    setIsYoutubeUrl(isYoutube);

    const isShorts = parsed.pathname.includes('/shorts/');
    setIsShortsUrl(isShorts);
    setSourceName(deriveSource(parsed.hostname));

    // Reset trim + card, show loading. (Trim panel stays gated to YouTube non-Shorts.)
    setMaxDuration(0);
    setSliderRange([0, 0]);
    setMetadata(null);
    setThumbError(false);
    setMetaLoading(true);
    setStatus('');

    const timer = setTimeout(() => {
      (window as any).electronAPI.getMetadata(validUrl, extensionCookies).then((res: any) => {
        if (!isMounted) return;
        setMetaLoading(false);
        if (res.success && res.metadata) {
          setMetadata({
            title: res.metadata.title || '',
            thumbnail: res.metadata.thumbnail || '',
            duration: res.metadata.duration || 0
          });
          if (isYoutube && !isShorts && res.metadata.duration > 0) {
            setMaxDuration(res.metadata.duration);
            setSliderRange([0, res.metadata.duration]);
          }
        } else {
          setMetadata(null);
        }
      }).catch(() => {
        if (!isMounted) return;
        setMetaLoading(false);
        setMetadata(null);
      });
    }, 400);

    return () => { isMounted = false; clearTimeout(timer); };
  }, [url]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatDurationShort = (secs: number) => {
    if (!secs || secs <= 0) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setStartText(formatTime(sliderRange[0]));
    setEndText(formatTime(sliderRange[1]));
  }, [sliderRange]);

  const parseTimeStr = (str: string) => {
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
    return Number(str) || 0;
  };

  const handleStartBlur = () => {
    let secs = parseTimeStr(startText);
    secs = Math.max(0, Math.min(secs, sliderRange[1]));
    setSliderRange([secs, sliderRange[1]]);
    setStartText(formatTime(secs));
  };

  const handleEndBlur = () => {
    let secs = parseTimeStr(endText);
    secs = Math.max(sliderRange[0], Math.min(secs, maxDuration));
    setSliderRange([sliderRange[0], secs]);
    setEndText(formatTime(secs));
  };

  const handleBrowse = async () => {
    const folder = await (window as any).electronAPI.selectFolder();
    if (folder) {
      setDestPath(folder);
      localStorage.setItem('lastDestPath', folder);
    }
  };

  const handleDownload = async (nameOverride?: string) => {
    if (!url || !destPath) {
      setFormError('Please enter a URL and select a destination');
      return;
    }

    setFormError('');
    setIsDownloading(true);
    setProgress(0);
    setEta('');
    setStatus('Initializing download engine...');

    const activeFileName = nameOverride !== undefined ? nameOverride : fileName;
    let finalFileName = activeFileName.trim();
    if (!finalFileName && metadata?.title) {
      // Create a safe default filename to avoid yt-dlp truncation bug on long titles
      const safeTitle = metadata.title.replace(/[\\/:*?"<>|]/g, '').substring(0, 70).trim();
      finalFileName = `${safeTitle} [${metadata.id || Date.now()}]`;
    }

    const options = {
      url: getValidUrl(url) || url,
      outputFolder: destPath,
      quality,
      format: format === 'audio' ? 'mp3' : 'mp4',
      fileName: finalFileName || undefined,
      startTime: (maxDuration > 0 && sliderRange[0] > 0) ? formatTime(sliderRange[0]) : '',
      endTime: (maxDuration > 0 && sliderRange[1] < maxDuration) ? formatTime(sliderRange[1]) : '',
      cookies: extensionCookies
    };

    const res = await (window as any).electronAPI.download(options);
    if (res.success) {
      setStatus('');
      setProgress(100);
      setDownloadedFilePath(res.filePath);

      if (!res.alreadyExists) {
        // Build History Entry
        try {
          const parsed = new URL(options.url);
          let src = parsed.hostname.replace('www.', '');
          if (src.includes('youtube.com') || src.includes('youtu.be')) src = 'YouTube';
          else if (src.includes('instagram.com')) src = 'Instagram';
          else if (src.includes('tiktok.com')) src = 'TikTok';
          else if (src.includes('twitter.com') || src.includes('x.com')) src = 'X/Twitter';
          else if (src.includes('facebook.com') || src.includes('fb.watch')) src = 'Facebook';
          else src = 'Other';

          const pathParts = res.filePath.split(/[\\/]/);
          const savedName = pathParts[pathParts.length - 1] || 'Unknown File';

          await (window as any).electronAPI.addHistory({
            id: Date.now().toString(),
            url: options.url,
            source: src,
            fileName: savedName,
            filePath: res.filePath,
            timestamp: Date.now(),
            format: format
          });
          loadHistory();
        } catch (e) {
          console.error('Failed to add history entry:', e);
          // Still show success modal even if history fails
        }
      }

      if (res.alreadyExists) {
        setShowAlreadyExistsModal(true);
      } else {
        setShowSuccessModal(true);
      }
    } else {
      setFormError(`Download Failed: ${res.error}`);
      setStatus('');
    }
    setIsDownloading(false);
  };

  const handleDownloadAsNew = () => {
    let currentBaseName = fileName.trim();
    if (!currentBaseName && downloadedFilePath) {
      let extracted = downloadedFilePath.split(/[\\/]/).pop() || '';
      extracted = extracted.substring(0, extracted.lastIndexOf('.')) || extracted;
      if (format === 'audio') {
        extracted = extracted.replace(/ -audio only$/, '');
      }
      currentBaseName = extracted;
    }

    const match = currentBaseName.match(/^(.*) \((\d+)\)$/);
    if (match) {
      currentBaseName = `${match[1]} (${parseInt(match[2]) + 1})`;
    } else {
      currentBaseName = `${currentBaseName || 'Download'} (1)`;
    }

    setFileName(currentBaseName);
    handleDownload(currentBaseName);
  };

  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('onboardingComplete') !== 'true'
  );

  const [binariesError, setBinariesError] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<{ downloading: boolean, percent: number }>({ downloading: false, percent: 0 });
  const [appVersion, setAppVersion] = useState('');
  const [updateNotes, setUpdateNotes] = useState<string | null>(null);
  const [pendingUpdateNotes, setPendingUpdateNotes] = useState<string | null>(null);
  const [currentReleaseNotes, setCurrentReleaseNotes] = useState<string | null>(null);
  const [showUpdatesModal, setShowUpdatesModal] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState('');

  // ---- Dynamic window height ----
  // Special screens use fixed comfortable heights.
  useEffect(() => {
    if (!binariesReady) {
      (window as any).electronAPI.setWindowHeight?.(440);
    } else if (showOnboarding) {
      (window as any).electronAPI.setWindowHeight?.(580);
    }
  }, [binariesReady, showOnboarding]);

  // Main app: grow/shrink the window to fit content exactly.
  useEffect(() => {
    if (!binariesReady || showOnboarding) return;
    const el = contentRef.current;
    if (!el) return;
    const apply = () => {
      let h = Math.ceil(el.getBoundingClientRect().height);
      
      // Dynamically override height if large modals are open so they don't get cut off!
      if (updateNotes) {
         h = Math.max(h, 480);
      } else if (showUpdatesModal) {
         h = Math.max(h, Math.max(480, h)); // Make sure updates modal always has enough room
      } else if (showSettings) {
         h = Math.max(h, 540);
      } else if (showSuccessModal || showAlreadyExistsModal) {
         h = Math.max(h, 380);
      }
      
      const clamped = Math.min(780, Math.max(300, h));
      (window as any).electronAPI.setWindowHeight?.(clamped);
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [binariesReady, showOnboarding, updateNotes, showUpdatesModal, showSettings, showSuccessModal, showAlreadyExistsModal]);

  if (!binariesReady) {
    return (
      <div className="relative h-screen w-full bg-background font-sans">
        {/* Minimal draggable strip with a close affordance (frameless window) */}
        <div className="drag-region absolute inset-x-0 top-0 flex h-10 items-center justify-end px-2">
          <button
            onClick={() => (window as any).electronAPI.windowClose?.()}
            className="no-drag flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-error hover:text-white"
          >
            <X className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>
        </div>
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          {status.startsWith('Error') ? (
            <>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-error/12">
                <AlertCircle className="h-6 w-6 text-error" />
              </div>
              <div className="mb-1.5 text-[14px] font-semibold text-error">Initialization Failed</div>
              <div className="max-w-md text-[12px] font-medium text-secondaryText">{status}</div>
            </>
          ) : (
            <>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accentHover shadow-glow">
                <Loader2 className="h-6 w-6 animate-spin text-black" />
              </div>
              <div className="mb-1.5 text-[15px] font-semibold text-primaryText">FrameVault</div>
              <div className="text-[12px] font-medium text-secondaryText">{status || 'Initializing engine...'}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  const filteredHistory = historyItems
    .filter(item => filterSource === 'All Sources' || item.source === filterSource);

  const hasValidUrl = !!getValidUrl(url) && !urlError;
  const showTrim = isYoutubeUrl && !isShortsUrl;
  const renameOpen = showRename || !!fileName;
  const destName = destPath ? destPath.split(/[\\/]/).filter(Boolean).pop() : '';

  return (
    <>
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}

      <div ref={contentRef} className="w-full bg-background font-sans text-primaryText">
        <TitleBar
          appVersion={appVersion}
          activeView={activeTab}
          showSettings={showSettings}
          updateState={{ ready: !!updateNotes, downloading: updateInfo.downloading, percent: updateInfo.percent }}
          onGoDownload={() => { setActiveTab('download'); setShowSettings(false); }}
          onToggleHistory={() => { setActiveTab(activeTab === 'history' ? 'download' : 'history'); setShowSettings(false); }}
          onOpenSettings={() => setShowSettings(true)}
          onOpenUpdates={() => setShowUpdatesModal(true)}
        />

        <div className="px-5 pb-5">
          {activeTab === 'download' ? (
            <div className={`flex flex-col ${!hasValidUrl ? 'gap-7 pt-8 pb-4' : 'gap-4'}`}>
              {/* URL field — the primary control, always present */}
              <div className="animate-fade-in">
                {!hasValidUrl && (
                  <div className="mb-6 mt-1 text-center">
                    <h1 className="text-[17px] font-semibold tracking-tight text-primaryText">Download any video</h1>
                    <p className="mt-1.5 text-[12.5px] text-secondaryText">Paste a link from YouTube, Instagram, X, TikTok & more.</p>
                  </div>
                )}
                <Input
                  icon={<Link2 className="h-4 w-4" />}
                  placeholder="Paste video or audio link here..."
                  className={`h-11 text-[13.5px] ${urlError ? 'border-error/70 text-error placeholder:text-error/40 focus-visible:border-error/70 focus-visible:ring-error/15' : ''}`}
                  value={url}
                  onChange={(e: any) => {
                    setUrl(e.target.value);
                    setExtensionCookies([]);
                  }}
                  autoFocus
                />
                {urlError && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-error">
                    <AlertCircle className="h-3.5 w-3.5" /> {urlError}
                  </div>
                )}
                {wsError && !urlError && (
                  <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-yellow-500">
                    <AlertCircle className="h-3.5 w-3.5" /> {wsError}
                  </div>
                )}
              </div>

              {/* Reveal: video card + options */}
              {hasValidUrl && (
                <div className="flex flex-col gap-4 animate-slide-up">
                  {/* Video card */}
                  <div className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3 shadow-card">
                    <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-white/[0.06] to-white/[0.01] ring-1 ring-inset ring-white/[0.04]">
                      {metadata?.thumbnail && !thumbError ? (
                        <img
                          src={metadata.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                          onError={() => setThumbError(true)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          {metaLoading
                            ? <Loader2 className="h-5 w-5 animate-spin text-secondaryText/70" />
                            : (format === 'audio'
                                ? <Music className="h-6 w-6 text-secondaryText/60" />
                                : <PlayCircle className="h-6 w-6 text-secondaryText/60" />)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {metaLoading ? (
                        <div className="space-y-2">
                          <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.06]" />
                          <div className="h-2.5 w-1/3 animate-pulse rounded bg-white/[0.05]" />
                        </div>
                      ) : (
                        <>
                          <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-primaryText">
                            {metadata?.title || 'Ready to download'}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="rounded-md bg-accent/12 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                              {sourceName || 'Web'}
                            </span>
                            {metadata && metadata.duration > 0 && (
                              <span className="flex items-center gap-1 text-[10.5px] font-medium text-secondaryText">
                                <Clock className="h-3 w-3" /> {formatDurationShort(metadata.duration)}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Format + Quality */}
                  <div className="flex gap-3">
                    <div className="flex h-10 flex-1 items-center gap-1 rounded-lg border border-border bg-surface p-1">
                      <button
                        onClick={() => setFormat('video')}
                        className={`h-full flex-1 rounded-md text-[12px] font-medium transition-all ${format === 'video' ? 'bg-white/[0.08] text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                      >
                        Video + Audio
                      </button>
                      <button
                        onClick={() => setFormat('audio')}
                        className={`h-full flex-1 rounded-md text-[12px] font-medium transition-all ${format === 'audio' ? 'bg-white/[0.08] text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                      >
                        Audio Only
                      </button>
                    </div>
                    <div className="w-[150px]">
                      <Dropdown
                        value={quality}
                        onChange={(e: any) => setQuality(e.target.value)}
                        options={[
                          { label: 'Best Available', value: 'best' },
                          { label: '1080p', value: '1080' },
                          { label: '720p', value: '720' }
                        ]}
                      />
                    </div>
                  </div>

                  {/* Rename (collapsible) */}
                  {!renameOpen ? (
                    <button
                      onClick={() => setShowRename(true)}
                      className="flex items-center gap-1.5 self-start text-[11.5px] font-medium text-secondaryText transition-colors hover:text-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Add a custom file name
                    </button>
                  ) : (
                    <div className="animate-slide-down">
                      <Input
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        placeholder="Custom file name (optional)..."
                        value={fileName}
                        onChange={(e: any) => setFileName(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Trim (YouTube, non-Shorts only) */}
                  {showTrim && (
                    <div className="rounded-xl border border-border bg-surface p-3.5 animate-slide-down">
                      {maxDuration > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-primaryText">
                              <Scissors className="h-3.5 w-3.5 text-accent" /> Trim clip
                            </span>
                            <span className="text-[11px] font-medium text-secondaryText">
                              of {formatDurationShort(maxDuration)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-secondaryText">Start</span>
                              <input
                                type="text"
                                value={startText}
                                onChange={(e) => setStartText(e.target.value)}
                                onBlur={handleStartBlur}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                className="w-[62px] rounded-md border border-border bg-surface px-1.5 py-1 text-center font-mono text-primaryText focus:border-accent/70 focus:outline-none"
                              />
                            </div>
                            <div className="h-px w-6 bg-border" />
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-secondaryText">End</span>
                              <input
                                type="text"
                                value={endText}
                                onChange={(e) => setEndText(e.target.value)}
                                onBlur={handleEndBlur}
                                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                                className="w-[62px] rounded-md border border-border bg-surface px-1.5 py-1 text-center font-mono text-primaryText focus:border-accent/70 focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="px-1 pt-0.5">
                            <RangeSlider min={0} max={maxDuration} value={sliderRange} onChange={setSliderRange} />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2 py-3 text-secondaryText">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-[11.5px]">Fetching trim range...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Destination */}
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-1.5 pl-3">
                    <Folder className="h-4 w-4 shrink-0 text-secondaryText" />
                    <div className="min-w-0 flex-1">
                      {destPath ? (
                        <div className="truncate text-[12px] font-medium text-primaryText" title={destPath}>{destName}</div>
                      ) : (
                        <div className="text-[12px] text-secondaryText">No folder selected</div>
                      )}
                    </div>
                    <Button variant="browse" className="h-8 shrink-0 px-3 text-[12px]" onClick={handleBrowse}>
                      Change
                    </Button>
                  </div>

                  {/* Progress */}
                  {(isDownloading || progress > 0) && (
                    <div className="space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between text-[11px] font-medium">
                        <span className={status.startsWith('Error') ? 'text-error' : 'text-accent'}>
                          {status || 'Downloading...'}
                        </span>
                        <div className="flex items-center gap-3 text-secondaryText">
                          {(isDownloading && eta) && <span>ETA {eta}</span>}
                          <span className="min-w-[42px] text-right font-semibold text-accent">{progress.toFixed(1)}%</span>
                        </div>
                      </div>
                      <ProgressBar progress={progress} />
                    </div>
                  )}

                  {/* Error line (destination missing etc.) */}
                  {formError && (
                    <div className="flex items-center gap-2 rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-[11.5px] font-medium text-error animate-fade-in">
                      <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
                    </div>
                  )}

                  {/* Download button */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload()}
                      disabled={isDownloading || !binariesReady}
                      className="flex-1 gap-2"
                    >
                      {isDownloading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Downloading...</>
                      ) : (
                        <><Download className="h-4 w-4" /> Download</>
                      )}
                    </Button>
                    {isDownloading && (
                      <button
                        onClick={() => {
                          if ((window as any).electronAPI.cancelDownload) {
                            (window as any).electronAPI.cancelDownload();
                          }
                          setIsDownloading(false);
                          setStatus('Cancelled by user');
                        }}
                        className="flex h-9 w-11 shrink-0 items-center justify-center rounded-lg border border-error/30 bg-error/10 text-error transition-colors hover:bg-error/20"
                        title="Cancel Download"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Developer Log (Temporary) */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-4 p-3 rounded-lg border border-primary/30 bg-primary/10">
                      <div className="flex justify-between items-center bg-black/40 p-3 rounded-lg border border-white/5 font-mono">
                        <div>
                          <div className="text-white font-bold mb-1">DEV LOG:</div>
                          <div className="text-white/70">Extracted Cookies: <span className={extensionCookies.length > 0 ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{extensionCookies.length}</span></div>
                          {extensionCookies.length > 0 && (
                            <div className="text-white/40 text-[10px] mt-1 break-all">
                              Sample: {extensionCookies[0].name}={extensionCookies[0].value.substring(0, 10)}...
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            if (url) (window as any).electronAPI.requestExtensionCookies?.(url);
                          }}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Fetch Cookies
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Empty-state destination hint */}
              {!hasValidUrl && (
                <button
                  onClick={handleBrowse}
                  className="group flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-borderStrong"
                >
                  <Folder className="h-4 w-4 shrink-0 text-secondaryText" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-secondaryText">Save location</div>
                    <div className="truncate text-[12px] font-medium text-primaryText" title={destPath}>
                      {destPath || 'Choose a folder…'}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-secondaryText group-hover:text-accent">Change</span>
                </button>
              )}
            </div>
          ) : (
            /* ---------- History ---------- */
            <div className="flex flex-col animate-fade-in">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setActiveTab('download')}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-secondaryText transition-colors hover:bg-white/[0.06] hover:text-primaryText"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <h2 className="text-[14px] font-semibold text-primaryText">History</h2>
                </div>
                <div className="flex items-center gap-2">
                  {historyItems.length > 0 && (
                    <Button variant="ghost" onClick={handleClearHistory} className="h-9 px-3 text-error hover:bg-error/10 hover:text-error mr-1">
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear All
                    </Button>
                  )}
                  <Filter className="h-3.5 w-3.5 text-secondaryText" />
                  <div className="w-[150px]">
                    <Dropdown
                      className="h-9"
                      options={[
                        { label: 'All Sources', value: 'All Sources' },
                        { label: 'YouTube', value: 'YouTube' },
                        { label: 'Instagram', value: 'Instagram' },
                        { label: 'TikTok', value: 'TikTok' },
                        { label: 'X/Twitter', value: 'X/Twitter' },
                        { label: 'Facebook', value: 'Facebook' },
                        { label: 'Other', value: 'Other' }
                      ]}
                      value={filterSource}
                      onChange={(e: any) => setFilterSource(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-0.5">
                {filteredHistory.map(item => (
                  <div key={item.id} className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-2.5 transition-colors hover:border-borderStrong">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.format === 'audio' ? 'bg-accent/12 text-accent' : 'bg-white/[0.06] text-primaryText'}`}>
                        {item.format === 'audio' ? <Music className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-primaryText">{item.fileName}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-secondaryText">
                          <span className="font-medium text-accent/90">{item.source}</span>
                          <span>·</span>
                          <span>{new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-8 shrink-0 px-3 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => (window as any).electronAPI.showItemInFolder(item.filePath)}
                    >
                      Reveal
                    </Button>
                  </div>
                ))}

                {historyItems.length > 0 && filteredHistory.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-secondaryText">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
                      <SearchX className="h-7 w-7 text-secondaryText" />
                    </div>
                    <span className="mb-1 text-[13px] font-semibold text-primaryText">No results</span>
                    <span className="mb-5 text-[12px]">Nothing matches this filter.</span>
                    <Button variant="secondary" onClick={() => setFilterSource('All Sources')} className="h-9 gap-2 px-4 text-[12px]">
                      <RotateCcw className="h-4 w-4" /> Reset filter
                    </Button>
                  </div>
                )}

                {historyItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 text-center text-secondaryText">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
                      <Clock className="h-7 w-7 opacity-70" />
                    </div>
                    <span className="text-[13px] font-medium text-primaryText">No downloads yet</span>
                    <span className="mt-1 text-[12px]">Your completed downloads will appear here.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Update downloading overlay */}
      {updateInfo.downloading && !updateReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[360px] flex-col items-center rounded-2xl border border-border bg-surface p-7 text-center shadow-modal animate-scale-in">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
              <RotateCcw className="h-7 w-7 text-accent" style={{ animation: 'spin 3s linear infinite' }} />
            </div>
            <h2 className="mb-2 text-[16px] font-semibold text-primaryText">Updating FrameVault…</h2>
            <p className="mb-6 text-[12.5px] text-secondaryText">Downloading the latest version. Hang tight.</p>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, updateInfo.percent))}%` }} />
            </div>
            <div className="text-[12px] font-semibold text-accent">{Math.round(updateInfo.percent)}%</div>
          </div>
        </div>
      )}

      {/* Update ready overlay */}
      {updateReady && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[380px] flex-col items-center rounded-2xl border border-border bg-surface p-7 text-center shadow-modal animate-scale-in">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle className="h-7 w-7" />
            </div>
            <h2 className="mb-2 text-[16px] font-semibold text-primaryText">Update ready</h2>
            <p className="mb-4 text-[12.5px] text-secondaryText">A new version has been downloaded and verified.</p>
            
            {pendingUpdateNotes && (
              <div className="mb-6 w-full rounded-xl bg-black/20 p-4 text-left border border-white/5 max-h-[160px] overflow-y-auto custom-scrollbar">
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-primaryText">Release Notes</div>
                <div className="text-[12px] text-secondaryText/90 leading-relaxed" dangerouslySetInnerHTML={{ __html: pendingUpdateNotes.replace(/\n/g, '<br/>') }} />
              </div>
            )}
            
            <div className="flex w-full gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setUpdateReady(false)}>Later</Button>
              <Button variant="primary" className="flex-1" onClick={() => (window as any).electronAPI.installUpdate()}>Restart now</Button>
            </div>
          </div>
        </div>
      )}

      {/* What's New Modal (After Update) */}
      {updateNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[420px] flex-col items-start rounded-2xl border border-border bg-surface p-8 shadow-modal animate-scale-in">
            <h2 className="mb-2 text-[20px] font-semibold text-primaryText">What's New in {appVersion}</h2>
            <div className="mb-7 mt-2 max-h-[300px] w-full overflow-y-auto text-[13px] leading-relaxed text-secondaryText custom-scrollbar pr-2">
              <div dangerouslySetInnerHTML={{ __html: updateNotes.replace(/\n/g, '<br/>') }} />
            </div>
            <Button variant="primary" className="w-full" onClick={() => setUpdateNotes(null)}>Awesome</Button>
          </div>
        </div>
      )}

      {/* Updates Center Modal */}
      {showUpdatesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[460px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-modal animate-scale-in">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-black/20 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15">
                  <DownloadCloud className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-primaryText">Updates Center</h2>
                  <div className="text-[12px] text-secondaryText">Current Version: v{appVersion}</div>
                </div>
              </div>
              <button 
                onClick={() => setShowUpdatesModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-white/[0.06] hover:text-error"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Status Banner */}
              {updateReady ? (
                <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-success/30 bg-success/10 p-5 text-center">
                  <CheckCircle className="mb-2 h-7 w-7 text-success" />
                  <div className="mb-1 font-semibold text-success">Update Ready to Install</div>
                  <div className="mb-4 text-[12px] text-success/80">Restart the app to apply the newest features.</div>
                  <Button variant="primary" onClick={() => (window as any).electronAPI.installUpdate()} className="h-8 bg-success hover:bg-success/90 text-white">
                    Restart Now
                  </Button>
                </div>
              ) : updateInfo.downloading ? (
                <div className="mb-6 flex flex-col items-center justify-center rounded-xl border border-accent/20 bg-accent/5 p-5 text-center">
                  <RefreshCw className="mb-3 h-6 w-6 text-accent animate-spin" />
                  <div className="mb-2 text-[13px] font-semibold text-primaryText">Downloading Update...</div>
                  <div className="mb-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-black/40">
                    <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, updateInfo.percent))}%` }} />
                  </div>
                  <div className="text-[11px] font-medium text-accent">{Math.round(updateInfo.percent)}%</div>
                </div>
              ) : (
                <div className="mb-6 flex flex-col gap-2 rounded-xl border border-border bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-secondaryText" />
                      <div className="text-[13px] font-medium text-primaryText">You're up to date!</div>
                    </div>
                    <Button 
                      variant="secondary" 
                      className="h-8 text-[12px] min-w-[100px]" 
                      disabled={isCheckingUpdate}
                      onClick={() => {
                        setIsCheckingUpdate(true);
                        setUpdateCheckMessage('');
                        (window as any).electronAPI.checkForUpdates?.();
                      }}
                    >
                      {isCheckingUpdate ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Check Again"}
                    </Button>
                  </div>
                  {updateCheckMessage && (
                    <div className="text-[12px] text-accent animate-fade-in text-right">
                      {updateCheckMessage}
                    </div>
                  )}
                </div>
              )}

              {/* Release Notes (Only show if available) */}
              {((updateReady && pendingUpdateNotes) || (!updateReady && currentReleaseNotes)) && (
                <div className="flex flex-col">
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-secondaryText">
                    {updateReady ? "Upcoming Changes" : `What's new in v${appVersion}`}
                  </div>
                  <div className="w-full rounded-xl border border-border bg-black/10 p-4 text-[12px] leading-relaxed text-secondaryText max-h-[220px] overflow-y-auto custom-scrollbar">
                    {updateReady && pendingUpdateNotes ? (
                       <div dangerouslySetInnerHTML={{ __html: pendingUpdateNotes.replace(/\n/g, '<br/>') }} />
                    ) : (
                       <div dangerouslySetInnerHTML={{ __html: currentReleaseNotes!.replace(/\n/g, '<br/>') }} />
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[340px] flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-modal animate-scale-in">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h2 className="mb-1.5 text-[16px] font-semibold text-primaryText">Download complete</h2>
            <p className="mb-6 text-[12.5px] text-secondaryText">Your file has been saved to the destination folder.</p>
            <div className="flex w-full gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowSuccessModal(false); resetForm(); }}>Close</Button>
              <Button
                variant="primary"
                className="flex-1 gap-1.5"
                onClick={() => {
                  if (downloadedFilePath) {
                    (window as any).electronAPI.showItemInFolder(downloadedFilePath);
                  } else {
                    (window as any).electronAPI.openFolder(destPath);
                  }
                  setShowSuccessModal(false);
                  resetForm();
                }}
              >
                <Folder className="h-3.5 w-3.5" /> Reveal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Already Exists Modal */}
      {showAlreadyExistsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="flex w-[360px] flex-col items-center rounded-2xl border border-border bg-surface p-7 text-center shadow-modal animate-scale-in">
            <div className="mb-5 flex h-13 w-13 items-center justify-center rounded-2xl bg-error/12">
              <AlertCircle className="h-6 w-6 text-error" />
            </div>
            <h3 className="mb-1.5 text-[16px] font-semibold text-primaryText">File already exists</h3>
            <p className="mb-6 max-w-[300px] text-[12.5px] text-secondaryText">A file with this name is already in the folder.</p>
            <div className="flex w-full gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowAlreadyExistsModal(false); resetForm(); }}>Cancel</Button>
              <Button variant="primary" className="flex-1" onClick={() => { setShowAlreadyExistsModal(false); handleDownloadAsNew(); }}>Save as new</Button>
            </div>
            <button
              onClick={() => {
                (window as any).electronAPI.showItemInFolder(downloadedFilePath);
                setShowAlreadyExistsModal(false);
                resetForm();
              }}
              className="mt-5 flex items-center gap-2 text-[12px] text-secondaryText transition-colors hover:text-primaryText"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Reveal existing file
            </button>
          </div>
        </div>
      )}

      {/* Update Notes Modal */}
      {updateNotes && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm animate-fade-in">
          <div className="flex w-full max-w-sm flex-col items-center rounded-2xl border border-border bg-surface p-6 text-center shadow-modal animate-scale-in">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-accent">
              <Download className="h-6 w-6" />
            </div>
            <h2 className="mb-2 text-[16px] font-semibold text-primaryText">Update successful</h2>
            <div className="custom-scrollbar mb-6 max-h-[200px] w-full overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-left text-[12px] font-medium text-secondaryText">
              {updateNotes}
            </div>
            <Button variant="primary" onClick={() => setUpdateNotes(null)} className="w-full">Awesome</Button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className="w-[380px] overflow-hidden rounded-2xl border border-border bg-surface shadow-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="flex items-center gap-2 text-[14px] font-semibold text-primaryText">
                <Settings className="h-4 w-4 text-secondaryText" /> Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondaryText transition-colors hover:bg-white/[0.06] hover:text-primaryText">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <div
                className="group flex cursor-pointer items-center justify-between"
                onClick={() => {
                  const val = !launchOnStartup;
                  setLaunchOnStartup(val);
                  (window as any).electronAPI.updateSettings({ launchOnStartup: val });
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-primaryText transition-colors group-hover:text-accent">Launch on startup</span>
                  <span className="mt-0.5 text-[11px] text-secondaryText">Start FrameVault automatically when Windows boots.</span>
                </div>
                <div className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${launchOnStartup ? 'bg-accent' : 'bg-border'}`}>
                  <div className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${launchOnStartup ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
