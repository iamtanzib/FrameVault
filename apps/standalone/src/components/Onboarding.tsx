import { useState } from 'react';
import { Button, Input } from '@aio-downloader/ui';
import { DownloadCloud, Folder, Chrome, CheckCircle, ChevronRight, X } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [destPath, setDestPath] = useState(localStorage.getItem('lastDestPath') || '');

  const handleSelectFolder = async () => {
    const res = await (window as any).electronAPI.selectFolder();
    if (res && res.path) {
      setDestPath(res.path);
      localStorage.setItem('lastDestPath', res.path);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('onboardingComplete', 'true');
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Draggable Titlebar region */}
      <div className="h-8 shrink-0 [app-region:drag]" />

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
        {/* Progress Dots */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3, 4].map(i => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= i ? 'bg-accent' : 'bg-surface border border-border/50'}`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center w-full">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6">
              <DownloadCloud className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-primaryText mb-4">Welcome to AIO Downloader</h1>
            <p className="text-secondaryText text-lg mb-8 max-w-md">
              The fastest, most reliable way to download media from anywhere on the web. Let's get you set up in just a few seconds.
            </p>
            <Button onClick={() => setStep(2)} className="w-full max-w-xs py-5 text-base">
              Get Started
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Step 2: Download Folder */}
        {step === 2 && (
          <div className="text-center animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <Folder className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-primaryText mb-2">Where should we save files?</h2>
            <p className="text-secondaryText mb-8">
              Pick a default folder so you don't have to choose it every time.
            </p>
            
            <div className="flex gap-2 w-full max-w-md mb-8">
              <Input 
                value={destPath} 
                readOnly 
                placeholder="Choose a directory..." 
                className="flex-1 bg-surface/50 font-mono text-sm" 
              />
              <Button onClick={handleSelectFolder} variant="secondary" className="px-6">
                Browse
              </Button>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <Button onClick={() => setStep(1)} variant="secondary" className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!destPath}>
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Chrome Extension */}
        {step === 3 && (
          <div className="text-center animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col items-center w-full">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
              <Chrome className="w-8 h-8 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-primaryText mb-2">Install the Extension</h2>
            <p className="text-secondaryText mb-6 max-w-md">
              For the magical "1-click download" experience, you need to load our extension in Chrome.
            </p>
            
            <div className="bg-surface/50 border border-border/50 rounded-xl p-5 mb-8 text-left max-w-md w-full">
              <ol className="text-sm text-secondaryText space-y-3 list-decimal list-inside">
                <li>Go to <span className="text-accent bg-accent/10 px-1 rounded">chrome://extensions</span> in Chrome</li>
                <li>Enable <strong>Developer Mode</strong> (top right toggle)</li>
                <li>Click <strong>Load unpacked</strong></li>
                <li>Select the <code className="text-primaryText bg-surface px-1 py-0.5 rounded border border-border/50">apps/chrome-extension</code> folder</li>
              </ol>
            </div>

            <div className="flex gap-3 w-full max-w-xs">
              <Button onClick={() => setStep(2)} variant="secondary" className="flex-1">Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                I've done it!
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: All Set */}
        {step === 4 && (
          <div className="text-center animate-in fade-in slide-in-from-right-8 duration-500 flex flex-col items-center w-full">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 text-green-500">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-bold text-primaryText mb-4">You're all set!</h2>
            <p className="text-secondaryText text-lg mb-8 max-w-md">
              Everything is configured perfectly. You're ready to start downloading videos at lightning speed.
            </p>
            
            <Button onClick={handleComplete} className="w-full max-w-xs py-5 text-base bg-green-600 hover:bg-green-500 text-white border-green-500">
              Launch App
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
