/**
 * Parses raw resume text (plain text or markdown) into structured sections.
 * Handles common resume section headings regardless of casing or formatting.
 */

// Known section heading patterns → canonical key
const SECTION_MAP = [
  { key: 'header',          patterns: [] }, // always first block
  { key: 'summary',         patterns: [/^(summary|professional summary|objective|profile|about me)/i] },
  { key: 'skills',          patterns: [/^(skills|technical skills|core competencies|technologies|tech stack)/i] },
  { key: 'projects',        patterns: [/^(projects|personal projects|academic projects|key projects|side projects)/i] },
  { key: 'experience',      patterns: [/^(experience|work experience|professional experience|employment|internship)/i] },
  { key: 'education',       patterns: [/^(education|academic background|qualifications)/i] },
  { key: 'certifications',  patterns: [/^(certifications|certificates|achievements|awards)/i] },
];

/**
 * Detects if a line is a section heading.
 * Returns canonical key or null.
 */
function detectSectionHeading(line) {
  const cleaned = line.replace(/^#+\s*/, '').replace(/\*+/g, '').replace(/:$/, '').trim();
  for (const section of SECTION_MAP) {
    for (const pattern of section.patterns) {
      if (pattern.test(cleaned)) return section.key;
    }
  }
  // Also match ALL-CAPS single-word headings like "SKILLS", "PROJECTS"
  if (/^[A-Z\s&]{4,}$/.test(cleaned) && cleaned.length < 30) {
    const lower = cleaned.toLowerCase().trim();
    for (const section of SECTION_MAP) {
      for (const pattern of section.patterns) {
        if (pattern.test(lower)) return section.key;
      }
    }
  }
  return null;
}

/**
 * Extracts name and contact info from the header block lines.
 */
function parseHeader(lines) {
  const emailRx = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
  const phoneRx = /(\+?\d[\d\s\-().]{7,}\d)/;
  const linkedinRx = /linkedin\.com\/in\/[\w-]+/i;
  const githubRx = /github\.com\/[\w-]+/i;

  let name = '';
  let email = '';
  let phone = '';
  let linkedin = '';
  let github = '';
  const otherLines = [];

  for (const line of lines) {
    const l = line.trim();
    if (!l) continue;
    if (!name && l.length > 2 && l.length < 60 && !/[@|·|•]/.test(l) && !/http/i.test(l)) {
      name = l.replace(/\*+/g, '').trim();
      continue;
    }
    if (!email && emailRx.test(l)) email = l.match(emailRx)[0];
    if (!phone && phoneRx.test(l)) phone = l.match(phoneRx)[0];
    if (!linkedin && linkedinRx.test(l)) linkedin = l.match(linkedinRx)[0];
    if (!github && githubRx.test(l)) github = l.match(githubRx)[0];
    otherLines.push(l);
  }

  return { name, email, phone, linkedin, github, raw: lines.join('\n') };
}

/**
 * Main parser: returns structured sections object.
 * Each value is the raw text block for that section.
 */
export function parseResume(rawText) {
  if (!rawText || !rawText.trim()) {
    return { raw: '', sections: {}, header: {}, wordCount: 0, detectedSections: [] };
  }

  const lines = rawText.split('\n');
  const sectionBlocks = {}; // key → lines[]
  let currentSection = 'header';
  let headerLines = [];

  for (const line of lines) {
    const detected = detectSectionHeading(line);
    if (detected) {
      currentSection = detected;
      if (!sectionBlocks[currentSection]) sectionBlocks[currentSection] = [];
    } else {
      if (currentSection === 'header') {
        headerLines.push(line);
      } else {
        if (!sectionBlocks[currentSection]) sectionBlocks[currentSection] = [];
        sectionBlocks[currentSection].push(line);
      }
    }
  }

  // Clean each section
  const sections = {};
  for (const [key, lines] of Object.entries(sectionBlocks)) {
    sections[key] = lines.join('\n').replace(/^\n+|\n+$/g, '').trim();
  }

  const header = parseHeader(headerLines);
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const detectedSections = Object.keys(sections).filter(k => sections[k].length > 0);

  return {
    raw: rawText,
    header,
    sections,
    wordCount,
    detectedSections,
    estimatedPages: Math.ceil(wordCount / 450),
  };
}

/**
 * Extracts plain text from an uploaded file.
 * Handles .txt and .md directly. For .pdf, returns raw text (basic extraction).
 */
export async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  if (name.endsWith('.pdf')) {
    // We use PDF.js for text extraction
    return extractPdfText(file);
  }

  throw new Error(`Unsupported file type: ${file.name}. Use .txt, .md, or .pdf`);
}

async function extractPdfText(file) {
  // Dynamically load PDF.js from CDN
  if (!window.pdfjsLib) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText.trim();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
