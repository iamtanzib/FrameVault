import { useState } from 'react';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Dropdown } from './components/Dropdown';
import { ProgressBar } from './components/ProgressBar';
import { Settings, Folder } from 'lucide-react';

function App() {
  const [progress, setProgress] = useState(45.2);
  const [format, setFormat] = useState<'video' | 'audio'>('video');

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center font-sans text-primaryText">
      <div className="w-full max-w-[550px] bg-background border border-border overflow-hidden shadow-xl text-[12px]">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-[14px] font-semibold">Asset Downloader</h1>
            <Button variant="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-border mb-5 pb-2">
            <button className="text-accent font-medium text-[12px] border-b-2 border-accent pb-1 -mb-[9px]">Download</button>
            <button className="text-secondaryText hover:text-primaryText font-medium text-[12px] transition-colors pb-1">History</button>
          </div>

          <div className="space-y-5">
            
            {/* Source URL */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-secondaryText">Source URL</label>
              <Input placeholder="Paste video or audio link here..." className="w-full" />
            </div>

            {/* Middle Row: Quality/Format & Time Range */}
            <div className="flex gap-6">
              
              {/* Left Column */}
              <div className="flex-1 space-y-5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-secondaryText">Quality</label>
                  <Dropdown 
                    options={[
                      { label: 'Best Available', value: 'best' },
                      { label: '1080p', value: '1080' },
                      { label: '720p', value: '720' }
                    ]} 
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-secondaryText">Format</label>
                  <div className="flex items-center gap-1 border border-border rounded p-[2px] bg-background w-fit">
                    <button 
                      onClick={() => setFormat('video')}
                      className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${format === 'video' ? 'bg-surface text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                    >
                      Video + Audio
                    </button>
                    <button 
                      onClick={() => setFormat('audio')}
                      className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${format === 'audio' ? 'bg-surface text-primaryText shadow-sm' : 'text-secondaryText hover:text-primaryText'}`}
                    >
                      Audio Only
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Time Range */}
              <div className="flex-1 space-y-1 border border-border rounded p-3 bg-background">
                <label className="text-[11px] font-medium text-secondaryText block mb-2">Time Range (Optional)</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-secondaryText w-10">Start</span>
                    <Input placeholder="00:00:00" className="w-24 text-center h-[24px] text-[11px]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-secondaryText w-10">End</span>
                    <Input placeholder="00:00:00" className="w-24 text-center h-[24px] text-[11px]" />
                  </div>
                </div>
              </div>

            </div>

            {/* Destination Path */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-secondaryText">Destination Path</label>
              <div className="flex gap-2">
                <Input value="/Users/editor/Downloads/Project_Alpha" readOnly className="flex-1 text-secondaryText" />
                <Button variant="browse" className="shrink-0 flex items-center">
                  <Folder className="w-3.5 h-3.5 mr-1.5" />
                  Browse
                </Button>
              </div>
            </div>

            {/* Progress Section */}
            <div className="pt-2 pb-1">
              <div className="flex justify-between items-center text-[11px] font-medium text-accent">
                <span>Downloading source_file_v2.mp4...</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <ProgressBar progress={progress} />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end bg-surface">
          <Button variant="primary">Download</Button>
        </div>

      </div>

      {/* Temp dev controls */}
      <div className="mt-8 flex gap-2">
        <Button variant="browse" onClick={() => setProgress(0)}>Reset Progress</Button>
        <Button variant="browse" onClick={() => setProgress(p => Math.min(100, p + 15))}>+15%</Button>
      </div>
    </div>
  );
}

export default App;
