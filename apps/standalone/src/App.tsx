import { useState, useEffect, useRef } from 'react';
import { Button, Input, Dropdown, ProgressBar, RangeSlider } from '@aio-downloader/ui';
import { Settings, Folder, Clock, CheckCircle, ExternalLink, X, Calendar, Filter, Trash2, PlayCircle, Music, SearchX, RotateCcw } from 'lucide-react';
import { Onboarding } from './components/Onboarding';

export interface HistoryEntry {
  id: string;
  url: string;
  source: string;
  fileName: string;
  filePath: string;
  timestamp: number;
  format: 'video' | 'audio';
}

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [binariesReady, setBinariesReady] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAlreadyExistsModal, setShowAlreadyExistsModal] = useState(false);
  const [downloadedFilePath, setDownloadedFilePath] = useState('');
  
  // History State
  const [activeTab, setActiveTab] = useState<'download' | 'history'>('download');
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [filterSource, setFilterSource] = useState('All Sources');

  useEffect(() => {
    if (activeTab === 'history') {
      setFilterSource('All Sources');
      (window as any).electronAPI.setWindowHeight?.(740);
    } else if (isYoutubeUrl) {
      (window as any).electronAPI.setWindowHeight?.(800);
    } else {
      (window as any).electronAPI.setWindowHeight?.(640);
    }
  }, [isYoutubeUrl, activeTab]);

  useEffect(() => {
    // Setup listeners
    (window as any).electronAPI.onProgress((payload: any) => {
      if (typeof payload === 'number') {
        setProgress(payload);
      } else if (payload) {
        if (payload.percent !== undefined) setProgress(payload.percent);
        if (payload.eta) setEta(payload.eta);
      }
      setStatus('Downloading...');
    });

    (window as any).electronAPI.onLog((line: string) => {
      const clean = line.trim();
      if (clean && clean.startsWith('[') && !clean.includes('[download]')) {
        setStatus(clean);
      }
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
        setUrl(data.url);
        setFormat(data.format === 'mp3' ? 'audio' : 'video');
      }
    });

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

  const resetForm = () => {
    setUrl('');
    setFileName('');
    setProgress(0);
    setEta('');
    setStatus('');
    setFormError('');
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
    if (!url) {
      setUrlError('');
      setIsYoutubeUrl(false);
      setMaxDuration(0);
      setStatus('');
      setFormError('');
      setFileName('');
      return;
    }

    const validUrl = getValidUrl(url);
    if (!validUrl) {
      setUrlError('Please enter a valid URL');
      setIsYoutubeUrl(false);
      setMaxDuration(0);
      setSliderRange([0, 0]);
      setStatus('');
      setFormError('');
      setFileName('');
      return;
    }
      
    setUrlError('');
    const parsed = new URL(validUrl);
    const isYoutube = parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be');
    setIsYoutubeUrl(isYoutube);
    
    if (isYoutube) {
      setStatus('Fetching video metadata...');
      (window as any).electronAPI.getMetadata(validUrl).then((res: any) => {
        if (res.success) {
          if (res.metadata?.duration > 0) {
            setMaxDuration(res.metadata.duration);
            setSliderRange([0, res.metadata.duration]);
          } else {
            setMaxDuration(0);
            setSliderRange([0, 0]);
          }
          setStatus('');
        } else {
          setMaxDuration(0);
          setSliderRange([0, 0]);
          
          const errMsg = res.error?.split('\n')?.[0] || 'Failed to fetch metadata';
          setStatus(`Metadata Error: ${errMsg}`);
        }
      });
    } else {
      setMaxDuration(0);
      setSliderRange([0, 0]);
      setStatus('');
    }
  }, [url]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
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

    const options = {
      url: getValidUrl(url) || url,
      outputFolder: destPath,
      quality,
      format: format === 'audio' ? 'mp3' : 'mp4',
      fileName: activeFileName.trim() || undefined,
      startTime: (maxDuration > 0 && sliderRange[0] > 0) ? formatTime(sliderRange[0]) : '',
      endTime: (maxDuration > 0 && sliderRange[1] < maxDuration) ? formatTime(sliderRange[1]) : ''
    };

    const res = await (window as any).electronAPI.download(options);
    if (res.success) {
      setStatus('');
      setProgress(100);
      setDownloadedFilePath(res.filePath);
      
      if (!res.alreadyExists) {
        // Build History Entry
        const parsed = new URL(options.url);
        let sourceName = parsed.hostname.replace('www.', '');
        if (sourceName.includes('youtube.com') || sourceName.includes('youtu.be')) sourceName = 'YouTube';
        else if (sourceName.includes('instagram.com')) sourceName = 'Instagram';
        else if (sourceName.includes('tiktok.com')) sourceName = 'TikTok';
        else if (sourceName.includes('twitter.com') || sourceName.includes('x.com')) sourceName = 'X/Twitter';
        else sourceName = 'Other';
        
        const pathParts = res.filePath.split(/[\\/]/);
        const savedName = pathParts[pathParts.length - 1] || 'Unknown File';

        await (window as any).electronAPI.addHistory({
          id: Date.now().toString(),
          url: options.url,
          source: sourceName,
          fileName: savedName,
          filePath: res.filePath,
          timestamp: Date.now(),
          format: options.format
        });
        loadHistory();
      }

      if (res.alreadyExists) {
        setShowAlreadyExistsModal(true);
      } else {
        setShowSuccessModal(true);
      }
    } else {
      setStatus(`Error: ${res.error}`);
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

  if (!binariesReady) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans text-center px-6">
        {status.startsWith('Error') ? (
          <>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
               <span className="text-red-500 font-bold text-lg">!</span>
            </div>
            <div className="text-[14px] font-semibold text-red-400 mb-2">Initialization Failed</div>
            <div className="text-[12px] font-medium text-secondaryText max-w-md">{status}</div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin mb-5"></div>
            <div className="text-[14px] font-semibold text-primaryText mb-2">Asset Downloader</div>
            <div className="text-[12px] font-medium text-secondaryText">{status || 'Initializing engine...'}</div>
          </>
        )}
      </div>
    );
  }

  const filteredHistory = historyItems
    .filter(item => filterSource === 'All Sources' || item.source === filterSource);

  const [showOnboarding, setShowOnboarding] = useState(
    localStorage.getItem('onboardingComplete') !== 'true'
  );

  return (
    <>
      {showOnboarding && <Onboarding onComplete={() => setShowOnboarding(false)} />}
      <div className="flex-1 w-full bg-background overflow-y-auto overflow-x-hidden font-sans text-primaryText text-[12px] flex flex-col">
      <div className="px-6 pt-5 pb-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-[14px] font-semibold">Asset Downloader</h1>
          </div>

          {/* Tabs */}
          <div className="border-b border-border mb-5">
            <div className="flex gap-6 -mb-px">
              <button 
                onClick={() => setActiveTab('download')}
                className={`font-medium text-[13px] border-b-2 pb-2 px-1 transition-all ${activeTab === 'download' ? 'text-accent border-accent' : 'text-secondaryText border-transparent hover:text-primaryText hover:border-border'}`}
              >
                Download
              </button>
              <button 
                onClick={() => { setActiveTab('history'); setFilterSource('All Sources'); }}
                className={`font-medium text-[13px] border-b-2 pb-2 px-1 transition-all ${activeTab === 'history' ? 'text-accent border-accent' : 'text-secondaryText border-transparent hover:text-primaryText hover:border-border'}`}
              >
                History
              </button>
            </div>
          </div>

          {activeTab === 'download' ? (
          <div className="space-y-5">
            
            {/* Source URL */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-secondaryText">Source URL</label>
                {urlError && <span className="text-[11px] font-medium text-red-400">{urlError}</span>}
              </div>
              <Input 
                placeholder="Paste video or audio link here..." 
                className={`w-full ${urlError ? 'border-red-500 focus-visible:border-red-500 text-red-400 placeholder:text-red-400/50' : ''}`}
                value={url}
                onChange={(e: any) => setUrl(e.target.value)}
              />
            </div>

            {/* File Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-secondaryText">File Name</label>
              <Input 
                placeholder="Enter custom file name (optional)..." 
                className="w-full"
                value={fileName}
                onChange={(e: any) => setFileName(e.target.value)}
              />
            </div>

            {/* Quality & Format Row */}
            <div className="flex gap-6">
              <div className="flex-1 space-y-1">
                <label className="text-[11px] font-medium text-secondaryText">Quality</label>
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
              
              <div className="flex-1 space-y-1">
                <label className="text-[11px] font-medium text-secondaryText">Format</label>
                <div className="flex items-center gap-1 border border-border/60 rounded-md p-1 bg-background h-9 w-full">
                  <button 
                    onClick={() => setFormat('video')}
                    className={`flex-1 h-full rounded text-[12px] font-medium transition-all ${format === 'video' ? 'bg-surface text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                  >
                    Video + Audio
                  </button>
                  <button 
                    onClick={() => setFormat('audio')}
                    className={`flex-1 h-full rounded text-[12px] font-medium transition-all ${format === 'audio' ? 'bg-surface text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                  >
                    Audio Only
                  </button>
                </div>
              </div>
            </div>

            {/* Time Range Row (Only for YouTube) */}
            {isYoutubeUrl && (
              <div className="border border-border rounded p-3 bg-background flex flex-col justify-center min-h-[100px]">
                {maxDuration > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[12px] font-medium text-primaryText">Duration</span>
                      <span className="text-[12px] font-medium text-accent">{formatTime(maxDuration)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between border border-border rounded-md px-3 py-2 bg-surface text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-secondaryText" />
                        <span className="text-secondaryText font-medium">Start</span>
                        <input 
                          type="text"
                          value={startText}
                          onChange={(e) => setStartText(e.target.value)}
                          onBlur={handleStartBlur}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          className="bg-background px-1.5 py-0.5 border border-border rounded text-primaryText w-[60px] text-center focus:outline-none focus:border-accent"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        <span className="text-secondaryText font-medium">End</span>
                        <input 
                          type="text"
                          value={endText}
                          onChange={(e) => setEndText(e.target.value)}
                          onBlur={handleEndBlur}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          className="bg-background px-1.5 py-0.5 border border-border rounded text-primaryText w-[60px] text-center focus:outline-none focus:border-accent"
                        />
                        <Clock className="w-3.5 h-3.5 text-secondaryText" />
                      </div>
                    </div>

                    <div className="px-1 pt-1 pb-1">
                      <RangeSlider min={0} max={maxDuration} value={sliderRange} onChange={setSliderRange} />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-secondaryText space-y-2">
                    <Clock className="w-6 h-6 opacity-50 animate-pulse" />
                    <span className="text-[11px]">Fetching metadata...</span>
                  </div>
                )}
              </div>
            )}

            {/* Destination Path */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-secondaryText">Destination Path</label>
              <div className="flex gap-2">
                <Input value={destPath} readOnly className="flex-1 text-secondaryText" placeholder="Select a folder..." />
                <Button variant="browse" className="shrink-0 flex items-center" onClick={handleBrowse}>
                  <Folder className="w-3.5 h-3.5 mr-1.5" />
                  Browse
                </Button>
              </div>
            </div>

            {/* Progress Section */}
            <div className="pt-2 pb-1 space-y-2">
              <div className="flex justify-between items-center text-[11px] font-medium">
                <span className={status.startsWith('Error') ? "text-error" : "text-accent"}>{status}</span>
                <div className="flex items-center">
                  {(isDownloading && eta) && (
                    <>
                      <span className="text-secondaryText">ETA: {eta}</span>
                      <span className="text-border" style={{ margin: '0 14px' }}>•</span>
                    </>
                  )}
                  {(isDownloading || progress > 0) && <span className="text-accent min-w-[40px] text-right">{progress.toFixed(1)}%</span>}
                </div>
              </div>
              {(isDownloading || progress > 0) && <ProgressBar progress={progress} />}
            </div>

            {/* Download Button Area */}
            <div className="-mt-1 flex justify-between items-center">
              <div>
                {formError && (
                  <div className="text-[11px] text-error font-medium px-3 py-1.5 bg-error/10 border border-error/20 rounded-md">
                    {formError}
                  </div>
                )}
              </div>
              <Button onClick={() => handleDownload()} disabled={isDownloading || !binariesReady} className="w-[120px]">
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>
          </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex gap-3 mb-5 shrink-0 justify-end items-center">
                <span className="text-[12px] text-secondaryText flex items-center gap-1.5 font-medium">
                   <Filter className="w-3.5 h-3.5" />
                   Source
                </span>
                <div className="w-[150px]">
                  <Dropdown
                    options={[
                      { label: 'All Sources', value: 'All Sources' },
                      { label: 'YouTube', value: 'YouTube' },
                      { label: 'Instagram', value: 'Instagram' },
                      { label: 'TikTok', value: 'TikTok' },
                      { label: 'X/Twitter', value: 'X/Twitter' },
                      { label: 'Other', value: 'Other' }
                    ]}
                    value={filterSource}
                    onChange={(e: any) => setFilterSource(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-2 pr-1 pb-4 flex flex-col">
                {filteredHistory.map(item => (
                    <div key={item.id} className="bg-surface/50 border border-border/40 hover:border-border/80 rounded-lg p-3 transition-colors flex items-center justify-between gap-3 group">
                       <div className="flex items-center gap-3 overflow-hidden">
                         <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                           {item.format === 'audio' ? <Music className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                         </div>
                         <div className="overflow-hidden">
                           <div className="text-[12px] font-medium text-primaryText truncate w-[300px]">{item.fileName}</div>
                           <div className="text-[10px] text-secondaryText mt-0.5 flex gap-2">
                             <span className="text-accent/80 font-medium">{item.source}</span>
                             <span>•</span>
                             <span>{new Date(item.timestamp).toLocaleString()}</span>
                           </div>
                         </div>
                       </div>
                       <Button 
                         variant="secondary" 
                         className="shrink-0 h-7 text-[11px] px-3 opacity-0 group-hover:opacity-100 transition-opacity"
                         onClick={() => (window as any).electronAPI.showItemInFolder(item.filePath)}
                       >
                         Reveal
                       </Button>
                    </div>
                ))}
                {historyItems.length > 0 && filteredHistory.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-secondaryText pb-10">
                    <div className="w-16 h-16 rounded-full bg-surface border border-border/40 flex items-center justify-center mb-5 opacity-70">
                      <SearchX className="w-8 h-8 text-secondaryText" />
                    </div>
                    <span className="text-[14px] font-bold text-primaryText mb-2">No result found</span>
                    <span className="text-[12px] mb-6">We can't find any item matching your search.</span>
                    <Button variant="secondary" onClick={() => { setFilterSource('All Sources'); }} className="h-9 text-[12px] px-5 font-medium flex items-center gap-2">
                       <RotateCcw className="w-4 h-4" />
                       Reset filter
                    </Button>
                  </div>
                )}
                {historyItems.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-secondaryText opacity-50 pb-10">
                    <Clock className="w-8 h-8 mb-2" />
                    <span>No download history yet</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="bg-surface border border-border/80 w-[340px] rounded-xl shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-success/20 text-success flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h2 className="text-[16px] font-semibold text-primaryText mb-2">Download Complete!</h2>
            <p className="text-[13px] text-secondaryText mb-6">
              Your file has been successfully saved to the destination folder.
            </p>
            <div className="flex w-full gap-3">
              <Button 
                variant="secondary" 
                className="flex-1"
                onClick={() => {
                  setShowSuccessModal(false);
                  resetForm();
                }}
              >
                Close
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 flex items-center justify-center gap-1.5"
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
                <Folder className="w-3.5 h-3.5" />
                Reveal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Already Exists Modal */}
      {showAlreadyExistsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="bg-surface border border-border/80 w-[400px] rounded-xl shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mb-5">
              <Folder className="w-7 h-7 text-red-500" />
            </div>
            
            <h3 className="text-primaryText font-semibold text-lg mb-2">File Already Exists</h3>
            <p className="text-secondaryText text-[13px] mb-8 max-w-[300px]">
              A file with this name is already in the folder.
            </p>
            
            <div className="flex w-full gap-3">
              <Button 
                variant="secondary" 
                className="flex-1 text-[13px] whitespace-nowrap"
                onClick={() => {
                  setShowAlreadyExistsModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 text-[13px] whitespace-nowrap"
                onClick={() => {
                  setShowAlreadyExistsModal(false);
                  handleDownloadAsNew();
                }}
              >
                Save as New
              </Button>
            </div>
            
            <button 
              onClick={() => {
                (window as any).electronAPI.showItemInFolder(downloadedFilePath);
                setShowAlreadyExistsModal(false);
                resetForm();
              }}
              className="mt-6 flex items-center gap-2 text-secondaryText hover:text-primaryText text-[13px] transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Reveal existing file
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
