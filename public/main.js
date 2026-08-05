import { analyze, buildPdfBuffer, buildDocxBuffer } from "./bundle.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("optimizer-form");
  const jdInput = document.getElementById("jd");
  const resumeInput = document.getElementById("resume");
  const resumeTextInput = document.getElementById("resume-text");
  const promptInput = document.getElementById("prompt");
  const fileName = document.getElementById("file-name");
  const statusEl = document.getElementById("status");
  const resultsContainer = document.getElementById("results-container");
  const runButton = document.getElementById("run-button");
  const clearButton = document.getElementById("clear-button");
  const dropZone = document.getElementById("drop-zone");

  let latestDraft = "";

  const emptyStateHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 3H5C3.89 3 3.01 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V5H19V19ZM14 17H7V15H14V17ZM17 13H7V11H17V13ZM17 9H7V7H17V9Z"/>
      </svg>
      <p>Your optimized resume, ATS score, matched keywords, missing keywords, and unsupported keyword warnings will appear here.</p>
    </div>
  `;

  resumeInput.addEventListener("change", updateFileName);

  dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("is-dragging");
  });

  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");

    if (event.dataTransfer.files.length) {
      resumeInput.files = event.dataTransfer.files;
      updateFileName();
    }
  });

  clearButton.addEventListener("click", () => {
    form.reset();
    latestDraft = "";
    fileName.textContent = "Optional: PDF, DOCX, TXT, MD, RTF";
    statusEl.textContent = "";
    statusEl.className = "status";
    resultsContainer.innerHTML = emptyStateHTML;
  });

  function updateFileName() {
    fileName.textContent = resumeInput.files[0]
      ? resumeInput.files[0].name
      : "Optional: PDF, DOCX, TXT, MD, RTF";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const jd = jdInput.value.trim();
    const file = resumeInput.files[0];
    const resumeText = resumeTextInput.value.trim();
    const prompt = promptInput.value.trim();

    if (!jd || (!resumeText && !file)) {
      showStatus("Please paste the job description and provide a resume file or pasted resume text.", true);
      return;
    }

    runButton.disabled = true;
    runButton.classList.add("loading");
    showStatus("Parsing the job description and building a truthful ATS resume...", false);

    try {
      const data = await analyze({ jd, resumeText, file, prompt });
      latestDraft = getResumeDraftFromResponse(data);
      renderResults(data);
      showStatus("Finished. Review the draft, warnings, and score before exporting.", false);
    } catch (error) {
      resultsContainer.innerHTML = emptyStateHTML;
      showStatus(error.message || "Could not analyze this file.", true);
    } finally {
      runButton.disabled = false;
      runButton.classList.remove("loading");
    }
  });

  function showStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.className = isError ? "status error" : "status";
  }

  function renderResults(data) {
    const draft = getResumeDraftFromResponse(data);
    const suggestions = renderSuggestions(data.suggestions);
    const warnings = renderWarnings(data.warnings);
    const job = data.job || {};

    resultsContainer.innerHTML = `
      <div class="results-content fade-in">
        <div class="score-card">
          <div class="score-circle" style="--score: ${data.score}%">
            <div class="score-value">${data.score}%</div>
            <div class="score-label">ATS</div>
          </div>
          <div style="flex: 1">
            <div class="keywords-section">
              <h3>Target Role</h3>
              <div class="preview compact">${escapeHtml(job.jobTitle || "Not detected")}</div>
            </div>
            <div class="keywords-section">
              <h3>Matched Keywords</h3>
              <div class="chips">${renderChips(data.matchedKeywords || data.matched, "matched")}</div>
            </div>
            <div class="keywords-section" style="margin-top: 16px;">
              <h3>Missing Unsupported Keywords</h3>
              <div class="chips">${renderChips(data.missingKeywords || data.missing, "missing")}</div>
            </div>
          </div>
        </div>

        ${suggestions}
        ${warnings}

        <div class="section">
          <h3>Optimized Resume Draft</h3>
          <textarea class="draft resume-draft" id="draft">${escapeHtml(draft)}</textarea>
          <div class="actions" style="margin-top: 16px;">
            <button type="button" class="btn-primary" id="download-pdf-btn">Download PDF</button>
            <button type="button" class="btn-secondary" id="download-docx-btn">Download DOCX</button>
            <button type="button" class="btn-secondary" id="download-text-btn">Download TXT</button>
            <button type="button" class="btn-secondary" id="copy-btn">Copy Text</button>
          </div>
        </div>

        <div class="section">
          <h3>Default Resume Preview</h3>
          <div class="preview">${escapeHtml(data.resumePreview || "")}</div>
        </div>
      </div>
    `;

    document.getElementById("draft").addEventListener("input", (event) => {
      latestDraft = event.target.value;
    });

    document.getElementById("copy-btn").addEventListener("click", copyDraft);
    document.getElementById("download-pdf-btn").addEventListener("click", () => downloadExport("pdf"));
    document.getElementById("download-docx-btn").addEventListener("click", () => downloadExport("docx"));
    document.getElementById("download-text-btn").addEventListener("click", () => downloadExport("txt"));
  }

  function getResumeDraftFromResponse(data) {
    if (data.optimizedResume) return data.optimizedResume;
    if (data.optimizedDraft) return data.optimizedDraft;

    const resumePreview = data.resumePreview || "[Resume text was not returned.]";
    const matched = data.matched?.length ? data.matched.join(", ") : "None clearly detected";
    const missing = data.missing?.length ? data.missing.join(", ") : "None clearly detected";
    const jd = jdInput.value.trim();

    return [
      "PROFESSIONAL SUMMARY",
      `Resume aligned to ${matched}. Review the missing keywords below and add only what is true.`,
      "",
      "CORE SKILLS",
      matched,
      "",
      resumePreview,
      "",
      "POSSIBLE ADDITIONS TO CONFIRM",
      missing,
      "",
      "TARGET DETAILS USED",
      jd
    ].join("\n");
  }

  function renderSuggestions(suggestions) {
    if (!suggestions) return "";

    const bullets = suggestions.bullets?.length
      ? `<ul>${suggestions.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
      : "";

    return `
      <div class="section">
        <h3>Recommended Edits</h3>
        <div class="recommendations">
          <p>${escapeHtml(suggestions.summary || "")}</p>
          <p>${escapeHtml(suggestions.skills || "")}</p>
          ${bullets}
        </div>
      </div>
    `;
  }

  function renderWarnings(warnings) {
    if (!warnings || !warnings.length) return "";

    return `
      <div class="section">
        <h3>Unsupported Keyword Warnings</h3>
        <div class="recommendations warning-list">
          <ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  function renderChips(items, className) {
    if (!items || !items.length) {
      return `<span class="chip">None found</span>`;
    }
    return items.map((item) => `<span class="chip ${className}">${escapeHtml(item)}</span>`).join("");
  }

  async function copyDraft() {
    const draft = document.getElementById("draft")?.value || latestDraft;
    if (!draft) return;
    
    try {
      await navigator.clipboard.writeText(draft);
      const btn = document.getElementById("copy-btn");
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      btn.style.background = "var(--success)";
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = "";
      }, 2000);
      
      showStatus("Copied the resume draft.", false);
    } catch (err) {
      showStatus("Failed to copy to clipboard.", true);
    }
  }

  async function downloadExport(type) {
    const draft = document.getElementById("draft")?.value.trim() || latestDraft.trim();

    if (!draft) {
      showStatus("There is no resume draft to download yet.", true);
      return;
    }

    const labels = {
      pdf: "PDF",
      docx: "DOCX",
      txt: "TXT"
    };
    const button = document.getElementById(`download-${type === "txt" ? "text" : type}-btn`);
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = `Creating ${labels[type]}...`;

    try {
      let blob;

      if (type === "pdf") {
        blob = new Blob([await buildPdfBuffer(draft)], { type: "application/pdf" });
      } else if (type === "docx") {
        blob = new Blob([await buildDocxBuffer(draft)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      } else {
        blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `optimized-resume.${type}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showStatus(`${labels[type]} downloaded.`, false);
    } catch (error) {
      showStatus(error.message || `Could not download the ${labels[type]}.`, true);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
