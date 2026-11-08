# Perry Mill Scraper (scraper)

This folder contains a small Puppeteer-based scraper used by the Perry Mill Enhanced Flask backend to fetch full article text and metadata.

Files
- `fetch-article.js` - Node.js script that accepts a URL as a CLI argument and writes JSON to stdout: `{ title, content, author, publishedDate, image, url }`.
- `package.json` - Node manifest with Puppeteer dependency.
- `test-run.sh` - Simple shell helper to run `fetch-article.js` against a sample URL.

Quick start

1. Install Node dependencies (this downloads Chromium via Puppeteer and may be large):

```bash
cd scraper
npm install
```

2. Run the scraper directly against a URL:

```bash
node fetch-article.js "https://example.com/some-article"
# or use the helper
./test-run.sh
```

Notes
- Puppeteer downloads a Chromium binary during `npm install` (hundreds of MB). Ensure you have network access and enough disk space.
- If you prefer not to use the bundled Chromium, replace `puppeteer` with `puppeteer-core` and configure the `PUPPETEER_EXECUTABLE_PATH` environment variable to point at your system Chrome/Chromium. I can help update the script to support that.
- The script prints structured error JSON to stderr on failure, and returns non-zero exit codes.

If you run into permission or network issues during `npm install`, paste the npm log and I'll help debug.
