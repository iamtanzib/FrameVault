import { useState } from 'react';
import { Button, Input } from '@aio-downloader/ui';
import { DownloadCloud, Folder, Chrome, CheckCircle, ArrowRight, Film } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [destPath, setDestPath] = useState(localStorage.getItem('lastDestPath') || '');
  const [launchOnStartup, setLaunchOnStartup] = useState(true);

  const handleSelectFolder = async () => {
    const res = await (window as any).electronAPI.selectFolder();
    if (res) {
      setDestPath(res);
      localStorage.setItem('lastDestPath', res);
    }
  };

  const handleComplete = () => {
    (window as any).electronAPI.updateSettings?.({ launchOnStartup });
    localStorage.setItem('onboardingComplete', 'true');
    onComplete();
  };

  const destName = destPath ? destPath.split(/[\\/]/).filter(Boolean).pop() : '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background font-sans">
      {/* Draggable titlebar region (frameless window) */}
      <div className="drag-region flex h-10 shrink-0 items-center gap-2 px-3 select-none">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-gradient-to-br from-accent to-accentHover shadow-glow-sm">
          <Film className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-primaryText">FrameVault</span>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-8 pb-6 text-center">
        {/* Progress dots */}
        <div className="mb-9 flex gap-1.5">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${step === i ? 'w-5 bg-accent' : step > i ? 'w-1.5 bg-accent/50' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="flex w-full flex-col items-center animate-slide-up">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accentHover shadow-glow">
              <DownloadCloud className="h-8 w-8 text-black" />
            </div>
            <h1 className="mb-2 text-[20px] font-semibold tracking-tight text-primaryText">Welcome to FrameVault</h1>
            <p className="mb-7 max-w-sm text-[13px] leading-relaxed text-secondaryText">
              The fastest, cleanest way to download video and audio from anywhere on the web. Let's get you set up in seconds.
            </p>
            <Button onClick={() => setStep(2)} className="w-full max-w-[240px] gap-2">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Download Folder */}
        {step === 2 && (
          <div className="flex w-full flex-col items-center animate-slide-up">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12">
              <Folder className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-primaryText">Where should we save files?</h2>
            <p className="mb-6 max-w-sm text-[13px] leading-relaxed text-secondaryText">
              Pick a default folder so you don't have to choose it every time.
            </p>

            <div className="mb-7 flex w-full gap-2">
              <Input
                value={destName}
                readOnly
                placeholder="Choose a directory..."
                className="flex-1 text-[13px]"
              />
              <Button onClick={handleSelectFolder} variant="secondary" className="px-5">Browse</Button>
            </div>

            <div className="flex w-full gap-3">
              <Button onClick={() => setStep(1)} variant="secondary" className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!destPath}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Chrome Extension */}
        {step === 3 && (
          <div className="flex w-full flex-col items-center animate-slide-up">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/12">
              <Chrome className="h-7 w-7 text-accent" />
            </div>
            <h2 className="mb-2 text-[18px] font-semibold tracking-tight text-primaryText">Install the extension</h2>
            <p className="mb-5 max-w-sm text-[13px] leading-relaxed text-secondaryText">
              For 1-click downloads straight from your browser, load the FrameVault extension in Chrome.
            </p>

            <div className="mb-7 w-full rounded-xl border border-border bg-surface p-4 text-left">
              <ol className="list-inside list-decimal space-y-2.5 text-[12px] leading-relaxed text-secondaryText">
                <li>Open <span className="rounded bg-accent/12 px-1.5 py-0.5 font-medium text-accent">chrome://extensions</span></li>
                <li>Enable <strong className="font-semibold text-primaryText">Developer Mode</strong> (top right)</li>
                <li>Click <strong className="font-semibold text-primaryText">Load unpacked</strong></li>
                <li>Select the <code className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-primaryText">apps/chrome-extension</code> folder</li>
              </ol>
            </div>

            <div className="flex w-full gap-3">
              <Button onClick={() => setStep(2)} variant="secondary" className="flex-1">Back</Button>
              <Button onClick={() => setStep(4)} className="flex-1">I've done it</Button>
            </div>
          </div>
        )}

        {/* Step 4: All Set */}
        {step === 4 && (
          <div className="flex w-full flex-col items-center animate-slide-up">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-[20px] font-semibold tracking-tight text-primaryText">You're all set</h2>
            <p className="mb-6 max-w-sm text-[13px] leading-relaxed text-secondaryText">
              Everything's configured. You're ready to start downloading at lightning speed.
            </p>

            <div 
              className="mb-8 flex w-full max-w-[280px] cursor-pointer items-center justify-between rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-borderStrong"
              onClick={() => setLaunchOnStartup(!launchOnStartup)}
            >
              <div>
                <div className="text-[13px] font-medium text-primaryText">Launch on Startup</div>
                <div className="text-[11px] text-secondaryText">Run quietly in the background</div>
              </div>
              <div className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${launchOnStartup ? 'bg-accent' : 'bg-black/40 ring-1 ring-inset ring-white/10'}`}>
                <div className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white transition-transform ${launchOnStartup ? 'translate-x-[18px] shadow-sm' : 'translate-x-0 opacity-70'}`} />
              </div>
            </div>

            <Button onClick={handleComplete} className="w-full max-w-[280px] gap-2">
              Launch FrameVault <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
