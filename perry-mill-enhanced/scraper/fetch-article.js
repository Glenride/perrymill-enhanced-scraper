#!/usr/bin/env node
// fetch-article.js
// Usage: node fetch-article.js "https://example.com/article"
// Outputs JSON to stdout: { title, content, author, publishedDate, image }

const puppeteer = require('puppeteer');

const URL = process.argv[2];
if (!URL) {
  console.error(JSON.stringify({ error: 'Missing URL argument. Usage: node fetch-article.js <url>' }));
  process.exit(2);
}

const NAV_TIMEOUT = 30000; // ms
const SCRIPT_TIMEOUT = 20000; // ms for extraction

function safeJSON(obj) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify({ error: 'Serialization error' });
  }
}

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
    );
    // Navigation with timeout
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    // Give page a moment for lazy-loaded content
    await page.waitForTimeout(800);

    // Evaluate in page to extract fields using several fallback selectors
    const result = await Promise.race([
      page.evaluate(() => {
        const textOrNull = (el) => (el ? el.innerText.trim() : null);

        // Title candidates
        const titleSelectors = ['h1', '[class*="headline"]', 'article h1'];
        let title = null;
        for (const s of titleSelectors) {
          const el = document.querySelector(s);
          if (el && el.innerText) {
            title = el.innerText.trim();
            break;
          }
        }
        if (!title) {
          const og = document.querySelector('meta[property="og:title"]');
          if (og && og.content) title = og.content.trim();
        }

        // Content candidates - collect paragraphs
        const contentSelectors = ['article p', '[class*="article-body"] p', 'main p', '[class*="content"] p'];
        let content = null;
        for (const s of contentSelectors) {
          const nodes = Array.from(document.querySelectorAll(s)).filter(n => n.innerText && n.innerText.trim().length > 20);
          if (nodes.length) {
            content = nodes.map(n => n.innerText.trim()).join('\n\n');
            break;
          }
        }
        if (!content) {
          const article = document.querySelector('article');
          if (article) {
            const nodes = Array.from(article.querySelectorAll('p')).filter(n => n.innerText && n.innerText.trim().length > 20);
            if (nodes.length) content = nodes.map(n => n.innerText.trim()).join('\n\n');
          }
        }

        // Image candidates
        let image = null;
        const ogImage = document.querySelector('meta[property="og:image"]');
        if (ogImage && ogImage.content) image = ogImage.content;
        if (!image) {
          const img = document.querySelector('article img, [class*="featured"] img');
          if (img && img.src) image = img.src;
        }

        // Author
        let author = null;
        const authorEl = document.querySelector('[class*="author"], [rel*="author"], .byline');
        if (authorEl && authorEl.innerText) author = authorEl.innerText.trim();
        if (!author) {
          const ma = document.querySelector('meta[name="author"]');
          if (ma && ma.content) author = ma.content.trim();
        }

        // Published date
        let publishedDate = null;
        const timeEl = document.querySelector('time');
        if (timeEl) publishedDate = timeEl.getAttribute('datetime') || timeEl.innerText;
        if (!publishedDate) {
          const md = document.querySelector('meta[property="article:published_time"], meta[name="date"]');
          if (md && md.content) publishedDate = md.content;
        }

        // Normalize empty strings to null
        const normalize = (v) => (v && String(v).trim().length ? String(v).trim() : null);

        return {
          title: normalize(title),
          content: normalize(content),
          author: normalize(author),
          publishedDate: normalize(publishedDate),
          image: normalize(image),
        };
      }),
      // Safety timeout for page.evaluate
      new Promise((_, reject) => setTimeout(() => reject(new Error('Extraction timed out')), SCRIPT_TIMEOUT)),
    ]);

    // If content is very short or missing, include a notice but still return what we have
    const payload = Object.assign({ url: URL }, result);
    console.log(safeJSON(payload));
    await browser.close();
    process.exit(0);
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
    // Output structured error JSON to stderr
    console.error(safeJSON({ error: String(err && err.message ? err.message : err) }));
    process.exit(1);
  }
})();
