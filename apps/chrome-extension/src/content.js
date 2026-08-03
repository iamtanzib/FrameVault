// =============================================
// Content Script — Video Player Overlay Button
// =============================================
// Injects a floating "Download" button on detected <video> elements.
// Uses MutationObserver to catch dynamically-loaded players (SPA sites).

const BUTTON_CLASS = 'framevault-overlay-btn';
const PROCESSED_ATTR = 'data-aio-processed';

// Track mouse globally to detect hover reliably across invisible overlays
let mouseX = -1000;
let mouseY = -1000;
window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
}, { passive: true });

function createDownloadButton(videoElement) {
  // Don't double-process
  if (videoElement.getAttribute(PROCESSED_ATTR)) return;
  videoElement.setAttribute(PROCESSED_ATTR, 'true');

  // Create the button
  const btn = document.createElement('div');
  btn.className = BUTTON_CLASS;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span>Download</span>
  `;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Send the current page URL to the desktop app
    chrome.runtime.sendMessage({
      type: 'sendPageUrl'
    }, (response) => {
      if (response && response.success) {
        showToast('Sent to FrameVault!');
      } else {
        showToast('App not running. Launching FrameVault...', true);
        // Fallback: try to wake up the app using the custom protocol
        const launchIframe = document.createElement('iframe');
        launchIframe.style.display = 'none';
        const pageUrl = window.location.href;
        launchIframe.src = `framevault://download?url=${encodeURIComponent(pageUrl)}`;
        document.body.appendChild(launchIframe);
        
        setTimeout(() => {
          launchIframe.remove();
          showToast('Click the download button again once the app is open!', true);
        }, 3000);
      }
    });
  });

  // Append directly to body to escape all z-index trapping contexts
  document.body.appendChild(btn);

  let isHoveringButton = false;
  btn.addEventListener('mouseenter', () => isHoveringButton = true);
  btn.addEventListener('mouseleave', () => isHoveringButton = false);

  const update = () => {
    if (!videoElement.isConnected) {
      btn.remove();
      return;
    }

    const rect = videoElement.getBoundingClientRect();
    
    // Check if video is reasonably sized and visible
    if (rect.width < 200 || rect.height < 120 || rect.bottom < 0 || rect.top > window.innerHeight) {
      btn.style.opacity = '0';
      btn.style.pointerEvents = 'none';
      return;
    }

    // Use raw coordinates to detect hover, ignoring invisible blocking layers (like YT controls)
    const isOverVideo = mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom;
    
    if (isOverVideo || isHoveringButton) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }

    // Force fixed position tracking
    btn.style.top = (rect.top + 16) + 'px';
    btn.style.left = (rect.right - btn.offsetWidth - 16) + 'px';
  };

  // Sync position rapidly to handle scrolling and layout shifts (like theater mode)
  setInterval(update, 50);
}

function showToast(message, isError = false) {
  // Remove any existing toast
  const existing = document.querySelector('.framevault-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'framevault-toast';
  if (isError) toast.classList.add('framevault-toast-error');
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  // Remove after 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function scanForVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    // Wait for the video to have dimensions
    if (video.readyState >= 1 || video.videoWidth > 0) {
      createDownloadButton(video);
    } else {
      video.addEventListener('loadedmetadata', () => {
        createDownloadButton(video);
      }, { once: true });

      // Fallback: try after a short delay even if metadata never fires
      setTimeout(() => createDownloadButton(video), 2000);
    }
  });
}

// ---- MutationObserver for SPA / Dynamic Content ----

const observer = new MutationObserver((mutations) => {
  let hasNewNodes = false;
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      hasNewNodes = true;
      break;
    }
  }
  if (hasNewNodes) {
    // Debounce scanning
    clearTimeout(observer._scanTimeout);
    observer._scanTimeout = setTimeout(scanForVideos, 500);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial scan
scanForVideos();

// Re-scan on SPA navigation (popstate)
window.addEventListener('popstate', () => {
  setTimeout(scanForVideos, 1000);
});
