// =============================================
// Background Service Worker — Media Sniffer
// =============================================
// Intercepts network requests to detect downloadable media files.
// Maintains a per-tab list of detected media and communicates
// with the Electron desktop app via WebSocket.

const MEDIA_EXTENSIONS = [
  '.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.f4v',
  '.m3u8', '.mpd', '.ts',
  '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac'
];

const MEDIA_MIME_TYPES = [
  'video/', 'audio/',
  'application/vnd.apple.mpegurl',  // HLS
  'application/x-mpegurl',           // HLS alt
  'application/dash+xml',            // DASH
  'application/octet-stream'         // Sometimes used for media
];

// Per-tab detected media: Map<tabId, MediaItem[]>
const detectedMedia = new Map();

// WebSocket connection state
let ws = null;
let wsConnected = false;

// ---- WebSocket Connection to Desktop App ----

let keepAliveInterval = null;

function connectToApp() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket('ws://localhost:9555');

    ws.onopen = () => {
      wsConnected = true;
      updateAllBadges();
      console.log('[FrameVault] Connected to desktop app');
      
      // Start heartbeat to keep Service Worker alive
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      keepAliveInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 20000); // 20 seconds
    };

    ws.onclose = () => {
      wsConnected = false;
      ws = null;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      updateAllBadges();
      // Retry connection every 5 seconds
      setTimeout(connectToApp, 5000);
    };

    ws.onerror = () => {
      wsConnected = false;
      ws = null;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') {
          wsConnected = true;
        }
      } catch (e) { /* ignore */ }
    };
  } catch (e) {
    wsConnected = false;
    setTimeout(connectToApp, 5000);
  }
}

function sendToApp(url, quality = 'best', format = 'mp4') {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectToApp();
    return false;
  }

  ws.send(JSON.stringify({
    type: 'download',
    url: url,
    quality: quality,
    format: format
  }));
  return true;
}

// ---- Media Detection ----

function getMediaType(url) {
  const lower = url.toLowerCase().split('?')[0].split('#')[0];

  if (lower.endsWith('.m3u8') || lower.includes('m3u8')) return 'HLS';
  if (lower.endsWith('.mpd')) return 'DASH';
  if (lower.match(/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/)) return 'AUDIO';
  if (lower.match(/\.(mp4|webm|mkv|avi|mov|flv|f4v)$/)) return 'VIDEO';
  return 'FILE';
}

function getQualityHint(url) {
  const match = url.match(/(\d{3,4})p/i);
  if (match) return match[1] + 'p';

  if (url.includes('1080')) return '1080p';
  if (url.includes('720')) return '720p';
  if (url.includes('480')) return '480p';
  if (url.includes('360')) return '360p';
  if (url.includes('4k') || url.includes('2160')) return '4K';
  return '';
}

function getFileName(url) {
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) {
      return decodeURIComponent(last).substring(0, 60);
    }
  } catch (e) { /* ignore */ }
  return '';
}

function isMediaUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0].split('#')[0];

  // Skip tiny tracking pixels, analytics, etc.
  if (lower.includes('googlevideo.com/videoplayback')) return true;

  for (const ext of MEDIA_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

function addMediaToTab(tabId, mediaItem) {
  if (!detectedMedia.has(tabId)) {
    detectedMedia.set(tabId, []);
  }
  const list = detectedMedia.get(tabId);

  // Deduplicate by URL (ignore query params for dedup)
  const baseUrl = mediaItem.url.split('?')[0];
  const exists = list.some(item => item.url.split('?')[0] === baseUrl);
  if (exists) return;

  list.push(mediaItem);
  updateBadge(tabId);
}

// ---- Badge Management ----

function updateBadge(tabId) {
  const list = detectedMedia.get(tabId) || [];
  const count = list.length;

  chrome.action.setBadgeBackgroundColor({ color: wsConnected ? '#f5a319' : '#ef4444', tabId });
  chrome.action.setBadgeText({
    text: count > 0 ? String(count) : '',
    tabId
  });
}

function updateAllBadges() {
  for (const tabId of detectedMedia.keys()) {
    updateBadge(tabId);
  }
}

// ---- Network Request Interception ----

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return; // Skip non-tab requests
    if (details.type === 'main_frame') return; // Skip page navigation

    const url = details.url;
    if (!url.startsWith('http')) return;

    // Check by URL extension
    if (isMediaUrl(url)) {
      addMediaToTab(details.tabId, {
        url: url,
        type: getMediaType(url),
        quality: getQualityHint(url),
        fileName: getFileName(url),
        timestamp: Date.now()
      });
    }
  },
  { urls: ['<all_urls>'] }
);

// Also check response headers for MIME type
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.type === 'main_frame') return;

    const contentType = details.responseHeaders?.find(
      h => h.name.toLowerCase() === 'content-type'
    )?.value || '';

    const isMedia = MEDIA_MIME_TYPES.some(mime => contentType.includes(mime));

    if (isMedia && !isMediaUrl(details.url)) {
      // Detected via MIME type but not by extension
      const contentLength = details.responseHeaders?.find(
        h => h.name.toLowerCase() === 'content-length'
      )?.value;

      const sizeBytes = contentLength ? parseInt(contentLength) : 0;
      // Skip tiny files (< 100KB) — likely not actual media
      if (sizeBytes > 0 && sizeBytes < 100 * 1024) return;

      addMediaToTab(details.tabId, {
        url: details.url,
        type: contentType.includes('audio') ? 'AUDIO' : 'VIDEO',
        quality: getQualityHint(details.url),
        fileName: getFileName(details.url),
        size: sizeBytes,
        timestamp: Date.now()
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// ---- Tab Lifecycle ----

chrome.tabs.onRemoved.addListener((tabId) => {
  detectedMedia.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    // Clear detected media when page navigates
    detectedMedia.delete(tabId);
    updateBadge(tabId);
  }
});

// ---- Message Handling (from popup & content scripts) ----

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getDetectedMedia') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      sendResponse({
        media: tabId ? (detectedMedia.get(tabId) || []) : [],
        connected: wsConnected
      });
    });
    return true; // async response
  }

  if (message.type === 'sendToApp') {
    const success = sendToApp(message.url, message.quality, message.format);
    sendResponse({ success });
    return false;
  }

  if (message.type === 'sendPageUrl') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url;
      if (url) {
        const success = sendToApp(url);
        sendResponse({ success });
      } else {
        sendResponse({ success: false });
      }
    });
    return true; // async
  }

  if (message.type === 'getConnectionStatus') {
    sendResponse({ connected: wsConnected });
    return false;
  }

  if (message.type === 'reconnect') {
    connectToApp();
    sendResponse({ ok: true });
    return false;
  }
});

// ---- Init ----
connectToApp();
console.log('[FrameVault] Background service worker started');
