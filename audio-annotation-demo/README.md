# TP.ai · Audio Transcription & Translation Annotation Studio

A production-quality, **local-only** annotation platform for labeling multilingual audio —
transcription, speaker diarization, translation, QC review, and export.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run dev server
npm run dev
# → Opens at http://localhost:5174
```

> **Requires Node.js ≥ 18.** If not installed, download from https://nodejs.org

---

## Project Structure

```
audio-annotation-demo/
├── public/
│   ├── manifest.json          ← 12 sample tasks (2 per language)
│   └── samples/
│       ├── zh/zh_01.mp3       ← Placeholder paths; replace with real files
│       ├── ar/ar_01.mp3
│       ├── hi/hi_01.mp3
│       ├── ko/ko_01.mp3
│       ├── fr/fr_01.mp3
│       └── ja/ja_01.mp3
├── src/
│   ├── pages/
│   │   ├── Landing.tsx        ← Home page + workflow overview
│   │   ├── Queue.tsx          ← Task list with filters + dashboard
│   │   ├── Annotate.tsx       ← Main annotation workspace
│   │   └── Review.tsx         ← Reviewer / QC workspace
│   ├── components/
│   │   ├── WaveformPlayer.tsx ← WaveSurfer.js wrapper (Regions + Timeline)
│   │   ├── SegmentTable.tsx   ← Full segment editing table
│   │   ├── TranscriptEditor.tsx
│   │   ├── TranslationEditor.tsx
│   │   ├── DiffView.tsx       ← Word-level diff vs reference
│   │   ├── QCPanel.tsx        ← Approve/Return + audio quality flags
│   │   ├── ExportModal.tsx    ← JSON/CSV download
│   │   └── ShortcutsPanel.tsx
│   ├── store/
│   │   └── annotationStore.ts ← Zustand state + all mutations
│   └── lib/
│       ├── schema.ts          ← TypeScript types + data model
│       ├── storage.ts         ← localStorage helpers
│       └── utils.ts           ← Formatting, diff, helpers
└── README.md
```

---

## How to Add / Replace Audio Files

1. Drop your `.mp3` (or `.wav`, `.ogg`) files into:
   ```
   public/samples/<lang>/<lang>_01.mp3
   public/samples/<lang>/<lang>_02.mp3
   ```
2. Update `durationSec` in `public/manifest.json` to match actual length.
3. The app detects missing audio gracefully — waveform shows a placeholder banner
   but all text editing, segmenting, and export still work.

---

## Supported Source Languages

| Code | Language | Flag |
|------|----------|------|
| `zh` | Chinese  | 🇨🇳 |
| `ar` | Arabic   | 🇸🇦 (RTL editor) |
| `hi` | Hindi    | 🇮🇳 |
| `ko` | Korean   | 🇰🇷 |
| `fr` | French   | 🇫🇷 |
| `ja` | Japanese | 🇯🇵 |

---

## Workflow

```
Landing → Queue → Annotate → Submit → Review (QC) → Export
```

### Annotator Flow
1. Open **Queue**, pick a task.
2. **Annotation Workspace**:
   - Drag on waveform to create segments, or press **A**.
   - Edit source transcript and English translation per segment.
   - Set speaker label (S1/S2/OVERLAP/UNK), audio flags, non-speech events.
   - Click **Save Draft** at any time (auto-saved to `localStorage`).
   - Click **Submit to Review** when done.

### Reviewer Flow
1. Switch role to **Reviewer** (top-right toggle).
2. Open the same task from Queue.
3. In **Review** page:
   - Use **Spot Check** to jump to a random segment.
   - Toggle **Edit Mode** for minor fixes.
   - Switch to **Diff (Source)** or **Diff (English)** tabs to see word-level changes vs reference.
   - Open **QC Panel** → set audio quality, PII level, add notes.
   - Click **Approve** or **Return for Rework**.

---

## How to Export Annotations

1. From Annotate or Review page, click **Export**.
2. Choose **JSON** or **CSV**.
3. Click **Download** — file saves to your Downloads folder.
4. Or click **Copy** to copy to clipboard.

### Output Schema (JSON)

```json
{
  "project": "audio_transcribe_translate_demo",
  "taskId": "zh_01",
  "sourceLanguage": "zh",
  "status": "submitted",
  "segments": [
    {
      "segmentId": "seg_001",
      "startMs": 500,
      "endMs": 3200,
      "speaker": "S1",
      "nonSpeech": "NONE",
      "sourceText": "你好，我想要一杯拿铁咖啡。",
      "englishText": "Hello, I'd like a latte, please.",
      "flags": {
        "lowConfidence": false,
        "needsSecondPass": false,
        "audioIssue": "NONE"
      },
      "comments": []
    }
  ],
  "taskLevel": {
    "overallAudioQuality": "good",
    "piiPresent": "none",
    "reviewOutcome": "approved"
  }
}
```

---

## Keyboard Shortcuts

| Key      | Action                          |
|----------|---------------------------------|
| `Space`  | Play / Pause                    |
| `A`      | Add segment at playhead (2s)    |
| `S`      | Split selected segment at playhead |
| `D`      | Delete selected segment         |
| `J`      | Seek back 2 seconds             |
| `K`      | Play / Pause (alt)              |
| `L`      | Seek forward 2 seconds          |
| `1`      | Set speaker → S1                |
| `2`      | Set speaker → S2                |
| `3`      | Set speaker → OVERLAP           |
| `4`      | Set speaker → UNK               |
| `Escape` | Deselect segment                |
| `?`      | Toggle shortcuts panel          |

---

## Local Persistence

All annotation data is stored in **`localStorage`** keyed by `taskId`.
Refreshing the page preserves your work. To reset a task, clear its key:
```js
// In browser DevTools console:
localStorage.removeItem('audio_ann_v1_zh_01')
```

---

## Tech Stack

| Layer        | Technology                                      |
|--------------|-------------------------------------------------|
| Build        | Vite 5 + TypeScript                             |
| UI           | React 18 + Tailwind CSS 3 (local-bundled)       |
| Waveform     | WaveSurfer.js v7 + Regions + Timeline plugins   |
| State        | Zustand                                         |
| Routing      | React Router v6                                 |
| Persistence  | localStorage (no backend, no network calls)     |

---

## Known Limitations

- **No real ASR/MT**: All transcriptions and translations are pre-seeded synthetic data.
  The platform is a labeling UI, not an inference pipeline.
- **Audio files are placeholders**: The UI fully works without audio — waveform shows a
  placeholder banner when the file is missing.
- **No multi-user sync**: State is localStorage only. For real team use, replace the
  `storage.ts` layer with a backend API.
- **No undo/redo**: Segment edits are applied immediately. Use "Save Draft" checkpoints.
- **RTL waveform**: WaveSurfer doesn't render RTL — only the transcript text editor is RTL
  for Arabic tasks.
