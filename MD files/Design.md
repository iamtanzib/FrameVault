# Global UX & Design Principles

This document serves as the absolute source of truth for all User Experience (UX) and Design implementations across the `aio-downloader` project. All new features and UI updates MUST adhere strictly to these principles.

## 1. Zero UI Cutoff or Overlap
The user interface must always be fully visible, functional, and accessible.
- **No Cutoffs**: The physical window height and width must always comfortably encapsulate the entire UI. If a dynamic component (like a dropdown or a new section) pushes the layout beyond the physical window boundaries, the container MUST utilize `overflow-y-auto` to allow graceful scrolling rather than permanently cutting off functionality (like download buttons).
- **No Overlap**: Elements must maintain their structural integrity. Text should not overlap, buttons should have adequate margins (`margin`/`gap`), and absolute positioning must be used cautiously to prevent obscuring underlying interactive elements.

## 2. Every Action Has a Visual Output
The user should never be left wondering if the app is frozen or if their input was ignored.
- **Immediate Feedback**: Every click, keystroke, or command must trigger an immediate visual change (e.g., a loader, a button state change, or a status text update).
- **Graceful Error Handling**: Even if a process completely fails (like a network timeout or binary initialization error), the UI must explicitly display a user-friendly error state rather than remaining blank or silent. A silent failure makes the app feel broken.
- **Startup UX**: Applications must not flash blank screens during startup. CSS-only loaders should be injected into the root HTML to cover the framework initialization phase.

## 3. Premium Aesthetics & Space
The application should feel like a modern, professional utility tool.
- **Breathing Room**: Avoid cramped layouts. Ensure proper spacing (e.g., `gap-3`, `mx-4`) between related elements like ETA labels and progress percentages.
- **Consistent Color Palette**: Strictly adhere to the predefined Tailwind palette (backgrounds, surfaces, borders, primary/secondary text). Do not use arbitrary generic colors unless heavily modified for specific error/success states.
- **Focused Utility Design**: If a window serves a single utility purpose (like the standalone downloader), lock its size, disable maximizing, and hide the default OS menu bars to mimic a true native utility rather than a generic web page.

## 4. Smart Defaults
The app should do the heavy lifting for the user.
- Automatically correct minor user errors (e.g., auto-prepending `https://` to URLs).
- Use the most efficient background path possible (e.g., skipping `ffmpeg` compilation if the user is downloading a full-length video, rather than forcing it through a chunking process).