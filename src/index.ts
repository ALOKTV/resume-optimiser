// @ts-nocheck
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const mammoth = require("mammoth");
const JSZip = require("jszip");

const app = express();
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

const PORT = Number(process.env.PORT) || 5000;
const ROOT = process.cwd();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(ROOT, "public")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

const STOP_WORDS = new Set([
  "about", "above", "after", "again", "against", "also", "among", "and", "any",
  "are", "because", "been", "before", "being", "below", "between", "both",
  "but", "can", "did", "does", "doing", "down", "during", "each", "few", "for",
  "from", "further", "had", "has", "have", "having", "her", "here", "hers",
  "him", "himself", "his", "how", "into", "its", "itself", "just", "more",
  "most", "our", "ours", "out", "over", "own", "same", "she", "should", "such",
  "than", "that", "the", "their", "theirs", "them", "then", "there", "these",
  "they", "this", "those", "through", "too", "under", "until", "very", "was",
  "were", "what", "when", "where", "which", "while", "who", "why", "will",
  "with", "work", "your", "you", "role", "team", "teams", "using", "able",
  "ability", "candidate", "candidates", "company", "experience", "years",
  "job", "description", "position", "responsibility", "responsibilities",
  "requirement", "requirements", "required", "preferred", "qualification",
  "qualifications", "including", "include", "must", "strong", "excellent",
  "looking", "applicant", "benefits", "equal", "opportunity", "remote",
  "onsite", "hybrid", "full-time", "part-time", "advanced", "activities",
  "affirmative", "applicants", "application", "applications", "attitude",
  "backgrounds", "business", "characteristic", "clean", "competencies",
  "constructive", "culture", "day-to-day", "decisions", "degree", "deliver",
  "bachelor", "computer", "developer", "developers", "development", "disabilities", "disabled", "diverse", "diversity",
  "effective", "employer", "employment", "environment", "equity", "ethnicities",
  "feedback", "flexible", "focus", "fundamental", "gender", "global",
  "high-quality", "identity", "inclusion", "inclusive", "individual",
  "internal", "learning", "management", "marital", "meet", "mentoring",
  "minimum", "mobility", "modern", "needs", "notice", "ownership", "positive",
  "optimized", "pressure", "proud", "quality", "race", "regard", "related", "religion",
  "respectful", "scalable", "science", "sexual", "skill", "skills", "solutions", "statement", "status",
  "successful", "synechron", "seeking", "skilled", "updated", "veteran", "workforce", "workplace"
]);

const PROMPT_COMMAND_WORDS = new Set([
  "add", "based", "build", "change", "create", "draft", "edit", "generate",
  "focused", "highlight", "keep", "make", "new", "one", "optimize", "page",
  "pdf", "prioritize", "prompt", "resume", "same", "separate", "target",
  "update", "write"
]);

const ACTION_VERBS = [
  "aggregated", "built", "created", "improved", "optimized", "automated", "delivered",
  "implemented", "designed", "reduced", "increased", "led", "managed",
  "launched", "maintained", "migrated", "analyzed", "developed", "integrated", "supported"
];

const SKILL_PHRASES = [
  "react", "node.js", "node", "typescript", "javascript", "python", "java",
  "spring boot", "express", "postgresql", "mysql", "mongodb", "aws", "azure",
  "gcp", "docker", "kubernetes", "terraform", "graphql", "rest api", "rest",
  "ci/cd", "jenkins", "github actions", "linux", "sql", "nosql", "redis",
  "machine learning", "data analysis", "power bi", "tableau", "excel",
  "stakeholder management", "project management", "agile", "scrum",
  "customer success", "salesforce", "figma", "product management",
  "microservices", "api", "apis", "html", "css", "tailwind", "next.js",
  "redux", "git", "jira", "oauth", "jwt", "unit testing", "integration testing",
  "automation", "analytics", "etl", "data visualization", "frontend",
  "front-end", "jest", "mocha", "testing", "code reviews", "debugging",
  "performance optimization", "web technologies", "version control", "github"
];

const SKILL_LABELS = new Map([
  ["api", "API"],
  ["apis", "APIs"],
  ["aws", "AWS"],
  ["azure", "Azure"],
  ["ci/cd", "CI/CD"],
  ["css", "CSS"],
  ["docker", "Docker"],
  ["etl", "ETL"],
  ["gcp", "GCP"],
  ["github actions", "GitHub Actions"],
  ["github", "GitHub"],
  ["graphql", "GraphQL"],
  ["frontend", "Front-end"],
  ["front-end", "Front-end"],
  ["git", "Git"],
  ["html", "HTML"],
  ["javascript", "JavaScript"],
  ["jest", "Jest"],
  ["jwt", "JWT"],
  ["mocha", "Mocha"],
  ["mongodb", "MongoDB"],
  ["mysql", "MySQL"],
  ["next.js", "Next.js"],
  ["node.js", "Node.js"],
  ["postgresql", "PostgreSQL"],
  ["python", "Python"],
  ["react", "React"],
  ["redis", "Redis"],
  ["rest", "REST"],
  ["rest api", "REST API"],
  ["redux", "Redux"],
  ["scrum", "Scrum"],
  ["sql", "SQL"],
  ["testing", "Testing"],
  ["typescript", "TypeScript"],
  ["version control", "Version Control"],
  ["web technologies", "Web Technologies"]
]);

