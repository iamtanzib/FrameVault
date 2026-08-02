# Implementation Phases Plan

## Phase 1: Binary Provisioner & Core Downloader Logic
- **Goal**: Initialize the monorepo, implement the auto-downloader for `yt-dlp` and `FFmpeg` binaries, and create the wrapper for fetching/downloading videos.
- **What to build**: Monorepo structure, `core-downloader` package containing the Binary Provisioner (fetches from GitHub to `~/.aio_downloader_bin/`) and the `child_process.spawn()` wrapper for `yt-dlp`.
- **Files to create/modify**: `package.json`, `packages/core-downloader/provisioner.ts`, `packages/core-downloader/yt-dlp-wrapper.ts`.
- **Dependencies**: Node.js built-ins (`fs`, `path`, `child_process`, `https`), `axios` or similar for downloading releases.
- **Expected output**: A CLI-testable Node module that auto-downloads the binaries on first run, then takes a URL, applies advanced `yt-dlp` arguments, parses stdout for progress, and downloads a file.
- **Manual testing checklist**: Run script, verify `~/.aio_downloader_bin/` populates with binaries, and a YouTube URL successfully downloads and merges using local FFmpeg.
- **Completion criteria**: Successfully auto-provisioning binaries and downloading a video programmatically with real-time stdout progress.
- **Prompt for AI**: "Please start Phase 1. Initialize the monorepo structure and set up the `core-downloader` package. Implement a Binary Provisioner that auto-downloads `yt-dlp` and `FFmpeg` from GitHub releases to `~/.aio_downloader_bin/`. Then, implement the core downloader logic using `child_process.spawn()` with advanced yt-dlp arguments (like --ffmpeg-location, parallel fragments, etc.) and parse stdout to track progress. Make it CLI-testable."

## Phase 2: Shared UI Components & Design System
- **Goal**: Build the reusable React components styled for the Adobe environment.
- **What to build**: Input fields, buttons, progress bars, dropdowns, and the foundational layout.
- **Files to create/modify**: `packages/ui-components/src/*`, Tailwind configuration.
- **Dependencies**: React, Tailwind CSS, Lucide Icons.
- **Expected output**: A Storybook or simple Vite preview of all components in Dark Mode.
- **Manual testing checklist**: Verify hover states, disabled states, and color contrast.
- **Completion criteria**: All primary UI elements defined in Design.md are built and viewable.
- **Prompt for AI**: "Let's move on to Phase 2. Set up the `ui-components` React package with Tailwind CSS configured for an Adobe Dark Theme as specified in Design.md. Build the foundational reusable components including the URL input field, primary/secondary buttons, icon buttons, dropdowns, and progress bar."

## Phase 3: Standalone Desktop Application (Electron)
- **Goal**: Combine Core Logic and UI into the standalone desktop app.
- **What to build**: Electron main process (IPC handlers), Renderer process (React App routing).
- **Files to create/modify**: `apps/standalone/main.ts`, `apps/standalone/preload.ts`, `apps/standalone/src/App.tsx`.
- **Dependencies**: Electron, electron-builder.
- **Expected output**: A launchable desktop app that allows downloading videos.
- **Manual testing checklist**: Paste URL, select settings, download, verify file on disk, check progress bar updates from stdout parsing.
- **Completion criteria**: Full downloader MVP working in the standalone app with live progress tracking.
- **Prompt for AI**: "Please execute Phase 3. Create the standalone Electron application in the `apps/standalone` folder. Connect the React UI from Phase 2 with the core downloader logic from Phase 1 using Electron IPC. Make sure the app can successfully trigger the binary provisioner, take a URL, show a real-time progress bar from yt-dlp's stdout, and save the downloaded file to disk."

## Phase 4: Advanced Reference Video Player
- **Goal**: Create the React-based video player with frame-by-frame scrubbing.
- **What to build**: `VideoPlayer` component, timeline scrubber, FPS calculation logic.
- **Files to create/modify**: `packages/ui-components/src/VideoPlayer.tsx`.
- **Dependencies**: Optional frame extraction libraries if HTML5 `<video>` is insufficient for frame accuracy.
- **Expected output**: A player component that accepts a local video file path and can step precisely by frames.
- **Manual testing checklist**: Load video, test spacebar to play/pause, use arrow keys to scrub frames.
- **Completion criteria**: Smooth scrubbing and accurate frame stepping.
- **Prompt for AI**: "It's time for Phase 4. Please build the Advanced Reference Video Player component in the `ui-components` package. It needs a custom control bar, timeline scrubber, and logic for precise frame-by-frame scrubbing. Ensure it can accept a local video file path and handle keyboard shortcuts for playback."

## Phase 5: Adobe Premiere Pro Extension Integration
- **Goal**: Port the app into a Premiere Pro CEP extension.
- **What to build**: CSXS `manifest.xml` (with `--enable-nodejs`), extension HTML entry point, ExtendScript for timeline imports.
- **Files to create/modify**: `apps/premiere-ext/CSXS/manifest.xml`, `apps/premiere-ext/index.html`, `apps/premiere-ext/jsx/premiere.jsx`.
- **Dependencies**: `cep-interface` or similar types.
- **Expected output**: An extension panel loadable via `Window -> Extensions`.
- **Manual testing checklist**: Enable PlayerDebugMode in registry, launch Premiere, open panel, test binary provisioning, download video, play in reference player.
- **Completion criteria**: Extension runs in Premiere Pro perfectly and auto-downloads binaries if missing.
- **Prompt for AI**: "Start Phase 5. Port our application into an Adobe Premiere Pro CEP extension in `apps/premiere-ext`. Create the necessary CSXS manifest (ensuring `--enable-nodejs` is active), HTML entry point, and ExtendScript files. Ensure the downloader and video player run smoothly within the Premiere Pro panel, utilizing the local yt-dlp binaries."

## Phase 6: Adobe After Effects Extension Integration
- **Goal**: Port the app into an After Effects CEP extension.
- **What to build**: AE-specific `manifest.xml` config and ExtendScript.
- **Files to create/modify**: `apps/ae-ext/CSXS/manifest.xml`, `apps/ae-ext/jsx/ae.jsx`.
- **Expected output**: An extension panel loadable in After Effects.
- **Manual testing checklist**: Launch AE, open panel, test functionality.
- **Completion criteria**: Extension runs in After Effects with all features parity.
- **Prompt for AI**: "Please implement Phase 6. Create the After Effects CEP extension in `apps/ae-ext` by adapting the configuration and ExtendScript from the Premiere Pro extension. Ensure full feature parity and that it functions correctly as an After Effects panel."

## Phase 7: Polish, Trimming UI, & Build Pipeline
- **Goal**: Finalize user experience, add timeline trimming UI, and configure production builds.
- **What to build**: Trimming range slider UI, production bundler scripts (ZXP creation).
- **Files to create/modify**: `packages/ui-components/src/TrimSlider.tsx`, build scripts in root `package.json`.
- **Dependencies**: `zxp-sign-cmd` or ZXPSignCmd.
- **Expected output**: Installable `.zxp` files for the extensions and `.exe`/`.dmg` for the standalone app.
- **Manual testing checklist**: Install ZXP via an extension manager, run installers, verify production builds work without dev tools.
- **Completion criteria**: Project is ready for release.
- **Prompt for AI**: "Let's finish up with Phase 7. Implement the timeline trimming range slider in the UI, and set up the production build pipeline. Create the necessary scripts to bundle the Electron app into executables and package the Adobe extensions into installable `.zxp` files using `zxp-sign-cmd`."
