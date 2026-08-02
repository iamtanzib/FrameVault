# Development Rules & Guidelines

## What to Do
- **Prioritize UX**: The app must feel like a native Adobe product. Follow their design language (Spectrum).
- **Modularize Code**: Keep the downloading logic entirely separate from the UI components. The core logic must run equally well in Electron and CEP.
- **Use Strict TypeScript**: Define explicit types for all function returns, API responses, and IPC messages.
- **Graceful Degradation**: If `yt-dlp` fails to fetch a 4K stream, fallback to the next highest available and inform the user.
- **Frame Accuracy**: For the video player, ensure frame-by-frame scrubbing actually steps by the correct FPS interval, not just an arbitrary time jump.

## What Not to Do
- **Do not build a custom scraper**: Rely on established open-source tools like `yt-dlp` that are actively maintained against platform changes.
- **Do not clutter the UI**: Keep the downloader clean. Hide advanced settings (like custom cookies for private videos) behind an "Advanced" toggle.
- **Do not block the main thread**: All downloads and heavy video processing must be done in background Node processes or Web Workers.

## Coding Standards
- Use functional React components with Hooks.
- Follow ESLint standard rules + Prettier for formatting.
- File naming: `PascalCase` for React components (`VideoPlayer.tsx`), `kebab-case` for utilities/modules (`download-manager.ts`).
- Commit messages: Follow Conventional Commits (`feat:`, `fix:`, `chore:`).

## Error Handling
- Never crash silently.
- Catch all IPC communication errors between the frontend and Node backend.
- Display human-readable error messages to the user (e.g., "This video is private and cannot be downloaded" instead of "HTTP 403 Forbidden").
- Log errors to a local log file for debugging user issues.

## AI Agent Boundaries
- **Scope Restriction**: Only implement the phase currently requested. Do not preemptively build out future phases.
- **No Destructive Operations**: Do not delete existing Adobe extension registry keys or modify system files outside the project directory without explicit confirmation.
- **Ask Before Refactoring**: If a major architectural change is deemed necessary, propose it to the user first.

## Best Practices
- **Testing**: Write unit tests for the core downloader URL parsing and timecode math.
- **CEP Debugging**: Always include `.debug` configuration for Adobe extensions to allow Chrome DevTools inspection.
- **Updates**: Provide a mechanism (or script) to auto-update the underlying `yt-dlp` binary, as social sites frequently change their APIs.
