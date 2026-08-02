// =============================================
// Extension Popup Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
  const statusDot = document.getElementById('statusDot');
  const sendPageBtn = document.getElementById('sendPageBtn');
  const mediaList = document.getElementById('mediaList');
  const emptyState = document.getElementById('emptyState');
  const sectionLabel = document.getElementById('sectionLabel');

  // ---- Load detected media & connection status ----

  chrome.runtime.sendMessage({ type: 'getDetectedMedia' }, (response) => {
    if (!response) return;

    // Update connection status
    if (response.connected) {
      statusDot.classList.add('connected');
      statusDot.title = 'Connected to desktop app';
    } else {
      statusDot.classList.remove('connected');
      statusDot.title = 'Desktop app not running';
    }

    // Render media list
    const media = response.media || [];

    if (media.length === 0) {
      emptyState.style.display = 'flex';
      sectionLabel.textContent = 'Detected Media';
      return;
    }

    emptyState.style.display = 'none';
    sectionLabel.textContent = `Detected Media (${media.length})`;

    // Sort: videos first, then HLS, audio, files
    const typeOrder = { VIDEO: 0, HLS: 1, DASH: 2, AUDIO: 3, FILE: 4 };
    media.sort((a, b) => (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4));

    media.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'media-item';

      const badgeClass = item.type.toLowerCase();
      const displayName = item.fileName || truncateUrl(item.url);
      const qualityStr = item.quality ? ` · ${item.quality}` : '';
      const sizeStr = item.size ? ` · ${formatSize(item.size)}` : '';

      el.innerHTML = `
        <div class="media-info">
          <span class="media-badge ${badgeClass}">${item.type}</span>
          <span class="media-name" title="${escapeHtml(item.url)}">${escapeHtml(displayName)}${qualityStr}${sizeStr}</span>
        </div>
        <button class="media-download-btn" data-index="${index}">Download</button>
      `;

      mediaList.appendChild(el);
    });

    // Handle individual download buttons
    mediaList.querySelectorAll('.media-download-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const item = media[idx];

        // Send the direct media URL to the app
        chrome.runtime.sendMessage({
          type: 'sendToApp',
          url: item.url,
          quality: 'best',
          format: item.type === 'AUDIO' ? 'mp3' : 'mp4'
        }, (response) => {
          if (response && response.success) {
            btn.textContent = 'Sent ✓';
            btn.classList.add('sent');
          } else {
            btn.textContent = 'Failed';
            btn.style.color = '#ef4444';
            setTimeout(() => {
              btn.textContent = 'Download';
              btn.style.color = '';
            }, 2000);
          }
        });
      });
    });
  });

  // ---- Send Page URL Button ----

  sendPageBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'sendPageUrl' }, (response) => {
      if (response && response.success) {
        sendPageBtn.textContent = 'Sent ✓';
        sendPageBtn.classList.add('success');
        setTimeout(() => window.close(), 1000);
      } else {
        sendPageBtn.textContent = 'App not running';
        sendPageBtn.classList.add('error');
        setTimeout(() => {
          sendPageBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Send Page URL to App
          `;
          sendPageBtn.classList.remove('error');
        }, 2000);
      }
    });
  });
});

// ---- Helpers ----

function truncateUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    return decodeURIComponent(path).substring(0, 45);
  } catch {
    return url.substring(0, 45);
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
