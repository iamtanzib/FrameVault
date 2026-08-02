# Product Requirements Document (PRD)

## Project Overview
The "All in One Downloader & Reference Viewer" is a suite of tools consisting of a standalone application and Adobe Premiere Pro/After Effects extensions. It aims to solve two major workflow bottlenecks for video editors: downloading high-quality stock/reference videos from social platforms without sketching websites or ads, and viewing reference clips with advanced controls (like frame-by-frame scrubbing) directly within their editing environment.

## What to Build
1. **Standalone Desktop Application**: A lightweight app to download videos from platforms like Instagram, Facebook, and YouTube, select specific segments to download, and choose video quality (up to 4K).
2. **Adobe Premiere Pro Extension**: A native-feeling panel within Premiere Pro featuring the downloader and an advanced reference video player.
3. **Adobe After Effects Extension**: A native-feeling panel within After Effects with identical functionality to the Premiere Pro extension.

## Target Users
- Professional Video Editors
- Motion Graphics Designers
- Content Creators
- Social Media Managers

## Features
### 1. Video Downloader (App & Extensions)
- **URL Input**: Paste links from supported platforms (Instagram, Facebook, YouTube, Pinterest, X/Twitter).
- **Segment Selection (Trimming)**: Ability to download the full video or a specific portion (Start/End timecode).
- **Quality Selection**: Choose output resolution (720p, 1080p, 4K, etc.) and format.
- **Output Location**: Custom directory selection for saving downloaded files.

### 2. Advanced Reference Video Player (Extensions)
- **Import Methods**: Drag-and-drop local files or load directly from the built-in downloader.
- **Playback Controls**: Play, pause, volume, loop.
- **Advanced Scrubbing**: Frame-by-frame scrubbing and precise timeline navigation.
- **Overlay/Reference Toggle**: Keep the reference window pinned or dockable within the Adobe workspace.

## Functional Requirements
- The downloader must leverage a reliable backend engine (e.g., `yt-dlp` packaged as a binary) to bypass ads and extract maximum quality.
- The extensions must use Adobe's Common Extensibility Platform (CEP) or Unified Extensibility Platform (UXP) to integrate with the host application.
- The video player must support common web-compatible video formats (MP4, WebM) and decode them efficiently.
- Users must be able to specify trim in/out points before downloading to save bandwidth and storage.

## Non-Functional Requirements
- **Performance**: The extension should not lag the main Adobe application. Downloads should be fast and multi-threaded if possible.
- **UI/UX**: Must perfectly match the Adobe dark theme (Apparent seamless integration).
- **Security**: No data collection, fully local processing aside from fetching the video stream. No sketchy ads.
- **Reliability**: Graceful error handling if a video URL is invalid or blocked.

## MVP Scope
- **Phase 1**: Standalone desktop app with URL input, full-video download, up to 4K quality, and output location selection.
- **Phase 2**: Premiere Pro and After Effects extensions containing the same downloader functionality.
- **Phase 3**: Integration of the Advanced Video Player into the extensions with frame-by-frame scrubbing for downloaded or dragged-and-dropped clips.
- **Out of Scope for MVP**: Account syncing, cloud storage, bulk downloading playlists (unless natively supported by the engine without extra UI).
