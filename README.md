# Resume Optimizer

Tailor your resume for the exact job. Paste a job description and your default resume to generate a truthful ATS-optimized resume with warnings for unsupported keywords.

## Features

- Paste a job description or upload one
- Upload a default resume (`.txt`, `.md`, `.rtf`, `.docx`, `.pdf`) or paste it
- Optional refinement prompt (e.g. "make it more React focused")
- ATS score, matched keywords, missing keywords, and unsupported keyword warnings
- Suggestion panel with summary, skills line, and bullet rewrites
- Download the optimized resume as `.txt`, `.docx`, or `.pdf` (client-side PDF/DOCX preview via pdf.js)
- Truthful only — the optimizer never adds claims not supported by your default resume

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, Multer
- **Text extraction:** pdf-parse, mammoth (DOCX)
- **Frontend:** Vanilla JS/HTML/CSS, esbuild bundle, pdf.js

## Getting Started

### Prerequisites

- Node.js (with npm)

### Install

```bash
npm install
```

### Build the frontend bundle

```bash
npm run build
```

### Run

```bash
npm start
```

The app will be served at `http://localhost:5000` (override with the `PORT` environment variable).

## API Endpoints

| Method | Route             | Description                                      |
| ------ | ----------------- | ------------------------------------------------ |
| POST   | `/analyze`        | Upload a resume file + job description, returns optimization result |
| POST   | `/download-text`  | Download optimized resume as `.txt`              |
| POST   | `/download-docx`  | Download optimized resume as `.docx`             |
| POST   | `/download-pdf`   | Download optimized resume as `.pdf`              |

### `/analyze` request

Multipart form data:

| Field        | Type      | Description                       |
| ------------ | --------- | --------------------------------- |
| `jd`         | `string`  | Full job description text         |
| `resume`     | `file`    | Optional resume file (max 8 MB)   |
| `resumeText` | `string`  | Optional pasted resume text       |
| `prompt`     | `string`  | Optional refinement instructions  |

## Project Structure

```
├── public/          # Static frontend (index.html, styles.css, main.js, bundle.js)
├── src/
│   ├── index.ts     # Express server + optimization logic
│   └── browser.ts   # pdf.js preview logic (bundled to public/bundle.js)
├── uploads/         # Temporary uploaded files (gitignored)
└── package.json
```

## License

ISC
