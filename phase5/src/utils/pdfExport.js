/**
 * PDF Export — ATS-safe single-column format.
 * Uses html2pdf.js loaded dynamically from CDN.
 * Rules enforced:
 *   - Single column, no tables, no icons
 *   - Standard fonts (Arial / Times New Roman)
 *   - Selectable text (not flattened)
 *   - 0.7" margins all sides
 *   - 10–11pt body, 13pt headings
 */

const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

/** Dynamically load html2pdf.js */
async function ensureHtml2Pdf() {
  if (window.html2pdf) return;
  await new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${HTML2PDF_CDN}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = HTML2PDF_CDN;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load html2pdf.js'));
    document.head.appendChild(s);
  });
  // Wait for it to be ready
  let attempts = 0;
  while (!window.html2pdf && attempts < 20) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  if (!window.html2pdf) throw new Error('html2pdf.js did not load in time');
}

/** Convert markdown resume text → ATS-safe HTML */
export function resumeMarkdownToHTML(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let inBulletList = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Close open bullet list
    if (inBulletList && !line.startsWith('- ') && !line.startsWith('• ') && !line.startsWith('* ')) {
      html += '</ul>';
      inBulletList = false;
    }

    if (!line) {
      html += '<br>';
      continue;
    }

    // ## SECTION HEADING
    if (line.startsWith('## ')) {
      html += `<div class="section-heading">${escHtml(line.slice(3))}</div>`;
      continue;
    }

    // # NAME (first line)
    if (line.startsWith('# ')) {
      html += `<div class="name">${escHtml(line.slice(2))}</div>`;
      continue;
    }

    // Contact line (email | phone | linkedin | github)
    if (line.includes('@') || line.includes('linkedin') || line.includes('github') || /\+?\d[\d\s\-()]{7,}/.test(line)) {
      html += `<div class="contact">${escHtml(line)}</div>`;
      continue;
    }

    // **Bold** text (project names, company names)
    if (line.startsWith('**') && line.endsWith('**')) {
      html += `<div class="bold-line">${formatInline(line)}</div>`;
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      if (!inBulletList) { html += '<ul>'; inBulletList = true; }
      html += `<li>${formatInline(line.slice(2))}</li>`;
      continue;
    }

    // Horizontal rule ---
    if (/^-{3,}$/.test(line)) {
      html += '<hr>';
      continue;
    }

    // Regular paragraph
    html += `<p>${formatInline(line)}</p>`;
  }

  if (inBulletList) html += '</ul>';
  return html;
}

/** Apply inline formatting: **bold**, *italic* */
function formatInline(text) {
  return escHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Full ATS-safe HTML document wrapper */
export function buildResumeHTML(markdown) {
  const body = resumeMarkdownToHTML(markdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #000;
    background: #fff;
    padding: 0;
    margin: 0;
    -webkit-print-color-adjust: exact;
  }
  .page {
    width: 100%;
    max-width: 750px;
    margin: 0 auto;
    padding: 0;
  }
  .name {
    font-size: 16pt;
    font-weight: bold;
    margin-bottom: 3px;
    letter-spacing: 0.02em;
  }
  .contact {
    font-size: 9.5pt;
    color: #333;
    margin-bottom: 2px;
  }
  .section-heading {
    font-size: 11pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 10px;
    margin-bottom: 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #000;
  }
  p {
    margin-bottom: 3px;
    font-size: 10pt;
  }
  ul {
    margin: 2px 0 4px 16px;
    padding: 0;
    list-style-type: disc;
  }
  li {
    margin-bottom: 2px;
    font-size: 10pt;
    line-height: 1.4;
  }
  strong { font-weight: bold; }
  em { font-style: italic; }
  .bold-line { font-weight: bold; margin: 4px 0 1px; font-size: 10.5pt; }
  hr { border: none; border-top: 0.5px solid #ccc; margin: 6px 0; }
  br { display: block; margin-top: 2px; content: ""; }
</style>
</head>
<body>
<div class="page">
${body}
</div>
</body>
</html>`;
}

/**
 * Main export function. Creates and downloads an ATS-safe PDF.
 * @param {string} markdown - Resume in markdown format
 * @param {string} filename  - Output filename (without .pdf)
 * @param {function} onProgress - (message) => void
 */
export async function exportResumePDF(markdown, filename = 'resume', onProgress) {
  onProgress?.('Loading PDF engine...');
  await ensureHtml2Pdf();

  onProgress?.('Building resume layout...');
  const htmlContent = buildResumeHTML(markdown);

  // Create a hidden container
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:816px;background:#fff;';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  onProgress?.('Generating PDF...');

  const safeFilename = filename
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60) + '.pdf';

  try {
    await window.html2pdf()
      .set({
        margin:      [0.7, 0.7, 0.7, 0.7],
        filename:    safeFilename,
        image:       { type: 'jpeg', quality: 0.99 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF:       { unit: 'in', format: 'a4', orientation: 'portrait' },
        pagebreak:   { mode: ['avoid-all', 'css'] },
      })
      .from(container)
      .save();

    onProgress?.('Done!');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Preview-only: renders resume HTML into a given DOM element (for the preview pane).
 */
export function renderResumePreview(markdown, targetElement) {
  if (!targetElement) return;
  const html = buildResumeHTML(markdown);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#fff;';
  iframe.sandbox = 'allow-same-origin';
  targetElement.innerHTML = '';
  targetElement.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // Return height for auto-sizing
  return () => iframe.contentDocument?.body?.scrollHeight || 600;
}