function normalizeText(text) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function canonicalKeywordText(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/\breact[\s.]?js\b/g, "react")
    .replace(/\bnode[\s.]?js\b/g, "node.js")
    .replace(/\bhtml5\b/g, "html")
    .replace(/\bcss3\b/g, "css")
    .replace(/\brestful\s+apis?\b/g, "rest api")
    .replace(/\brest\s+apis?\b/g, "rest api")
    .replace(/\bfront[\s-]?end\b/g, "frontend")
    .replace(/\bgithub\b/g, "git github");
}

function cleanExtractedText(text) {
  return normalizeText(text)
    .split("\n")
    .filter((line) => !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line.trim()))
    .join("\n")
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesKeyword(text, keyword) {
  const normalizedText = canonicalKeywordText(text);
  const normalizedKeyword = canonicalKeywordText(keyword);
  const pattern = new RegExp(`(^|[^a-z0-9+#./-])${escapeRegExp(normalizedKeyword)}(?=$|[^a-z0-9+#./-])`, "i");
  return pattern.test(normalizedText);
}

function tokenize(text) {
  return canonicalKeywordText(text)
    .split(/[^a-z0-9+#./-]+/)
    .map((word) => word.trim().replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/g, ""))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function unique(values) {
  return [...new Set(values)];
}

function topKeywords(text, max = 24) {
  const counts = new Map();

  for (const word of tokenize(text)) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }

  for (const phrase of SKILL_PHRASES) {
    if (includesKeyword(text, phrase)) {
      counts.set(phrase, (counts.get(phrase) || 0) + 6);
    }
  }

  if (counts.has("rest api")) {
    counts.delete("api");
    counts.delete("apis");
    counts.delete("rest");
  }

  if (counts.has("frontend")) {
    counts.delete("front-end");
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([word]) => word)
    .filter((word) => ![...counts.keys()].some((other) => other !== word && other.includes(word) && other.length > word.length + 2));

  return sorted.slice(0, max);
}

function cleanKeywordList(values) {
  let keywords = unique(values.filter(Boolean));

  if (keywords.includes("rest api")) {
    keywords = keywords.filter((keyword) => !["api", "apis", "rest"].includes(keyword));
  }

  if (keywords.includes("frontend")) {
    keywords = keywords.filter((keyword) => keyword !== "front-end");
  }

  return keywords;
}

function instructionKeywordText(text) {
  const words = tokenize(text)
    .filter((word) => !PROMPT_COMMAND_WORDS.has(word))
    .join(" ");
  const phrases = SKILL_PHRASES.filter((phrase) => includesKeyword(text, phrase));

  return unique([...phrases, words].filter(Boolean)).join(" ");
}

function sentenceCase(value) {
  if (!value) return "";
  const label = SKILL_LABELS.get(value.toLowerCase());
  if (label) return label;

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function includesTerm(text, term) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function getExistingStrengths(resumeText, jdKeywords) {
  return jdKeywords.filter((keyword) => includesKeyword(resumeText, keyword));
}

function inferTargetRole(jdText) {
  if (includesKeyword(jdText, "react")) return "React Developer";
  if (includesKeyword(jdText, "frontend")) return "Front-end Developer";
  if (includesKeyword(jdText, "node.js")) return "Backend Developer";

  return "Role-aligned professional";
}

function buildSuggestions(resumeText, jdText, matched, missing) {
  const safeMatched = matched.slice(0, 8);
  const safeMissing = missing.slice(0, 10);
  const hasMetrics = /\d+%|\$|\b\d+x\b|\b\d+\+?\b/.test(resumeText);
  const hasActionVerbs = ACTION_VERBS.some((verb) => includesTerm(resumeText, verb));
  const roleTitle = inferTargetRole(jdText);
  const summarySkills = unique([...safeMatched, ...safeMissing])
    .filter((keyword) => !["api", "apis", "skills", "application"].includes(keyword))
    .slice(0, 6)
    .map(sentenceCase);

  const summary = safeMatched.length
    ? `Professional summary option: ${roleTitle} with hands-on experience building scalable web applications using ${summarySkills.join(", ") || "modern web technologies"}. Skilled in reusable component development, API integration, code quality, collaboration, and performance-focused delivery.`
    : "Professional summary option: Results-focused professional with experience aligned to the target role. Add 2-3 specific strengths from your real background and mirror the job description language where it is accurate.";

  const skills = safeMissing.length
    ? `Skills line to consider if true: ${safeMissing.map(sentenceCase).join(" | ")}`
    : "Skills line: Your resume already covers the strongest repeated job-description keywords. Keep the skills section concise and grouped by category.";

  const bullets = [
    `Reframe one recent bullet around impact: ${safeMatched[0] ? `Delivered ${safeMatched[0]} initiatives` : "Delivered role-aligned initiatives"} by collaborating with cross-functional partners and tracking measurable outcomes.`,
    `Add keyword context naturally: Applied ${safeMatched.slice(1, 4).join(", ") || "role-relevant tools and processes"} to solve business problems without keyword stuffing.`,
    hasMetrics
      ? "Keep your quantified results visible near the start of bullets; ATS and recruiters both scan for measurable impact."
      : "Add real numbers where possible, such as percentage improvement, time saved, revenue influenced, users supported, ticket volume, or project size.",
    hasActionVerbs
      ? "Your resume already uses action-oriented language; make sure each major bullet starts with a strong verb and ends with a result."
      : "Start bullets with stronger verbs like Built, Improved, Automated, Led, Reduced, Increased, Delivered, or Optimized."
  ];

  return {
    summary,
    skills,
    bullets,
    warning: "To preserve layout, this app does not overwrite your original DOCX/PDF. Paste the relevant lines into the same sections of your resume."
  };
}

function isLikelySectionHeading(line) {
  const value = line.trim();
  const lower = value.toLowerCase();

  if (!value) return false;

  return [
    "summary", "professional summary", "profile", "objective", "skills",
    "technical skills", "core skills", "experience", "work experience",
    "professional experience", "employment", "projects", "education",
    "certifications", "achievements"
  ].includes(lower) || (value.length < 36 && value === value.toUpperCase());
}

function stripExistingSections(lines, sectionNames) {
  const normalizedNames = new Set(sectionNames);
  const kept = [];
  let skipping = false;

  for (const line of lines) {
    const lower = line.trim().toLowerCase();
    const startsSkippedSection = normalizedNames.has(lower);

    if (startsSkippedSection) {
      skipping = true;
      continue;
    }

    if (skipping && isLikelySectionHeading(line)) {
      skipping = false;
    }

    if (!skipping) {
      kept.push(line);
    }
  }

  return kept;
}

function buildCompleteResumeDraft(resumeText, suggestions, matched, missing, targetKeywordCount = matched.length + missing.length) {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstSectionIndex = lines.findIndex(isLikelySectionHeading);
  const contactEnd = firstSectionIndex > 0 && firstSectionIndex < 8 ? firstSectionIndex : Math.min(3, lines.length);
  const contactLines = lines.slice(0, contactEnd);
  const bodyLines = lines.slice(contactEnd);
  const additionsNeededForTarget = Math.max(0, targetKeywordCount - matched.length);
  const targetSkills = unique([...matched, ...missing.slice(0, additionsNeededForTarget)]).slice(0, 24);
  const baseResume = targetSkills.length
    ? [
        ...contactLines,
        "",
        "PROFESSIONAL SUMMARY",
        suggestions.summary.replace(/^Professional summary option:\s*/i, ""),
        "",
        "CORE SKILLS",
        targetSkills.map(sentenceCase).join(" | "),
        "",
        ...stripExistingSections(bodyLines, [
          "summary", "professional summary", "profile", "objective",
          "skills", "technical skills", "core skills"
        ])
      ]
    : [
        ...contactLines,
        "",
        ...bodyLines
      ];

  return [
    ...baseResume
  ].join("\n");
}

function normalizePdfText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/→/g, "->")
    .replace(/[•·]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function escapePdfText(text) {
  return normalizePdfText(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function isPdfSectionHeading(line) {
  const value = normalizePdfText(line).trim().toUpperCase();

  return [
    "SUMMARY",
    "PROFESSIONAL SUMMARY",
    "TECHNICAL SKILLS",
    "CORE SKILLS",
    "SKILLS",
    "EXPERIENCE",
    "WORK EXPERIENCE",
    "PROFESSIONAL EXPERIENCE",
    "PERSONAL PROJECTS & OPEN SOURCE",
    "PROJECTS",
    "EDUCATION",
    "CERTIFICATIONS",
    "ACHIEVEMENTS"
  ].includes(value);
}

function cleanResumeTextForPdf(resumeText) {
  const lines = normalizePdfText(resumeText).split("\n");
  const kept = [];
  let skippingNotes = false;

  for (const line of lines) {
    const heading = line.trim().toUpperCase();

    if (heading === "POSSIBLE ADDITIONS TO CONFIRM" || heading === "TARGET DETAILS USED") {
      skippingNotes = true;
      continue;
    }

    if (skippingNotes) continue;
    kept.push(line.replace(/\s+$/g, ""));
  }

  return kept.join("\n").trim();
}

function isPdfBulletLine(line) {
  return /^-\s+/.test(line.trim());
}

function pdfBulletText(line) {
  return line.trim().replace(/^-\s+/, "");
}

function isPdfEntryTitle(line, section) {
  const value = line.trim();
  const titleSection = ["EXPERIENCE", "WORK EXPERIENCE", "PROFESSIONAL EXPERIENCE", "PERSONAL PROJECTS & OPEN SOURCE", "PROJECTS"].includes(section);

  if (section === "EDUCATION") {
    return !value.includes(":") && !value.endsWith(".") && value.length < 120;
  }

  return titleSection
    && !value.includes(":")
    && !value.endsWith(".")
    && value.length < 120
    && (value.includes("|") || /\s-\s/.test(value));
}

function preparePdfBodyItems(lines) {
  const items = [];
  let section = "";
  let pending = null;

  function flushPending() {
    if (pending) {
      items.push(pending);
      pending = null;
    }
  }

  function addBlank() {
    if (items[items.length - 1]?.type !== "blank") {
      items.push({ type: "blank", text: "" });
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushPending();
      addBlank();
      continue;
    }

    if (isPdfSectionHeading(line)) {
      flushPending();
      section = line.toUpperCase();
      items.push({ type: "section", text: section });
      continue;
    }

    if (isPdfBulletLine(line)) {
      flushPending();
      pending = { type: "bullet", text: pdfBulletText(line), section };
      continue;
    }

    if (pending?.type === "bullet") {
      if (isPdfEntryTitle(line, section)) {
        flushPending();
        pending = { type: "title", text: line, section };
      } else {
        pending.text = `${pending.text} ${line}`;
      }
      continue;
    }

    if (isPdfEntryTitle(line, section)) {
      flushPending();
      pending = { type: "title", text: line, section };
      continue;
    }

    const isSkillLine = section.includes("SKILLS") && /^[A-Za-z &]+:/.test(line);
    if (pending?.type === "paragraph" && !isSkillLine && !section.includes("SKILLS")) {
      pending.text = `${pending.text} ${line}`;
    } else {
      flushPending();
      pending = { type: "paragraph", text: line, section };
    }
  }

  flushPending();
  return items;
}

function estimatePdfTextWidth(text, fontSize, isBold = false) {
  const compactChars = (normalizePdfText(text).match(/[ijlI1.,'|]/g) || []).length;
  const wideChars = (normalizePdfText(text).match(/[MW@#%&]/g) || []).length;
  const base = normalizePdfText(text).length * fontSize * (isBold ? 0.54 : 0.51);

  return base - compactChars * fontSize * 0.18 + wideChars * fontSize * 0.12;
}

function wrapPdfText(text, maxWidth, fontSize, isBold = false) {
  const words = normalizePdfText(text).replace(/\t/g, "    ").split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const wrapped = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (estimatePdfTextWidth(next, fontSize, isBold) <= maxWidth || !current) {
      current = next;
      continue;
    }

    wrapped.push(current);
    current = word;
  }

  if (current) wrapped.push(current);
  return wrapped;
}

function addPdfObject(objects, content) {
  objects.push(content);
  return objects.length;
}

function buildPdfBuffer(resumeText) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 36;
  const topMargin = 32;
  const bottomMargin = 28;
  const contentWidth = pageWidth - marginX * 2;
  const resumeLines = cleanResumeTextForPdf(resumeText)
    .split("\n")
    .map((line) => line.trimEnd());
  const firstHeadingIndex = resumeLines.findIndex(isPdfSectionHeading);
  const headerLines = (firstHeadingIndex > -1 ? resumeLines.slice(0, firstHeadingIndex) : resumeLines.slice(0, 3))
    .map((line) => line.trim())
    .filter(Boolean);
  const bodyLines = firstHeadingIndex > -1 ? resumeLines.slice(firstHeadingIndex) : resumeLines.slice(headerLines.length);
  const bodyItems = preparePdfBodyItems(bodyLines);
  const pageStreams = [[]];
  let y = pageHeight - topMargin;
  let section = "";

  function currentPage() {
    return pageStreams[pageStreams.length - 1];
  }

  function newPage() {
    pageStreams.push([]);
    y = pageHeight - topMargin;
  }

  function ensureSpace(height) {
    if (y - height < bottomMargin) {
      newPage();
    }
  }

  function drawText(text, x, options = {}) {
    const font = options.bold ? "F2" : "F1";
    const fontSize = options.fontSize || 9;
    const lineHeight = options.lineHeight || fontSize + 2.5;
    const color = options.color || (options.muted ? "0.35 g" : "0 g");

    ensureSpace(lineHeight);
    currentPage().push(`${color} BT /${font} ${fontSize} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(text)}) Tj ET`);
    y -= lineHeight;
  }

  function drawRule(ruleY) {
    currentPage().push(`0.07 0.32 0.58 RG 0.75 w ${marginX.toFixed(2)} ${ruleY.toFixed(2)} m ${(pageWidth - marginX).toFixed(2)} ${ruleY.toFixed(2)} l S`);
  }

  function drawCentered(text, options = {}) {
    const fontSize = options.fontSize || 9;
    const isBold = Boolean(options.bold);
    const x = (pageWidth - estimatePdfTextWidth(text, fontSize, isBold)) / 2;

    drawText(text, Math.max(marginX, x), options);
  }

  function addVerticalSpace(amount) {
    y -= amount;
  }

  if (headerLines.length) {
    drawCentered(headerLines[0], { bold: true, fontSize: 20, lineHeight: 21, color: "0.07 0.18 0.32 rg" });

    if (headerLines[1]) {
      drawCentered(headerLines[1], { fontSize: 11, lineHeight: 13, muted: true });
    }

    for (const line of headerLines.slice(2)) {
      for (const wrappedLine of wrapPdfText(line, contentWidth, 9.2)) {
        drawCentered(wrappedLine, { fontSize: 9.2, lineHeight: 11 });
      }
    }

    addVerticalSpace(9);
  }

  for (const item of bodyItems) {
    const line = item.text;

    if (item.type === "blank") {
      addVerticalSpace(4);
      continue;
    }

    if (item.type === "section") {
      section = line.toUpperCase();
      addVerticalSpace(6);
      drawText(section, marginX, { bold: true, fontSize: 11, lineHeight: 13, color: "0.07 0.18 0.32 rg" });
      drawRule(y + 8.2);
      addVerticalSpace(2);
      continue;
    }

    if (item.type === "bullet") {
      const wrapped = wrapPdfText(line, contentWidth - 28, 9.15);

      wrapped.forEach((wrappedLine, index) => {
        drawText(index === 0 ? `- ${wrappedLine}` : `  ${wrappedLine}`, marginX + 16, {
          fontSize: 9.15,
          lineHeight: 10.75
        });
      });
      continue;
    }

    const isEntryTitle = item.type === "title";
    const fontSize = section.includes("SKILLS") ? 9.1 : 9.35;
    const wrapped = wrapPdfText(line, contentWidth, fontSize, isEntryTitle);

    wrapped.forEach((wrappedLine) => {
      drawText(wrappedLine, marginX, {
        bold: isEntryTitle,
        fontSize,
        lineHeight: isEntryTitle ? 11.2 : 10.75
      });
    });
  }

  const objects = [];
  const catalogId = addPdfObject(objects, "");
  const pagesId = addPdfObject(objects, "");
  const regularFontId = addPdfObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addPdfObject(objects, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  for (const pageOps of pageStreams) {
    const stream = pageOps.join("\n");
    const contentId = addPdfObject(objects, `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`);
    const pageId = addPdfObject(objects, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);

    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function safeDownloadName(value) {
  const base = String(value || "optimized-resume")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "optimized-resume";

  return `${base}.pdf`;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function buildDocxBuffer(resumeText) {
  const zip = new JSZip();
  const lines = normalizePdfText(resumeText).split("\n");
  const paragraphs = lines.map((line) => {
    const value = line.trim();
    const isHeading = isPdfSectionHeading(value);
    const isName = lines.indexOf(line) === 0;
    const style = isHeading || isName ? "<w:b/><w:color w:val=\"17365D\"/>" : "";
    const size = isName ? "32" : isHeading ? "24" : "21";

    return `<w:p><w:r><w:rPr>${style}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
  }).join("");

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr></w:body></w:document>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

const RESUME_HEADINGS = new Map([
  ["summary", "summary"],
  ["professional summary", "summary"],
  ["profile", "summary"],
  ["objective", "summary"],
  ["skills", "skills"],
  ["technical skills", "skills"],
  ["core skills", "skills"],
  ["experience", "experience"],
  ["work experience", "experience"],
  ["professional experience", "experience"],
  ["projects", "projects"],
  ["personal projects", "projects"],
  ["personal projects & open source", "projects"],
  ["education", "education"],
  ["certifications", "certifications"],
  ["certification", "certifications"]
]);

const RELATED_SUPPORT = {
  frontend: ["react", "javascript", "html", "css", "redux"],
  "front-end": ["react", "javascript", "html", "css", "redux"],
  "rest api": ["api", "apis", "rest", "node.js", "express"],
  github: ["git", "github actions"],
  git: ["github", "github actions"],
  agile: ["jira", "scrum"],
  scrum: ["agile", "jira"],
  testing: ["unit testing", "integration testing", "jest", "mocha"],
  jest: ["testing", "unit testing", "integration testing"],
  mocha: ["testing", "unit testing", "integration testing"],
  "code reviews": ["github", "git", "github actions"],
  "performance optimization": ["optimized", "reduced", "improved", "performance"],
  "web technologies": ["html", "css", "javascript", "react"]
};

function normalizeLines(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSections(text) {
  const sections = {};
  const contact = [];
  let current = "contact";

  for (const line of normalizeLines(text)) {
    const normalizedHeading = RESUME_HEADINGS.get(line.toLowerCase());

    if (normalizedHeading) {
      current = normalizedHeading;
      if (!sections[current]) sections[current] = [];
      continue;
    }

    if (current === "contact") {
      contact.push(line);
    } else {
      if (!sections[current]) sections[current] = [];
      sections[current].push(line);
    }
  }

  return { contact, sections };
}

function extractSkillKeywords(text) {
  return cleanKeywordList(SKILL_PHRASES.filter((skill) => includesKeyword(text, skill)));
}

function extractYears(text) {
  const matches = [...String(text || "").matchAll(/(\d+)\+?\s*(?:years|yrs)/gi)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : null;
}

function extractEducationRequirement(text) {
  const value = String(text || "");
  const degree = value.match(/\b(bachelor'?s?|master'?s?|bca|b\.?tech|computer science|information technology|it)\b/gi);
  return degree ? unique(degree.map((item) => item.toLowerCase())).join(", ") : "";
}

function extractJobTitle(text) {
  const value = normalizeText(text);
  const titlePatterns = [
    /\b(?:seeking|hiring|looking for)\s+(?:a|an)?\s*([a-z0-9 .+/&-]{3,60}?(?:developer|engineer|analyst|manager|specialist|consultant))/i,
    /\bjob\s+title\s*[:\-]\s*([a-z0-9 .+/&-]{3,60})/i,
    /\b([a-z0-9 .+/&-]{3,40}?(?:react|frontend|front-end|backend|full stack)[a-z0-9 .+/&-]{0,30}?(?:developer|engineer))/i
  ];

  for (const pattern of titlePatterns) {
    const match = value.match(pattern);
    if (match) return sentenceCase(match[1].replace(/\b(skilled|experienced|senior|junior)\b/ig, "").replace(/\s+/g, " ").trim());
  }

  return inferTargetRole(text);
}

function linesAfterHeading(text, headingPatterns) {
  const lines = normalizeLines(text);
  const collected = [];
  let collecting = false;

  for (const line of lines) {
    const isHeading = /:$/i.test(line) || /^[A-Z][A-Za-z &/-]{3,60}$/.test(line);
    const startsTarget = headingPatterns.some((pattern) => pattern.test(line));

    if (startsTarget) {
      collecting = true;
      continue;
    }

    if (collecting && isHeading && collected.length) break;
    if (collecting) collected.push(line.replace(/^[-•]\s*/, ""));
  }

  return collected;
}

function parseJobDescription(jdText) {
  const skills = cleanKeywordList(extractSkillKeywords(jdText));
  const requiredSkills = cleanKeywordList([
    ...extractSkillKeywords(linesAfterHeading(jdText, [/required/i, /skills/i, /competenc/i]).join("\n")),
    ...skills.filter((skill) => ["react", "redux", "javascript", "html", "css", "rest api", "graphql", "git", "github"].includes(skill))
  ]);
  const preferredSkills = cleanKeywordList(extractSkillKeywords(linesAfterHeading(jdText, [/preferred/i, /certifications/i]).join("\n")));
  const responsibilities = linesAfterHeading(jdText, [/responsibil/i, /activities/i]).slice(0, 10);

  return {
    jobTitle: extractJobTitle(jdText),
    requiredSkills,
    preferredSkills,
    tools: cleanKeywordList(skills.filter((skill) => !requiredSkills.includes(skill))),
    yearsExperience: extractYears(jdText),
    education: extractEducationRequirement(jdText),
    responsibilities,
    importantKeywords: cleanKeywordList(topKeywords(jdText, 28))
  };
}

function parseResume(resumeText) {
  const parsed = parseSections(resumeText);
  const allText = normalizeText(resumeText);

  return {
    contact: parsed.contact,
    summary: parsed.sections.summary || [],
    skills: parsed.sections.skills || [],
    experience: parsed.sections.experience || [],
    projects: parsed.sections.projects || [],
    education: parsed.sections.education || [],
    certifications: parsed.sections.certifications || [],
    keywords: extractSkillKeywords(allText),
    yearsExperience: extractYears(allText),
    allText
  };
}

function isSupportedKeyword(keyword, resume) {
  if (includesKeyword(resume.allText, keyword)) return true;

  const related = RELATED_SUPPORT[keyword] || [];
  return related.some((term) => includesKeyword(resume.allText, term));
}

function classifyKeywords(jobKeywords, resume) {
  const found = [];
  const supported = [];
  const unsupported = [];

  for (const keyword of jobKeywords) {
    if (includesKeyword(resume.allText, keyword)) {
      found.push(keyword);
    } else if (isSupportedKeyword(keyword, resume)) {
      supported.push(keyword);
    } else {
      unsupported.push(keyword);
    }
  }

  return { found: unique(found), supported: unique(supported), unsupported: unique(unsupported) };
}

function scoreResume(job, resume, classification) {
  const skillPool = unique([...job.requiredSkills, ...job.preferredSkills, ...job.tools, ...job.importantKeywords]);
  const covered = unique([...classification.found, ...classification.supported]);
  const skillScore = skillPool.length ? Math.round((covered.length / skillPool.length) * 100) : 0;
  const keywordScoreValue = job.importantKeywords.length
    ? Math.round((job.importantKeywords.filter((keyword) => covered.includes(keyword)).length / job.importantKeywords.length) * 100)
    : 0;
  const titleTerms = tokenize(job.jobTitle);
  const titleScore = titleTerms.length && titleTerms.some((term) => includesKeyword(resume.allText, term)) ? 100 : 50;
  const experienceScore = !job.yearsExperience
    ? 100
    : resume.yearsExperience && resume.yearsExperience >= job.yearsExperience
      ? 100
      : resume.yearsExperience
        ? Math.max(35, Math.round((resume.yearsExperience / job.yearsExperience) * 100))
        : 35;
  const educationScore = !job.education || includesKeyword(resume.education.join(" "), "bachelor") || /bca|computer|information technology|it/i.test(resume.education.join(" "))
    ? 100
    : 45;

  return Math.round(
    titleScore * 0.15 +
    skillScore * 0.35 +
    keywordScoreValue * 0.25 +
    experienceScore * 0.15 +
    educationScore * 0.10
  );
}

function sectionText(lines) {
  return lines && lines.length ? lines.join("\n") : "";
}

function rewriteBullet(line, supportedKeywords) {
  const cleaned = line.replace(/^[•*-]\s*/, "").trim();
  if (!cleaned) return "";

  const startsWithAction = ACTION_VERBS.some((verb) => cleaned.toLowerCase().startsWith(`${verb} `));
  const keyword = supportedKeywords.find((item) => includesKeyword(cleaned, item));
  const actionLine = startsWithAction ? cleaned : `Delivered ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;

  return keyword && !includesKeyword(actionLine, keyword)
    ? `- ${actionLine} with ${sentenceCase(keyword)} context.`
    : `- ${actionLine}`;
}

function rewriteBullets(lines, supportedKeywords) {
  return lines.map((line) => {
    if (/^[•*-]\s*/.test(line)) return rewriteBullet(line, supportedKeywords);
    return line;
  }).filter(Boolean);
}

function buildOptimizedResume(job, resume, classification) {
  const supportedKeywords = unique([...classification.found, ...classification.supported]);
  const skillKeywords = cleanKeywordList(supportedKeywords.filter((keyword) => SKILL_PHRASES.includes(keyword)));
  const summarySkills = skillKeywords.slice(0, 7).map(sentenceCase);
  const contact = resume.contact.length ? resume.contact : ["Candidate Name", "Contact details"];
  const existingSkills = extractSkillKeywords(sectionText(resume.skills));
  const orderedSkills = unique([
    ...skillKeywords,
    ...existingSkills.filter((skill) => !skillKeywords.includes(skill))
  ]).map(sentenceCase);

  const sections = [
    ...contact,
    "",
    "SUMMARY",
    `${job.jobTitle} with experience aligned to ${summarySkills.join(", ") || "the target role"}. Skilled in building maintainable, ATS-friendly solutions while keeping claims grounded in the provided resume.`,
    "",
    "SKILLS",
    orderedSkills.join(" | ") || sectionText(resume.skills),
    "",
    "EXPERIENCE",
    ...(rewriteBullets(resume.experience, supportedKeywords).length ? rewriteBullets(resume.experience, supportedKeywords) : ["Add relevant work experience from the default resume."]),
    "",
    "PROJECTS",
    ...(rewriteBullets(resume.projects, supportedKeywords).length ? rewriteBullets(resume.projects, supportedKeywords) : ["Add relevant projects from the default resume."]),
    "",
    "EDUCATION",
    sectionText(resume.education) || "Add education from the default resume."
  ];

  if (resume.certifications.length) {
    sections.push("", "CERTIFICATIONS", sectionText(resume.certifications));
  }

  return sections.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function optimizeResume(resumeText, jdText, instructionText = "") {
  const instructionKeywords = instructionKeywordText(instructionText);
  const job = parseJobDescription([jdText, instructionKeywords].filter(Boolean).join("\n"));
  const resume = parseResume(resumeText);
  const jobKeywords = cleanKeywordList([...job.requiredSkills, ...job.preferredSkills, ...job.tools, ...job.importantKeywords]).slice(0, 32);
  const classification = classifyKeywords(jobKeywords, resume);
  const optimizedResume = buildOptimizedResume(job, resume, classification);
  const optimizedResumeForScore = parseResume(optimizedResume);
  const optimizedClassification = classifyKeywords(jobKeywords, optimizedResumeForScore);
  const score = scoreResume(job, optimizedResumeForScore, optimizedClassification);
  const unsupported = unique(classification.unsupported);

  return {
    score,
    atsScore: score,
    job,
    parsedResume: resume,
    optimizedResume,
    optimizedDraft: optimizedResume,
    matched: unique([...optimizedClassification.found, ...optimizedClassification.supported]).slice(0, 20),
    matchedKeywords: unique([...optimizedClassification.found, ...optimizedClassification.supported]).slice(0, 20),
    missing: unsupported.slice(0, 20),
    missingKeywords: unsupported.slice(0, 20),
    supportedMissingKeywords: classification.supported,
    warnings: unsupported.map((keyword) => `${sentenceCase(keyword)} was requested by the job description but was not added because it is not clearly supported by the default resume.`),
    suggestions: {
      summary: `Target role detected: ${job.jobTitle}`,
      skills: classification.supported.length
        ? `Reasonably supported additions: ${classification.supported.map(sentenceCase).join(" | ")}`
        : "No supported missing skills detected.",
      bullets: [
        instructionText ? `Refinement prompt applied: ${instructionText}` : "Add a refinement prompt and run again to tune the resume further.",
        "Add real metrics only where your default resume already provides numbers or measurable outcomes.",
        "Keep unsupported tools out of the final resume unless you can truthfully add them from your experience.",
        "Prioritize the most relevant experience and projects near the top."
      ]
    }
  };
}

function buildAiPrompt(resumeText, jdText, instructionText, matched, missing) {
  const matchedText = matched.length ? matched.join(", ") : "None clearly detected";
  const missingText = missing.length ? missing.join(", ") : "None clearly detected";
  const extraInstructions = String(instructionText || "").trim();

  return [
    "You are an expert ATS resume writer and recruiter.",
    "",
    "Task:",
    "Update my existing resume for the job description below.",
    "",
    "Important rules:",
    "1. Preserve my original resume structure, section order, tone, and layout as much as possible.",
    "2. Do not change the layout, formatting style, section order, headings, dates, company names, education, or unrelated content.",
    "3. Only update keywords, skills wording, summary wording, and bullet phrasing needed to match the job description.",
    "4. Do not invent experience, companies, education, certifications, dates, metrics, or tools.",
    "5. Only add skills or keywords if they are supported by my resume or can be phrased as relevant exposure without lying.",
    "6. Improve bullet points using strong action verbs, job-description keywords, and measurable impact where the resume already provides enough context.",
    "7. Keep the resume concise and ATS-friendly.",
    "8. Return only the updated resume text, not explanations.",
    "9. If something important from the job description is missing from my resume, add a short section at the end called \"Possible additions to confirm\" with questions for me.",
    "",
    "Keywords already found in my resume:",
    matchedText,
    "",
    "Important keywords missing or weak:",
    missingText,
    "",
    "My current resume:",
    "```",
    resumeText,
    "```",
    "",
    "Target job description:",
    "```",
    jdText,
    "```",
    ...(extraInstructions
      ? [
        "",
        "Additional optimization instructions:",
        "```",
        extraInstructions,
        "```"
      ]
      : []),
    "",
    "Final output:",
    "Please create and provide the complete updated resume as a PDF."
  ].join("\n");
}

function keywordScore(text, keywords) {
  const matched = keywords.filter((keyword) => includesKeyword(text, keyword));
  const missing = keywords.filter((keyword) => !matched.includes(keyword));
  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : 0;

  return { score, matched, missing };
}

function analyzeResume(resumeText, jdText, instructionText = "") {
  const targetText = [jdText, instructionKeywordText(instructionText)].filter(Boolean).join("\n");
  const jdKeywords = topKeywords(targetText);
  const original = keywordScore(resumeText, jdKeywords);
  const matched = original.matched;
  const missing = original.missing;
  const suggestions = buildSuggestions(resumeText, targetText, matched, missing);
  const optimizedResume = buildCompleteResumeDraft(resumeText, suggestions, matched, missing, jdKeywords.length);
  const optimized = keywordScore(optimizedResume, jdKeywords);
  const aiPrompt = buildAiPrompt(resumeText, jdText, instructionText, matched, missing);

  return {
    score: Math.max(original.score, optimized.score),
    originalScore: original.score,
    optimizedScore: optimized.score,
    matched: optimized.matched.slice(0, 14),
    missing: optimized.missing.slice(0, 14),
    suggestions,
    optimizedDraft: optimizedResume,
    optimizedResume,
    aiPrompt
  };
}

async function extractText(file) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ path: file.path });
    return cleanExtractedText(result.value);
  }

  if (extension === ".pdf") {
    const { PDFParse } = require("pdf-parse");
    const buffer = await fs.readFile(file.path);
    const parser = new PDFParse({ data: buffer });

    try {
      const result = await parser.getText();
      return cleanExtractedText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if ([".txt", ".md", ".rtf"].includes(extension)) {
    return cleanExtractedText(await fs.readFile(file.path, "utf8"));
  }

  throw new Error("Unsupported file type. Please upload .txt, .docx, or .pdf.");
}

app.post("/analyze", upload.single("resume"), async (req, res) => {
  const file = req.file;

  try {
    const jd = String(req.body.jd || "").trim();
    const prompt = String(req.body.prompt || "").trim();
    const pastedResume = String(req.body.resumeText || req.body.resume || "").trim();

    if (!jd || (!file && !pastedResume)) {
      return res.status(400).json({ error: "Paste a job description and default resume." });
    }

    const resumeText = pastedResume || await extractText(file);

    if (!resumeText) {
      return res.status(400).json({ error: "I could not read the default resume." });
    }

    const result = optimizeResume(resumeText, jd, prompt);

    res.json({
      fileName: file?.originalname || "default-resume.txt",
      resumePreview: resumeText.slice(0, 1200),
      ...result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to analyze the resume." });
  } finally {
    if (file?.path) {
      await fs.unlink(file.path).catch(() => { });
    }
  }
});

app.post("/download-text", (req, res) => {
  try {
    const resume = String(req.body.resume || "").trim();

    if (!resume) {
      return res.status(400).json({ error: "No optimized resume text was provided." });
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName(req.body.fileName).replace(/\.pdf$/, ".txt")}"`);
    res.send(resume);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create the text file." });
  }
});

app.post("/download-docx", async (req, res) => {
  try {
    const resume = String(req.body.resume || "").trim();

    if (!resume) {
      return res.status(400).json({ error: "No optimized resume text was provided." });
    }

    const docx = await buildDocxBuffer(resume);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${safeDownloadName(req.body.fileName).replace(/\.pdf$/, ".docx")}"`);
    res.send(docx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create the DOCX file." });
  }
});

app.post("/download-pdf", (req, res) => {
  try {
    const resume = String(req.body.resume || "").trim();

    if (!resume) {
      return res.status(400).json({ error: "No optimized resume text was provided." });
    }

    const fileName = safeDownloadName(req.body.fileName);
    const pdf = buildPdfBuffer(resume);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create the PDF." });
  }
});

app.listen(PORT, () => {
  console.log(`Resume optimizer running at http://localhost:${PORT}`);
});
