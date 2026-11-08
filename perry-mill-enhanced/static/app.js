// app.js - small helper to fetch full article HTML/text from the backend
// This file provides an `openReader(article)` function. It expects `article` to be
// an object with at least `{ url, title?, summary? }`.
//
// Behavior:
// 1. Open the reader modal immediately and show a loading state
// 2. POST { url } to /api/article/fetch
// 3. If success and article.content present -> render full article
// 4. If failure or no content -> render fallback RSS summary with a note

async function openReader(article = {}) {
  if (!article || !article.url) {
    console.warn('openReader called without article.url');
    return;
  }

  // Helpers to find/create modal elements. Prefer existing modal if present.
  const modalSelectors = ['#reader-modal', '#readerModal', '.reader-modal', '#reader'];
  let modal = null;
  for (const s of modalSelectors) {
    modal = document.querySelector(s);
    if (modal) break;
  }

  // If no existing modal, create a lightweight fallback modal (non-invasive)
  let createdFallback = false;
  if (!modal) {
    createdFallback = true;
    modal = document.createElement('div');
    modal.id = 'reader-modal';
    modal.style.position = 'fixed';
    modal.style.top = '4%';
    modal.style.left = '50%';
    modal.style.transform = 'translateX(-50%)';
    modal.style.width = '80%';
    modal.style.maxHeight = '90%';
    modal.style.overflow = 'auto';
    modal.style.background = '#fff';
    modal.style.border = '1px solid #ccc';
    modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    modal.style.zIndex = 10000;
    modal.style.padding = '18px';
    document.body.appendChild(modal);
  }

  // Render loading state
  function setLoading() {
    modal.innerHTML = `
      <div class="reader-loading" style="font-family:system-ui,Arial;margin:12px 0;">
        <strong>Loading full article…</strong>
        <div style="margin-top:8px;color:#666">We are fetching the full article to show it here.</div>
      </div>
    `;
  }

  function renderArticle(a) {
    const title = a.title || article.title || '';
    const author = a.author || '';
    const date = a.publishedDate || '';
    const image = a.image ? `<img src="${a.image}" alt="" style="max-width:100%;margin:12px 0;"/>` : '';
    const content = a.content || '';

    modal.innerHTML = `
      <div class="reader-article" style="font-family:system-ui,Arial;">
        <h1 style="margin-bottom:6px">${escapeHtml(title)}</h1>
        <div style="color:#666;margin-bottom:10px">${escapeHtml(author)} ${date ? '· ' + escapeHtml(date) : ''}</div>
        ${image}
        <div class="reader-content" style="line-height:1.6;color:#111;">${contentToHtml(content)}</div>
        <div style="margin-top:18px;color:#666;font-size:90%">
          <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener">Open original article</a>
        </div>
      </div>
    `;
  }

  function renderFallback() {
    const summary = article.summary || article.excerpt || 'Full text unavailable. Showing feed summary.';
    modal.innerHTML = `
      <div class="reader-fallback" style="font-family:system-ui,Arial;">
        <h2 style="margin-bottom:6px">${escapeHtml(article.title || '')}</h2>
        <div style="color:#666;margin-bottom:10px">Full article unavailable — showing feed summary.</div>
        <div class="reader-summary" style="line-height:1.6;color:#111;">${contentToHtml(summary)}</div>
        <div style="margin-top:18px;color:#666;font-size:90%">
          <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener">Open original article</a>
        </div>
      </div>
    `;
  }

  // Basic escaping for text to avoid accidental HTML injection
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Convert plain text to paragraphs (simple): preserve existing <p> if already HTML
  function contentToHtml(content) {
    if (!content) return '';
    // If content contains HTML tags, assume it's already HTML
    if (/<[^>]+>/.test(content)) return content;
    // Otherwise split into paragraphs at double newlines or single newlines
    const paras = content.split(/\n\n+/).map(p => `<p>${escapeHtml(p).replace(/\n/g,'<br/>')}</p>`).join('');
    return paras;
  }

  // Show modal and loading immediately
  setLoading();
  modal.style.display = 'block';

  // Post to backend
  let timedOut = false;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 28000); // slightly less than server's 30s timeout

  try {
    const resp = await fetch('/api/article/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: article.url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      console.warn('Article fetch failed', resp.status);
      renderFallback();
      return;
    }

    const data = await resp.json();
    if (data && data.ok && data.article && data.article.content) {
      renderArticle(data.article);
    } else {
      renderFallback();
    }
  } catch (err) {
    if (timedOut) console.warn('Article fetch aborted due to timeout');
    else console.warn('Article fetch error', err);
    renderFallback();
  }

  // If we created a lightweight modal fallback, add a simple close button
  if (createdFallback) {
    let closeBtn = modal.querySelector('.reader-close');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.className = 'reader-close';
      closeBtn.textContent = 'Close';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '8px';
      closeBtn.style.right = '10px';
      closeBtn.style.padding = '6px 10px';
      closeBtn.style.cursor = 'pointer';
      modal.appendChild(closeBtn);
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  }
}

// Export to global scope for inline usage from HTML
window.openReader = openReader;

// Attach click handlers to elements that represent articles so they open the reader.
// Elements supported:
// - any element with `data-article-url="..."`
// - any element with class `open-reader` and attributes `data-article-url`, optional `data-article-title`, `data-article-summary`
// This initializer is safe to call multiple times.
function initReaderBindings(root = document) {
  const sel = '[data-article-url], .open-reader';
  const nodes = Array.from(root.querySelectorAll(sel));
  for (const n of nodes) {
    // avoid double-binding
    if (n.__readerBound) continue;
    n.__readerBound = true;
    n.addEventListener('click', (ev) => {
      ev.preventDefault();
      const url = n.getAttribute('data-article-url');
      if (!url) return;
      const title = n.getAttribute('data-article-title') || n.textContent || '';
      const summary = n.getAttribute('data-article-summary') || '';
      openReader({ url, title, summary });
    });
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initReaderBindings(document));
} else {
  initReaderBindings(document);
}

// Export initializer for dynamic pages that load content later
window.initReaderBindings = initReaderBindings;
