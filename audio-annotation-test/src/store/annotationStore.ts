import { create } from 'zustand'
import type {
  TaskAnnotation, Segment, Speaker, NonSpeech, AudioIssue,
  AudioQuality, PIILevel, TaskStatus,
} from '../lib/schema'
import { makeSegment, makeSegmentId, seedAnnotationFromRef } from '../lib/schema'
import { loadAnnotation, saveAnnotation } from '../lib/storage'
import type { TaskManifest } from '../lib/schema'

interface AppState {
  // UI
  role: 'annotator' | 'reviewer'
  setRole: (r: 'annotator' | 'reviewer') => void

  // Current task
  manifest: TaskManifest | null
  annotation: TaskAnnotation | null
  selectedSegmentId: string | null

  // Load / init
  initTask: (manifest: TaskManifest) => void
  clearTask: () => void

  // Segment CRUD
  setSelectedSegment: (id: string | null) => void
  addSegment: (startMs: number, endMs: number) => void
  updateSegmentTimes: (id: string, startMs: number, endMs: number) => void
  updateSegmentText: (id: string, field: 'sourceText' | 'englishText', value: string) => void
  updateSegmentSpeaker: (id: string, speaker: Speaker) => void
  updateSegmentNonSpeech: (id: string, ns: NonSpeech) => void
  updateSegmentFlag: (id: string, key: 'lowConfidence' | 'needsSecondPass', value: boolean) => void
  updateSegmentAudioIssue: (id: string, issue: AudioIssue) => void
  deleteSegment: (id: string) => void
  splitSegmentAtMs: (id: string, atMs: number) => void
  mergeSegments: (id1: string, id2: string) => void
  addSegmentComment: (id: string, by: 'annotator' | 'reviewer', text: string) => void

  // Task-level
  setAudioQuality: (q: AudioQuality) => void
  setPIILevel: (p: PIILevel) => void
  setReviewNotes: (notes: string) => void

  // Workflow
  submitTask: () => void
  returnTask: () => void
  approveTask: () => void
  saveDraft: () => void

  // Persistence
  _persist: () => void
}

export const useAnnotationStore = create<AppState>((set, get) => ({
  role: 'annotator',
  setRole: (r) => set({ role: r }),

  manifest: null,
  annotation: null,
  selectedSegmentId: null,

  initTask: (manifest) => {
    const saved = loadAnnotation(manifest.id)
    const annotation = saved ?? seedAnnotationFromRef(manifest)
    if (!saved) saveAnnotation(annotation)
    set({ manifest, annotation, selectedSegmentId: null })
  },

  clearTask: () => set({ manifest: null, annotation: null, selectedSegmentId: null }),

  setSelectedSegment: (id) => set({ selectedSegmentId: id }),

  addSegment: (startMs, endMs) => {
    const { annotation } = get()
    if (!annotation) return
    const seg = makeSegment(startMs, endMs)
    const segments = [...annotation.segments, seg].sort((a, b) => a.startMs - b.startMs)
    const updated = { ...annotation, segments, status: 'in_progress' as TaskStatus }
    set({ annotation: updated, selectedSegmentId: seg.segmentId })
    saveAnnotation(updated)
  },

  updateSegmentTimes: (id, startMs, endMs) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, startMs, endMs } : s
    ).sort((a, b) => a.startMs - b.startMs)
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  updateSegmentText: (id, field, value) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, [field]: value } : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  updateSegmentSpeaker: (id, speaker) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, speaker } : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  updateSegmentNonSpeech: (id, ns) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, nonSpeech: ns } : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  updateSegmentFlag: (id, key, value) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, flags: { ...s.flags, [key]: value } } : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  updateSegmentAudioIssue: (id, issue) => {
    const { annotation } = get()
    if (!annotation) return
    const segments = annotation.segments.map(s =>
      s.segmentId === id ? { ...s, flags: { ...s.flags, audioIssue: issue } } : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  deleteSegment: (id) => {
    const { annotation, selectedSegmentId } = get()
    if (!annotation) return
    const segments = annotation.segments.filter(s => s.segmentId !== id)
    const updated = { ...annotation, segments }
    set({
      annotation: updated,
      selectedSegmentId: selectedSegmentId === id ? null : selectedSegmentId,
    })
    saveAnnotation(updated)
  },

  splitSegmentAtMs: (id, atMs) => {
    const { annotation } = get()
    if (!annotation) return
    const seg = annotation.segments.find(s => s.segmentId === id)
    if (!seg || atMs <= seg.startMs || atMs >= seg.endMs) return
    const half = Math.floor(seg.sourceText.length / 2)
    const a: Segment = {
      ...seg,
      endMs:      atMs,
      sourceText:  seg.sourceText.slice(0, half),
      englishText: seg.englishText.slice(0, Math.floor(seg.englishText.length / 2)),
    }
    const b: Segment = {
      ...seg,
      segmentId:   makeSegmentId(),
      startMs:     atMs,
      sourceText:  seg.sourceText.slice(half),
      englishText: seg.englishText.slice(Math.floor(seg.englishText.length / 2)),
      comments:    [],
    }
    const segments = annotation.segments
      .filter(s => s.segmentId !== id)
      .concat([a, b])
      .sort((x, y) => x.startMs - y.startMs)
    const updated = { ...annotation, segments }
    set({ annotation: updated, selectedSegmentId: a.segmentId })
    saveAnnotation(updated)
  },

  mergeSegments: (id1, id2) => {
    const { annotation } = get()
    if (!annotation) return
    const s1 = annotation.segments.find(s => s.segmentId === id1)
    const s2 = annotation.segments.find(s => s.segmentId === id2)
    if (!s1 || !s2) return
    const [first, second] = s1.startMs <= s2.startMs ? [s1, s2] : [s2, s1]
    const merged: Segment = {
      ...first,
      endMs:       second.endMs,
      sourceText:  first.sourceText + ' ' + second.sourceText,
      englishText: first.englishText + ' ' + second.englishText,
      comments:    [...first.comments, ...second.comments],
    }
    const segments = annotation.segments
      .filter(s => s.segmentId !== id1 && s.segmentId !== id2)
      .concat([merged])
      .sort((a, b) => a.startMs - b.startMs)
    const updated = { ...annotation, segments }
    set({ annotation: updated, selectedSegmentId: merged.segmentId })
    saveAnnotation(updated)
  },

  addSegmentComment: (id, by, text) => {
    const { annotation } = get()
    if (!annotation) return
    const at = new Date().toISOString()
    const segments = annotation.segments.map(s =>
      s.segmentId === id
        ? { ...s, comments: [...s.comments, { by, text, at }] }
        : s
    )
    const updated = { ...annotation, segments }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  setAudioQuality: (q) => {
    const { annotation } = get()
    if (!annotation) return
    const updated = { ...annotation, taskLevel: { ...annotation.taskLevel, overallAudioQuality: q } }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  setPIILevel: (p) => {
    const { annotation } = get()
    if (!annotation) return
    const updated = { ...annotation, taskLevel: { ...annotation.taskLevel, piiPresent: p } }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  setReviewNotes: (notes) => {
    const { annotation } = get()
    if (!annotation) return
    const updated = { ...annotation, reviewNotes: notes }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  submitTask: () => {
    const { annotation } = get()
    if (!annotation) return
    const updated = { ...annotation, status: 'submitted' as TaskStatus }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  returnTask: () => {
    const { annotation } = get()
    if (!annotation) return
    const updated = {
      ...annotation,
      status: 'returned' as TaskStatus,
      taskLevel: { ...annotation.taskLevel, reviewOutcome: 'needs_rework' as const },
    }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  approveTask: () => {
    const { annotation } = get()
    if (!annotation) return
    const updated = {
      ...annotation,
      status: 'approved' as TaskStatus,
      taskLevel: { ...annotation.taskLevel, reviewOutcome: 'approved' as const },
    }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  saveDraft: () => {
    const { annotation } = get()
    if (!annotation) return
    const status: TaskStatus = annotation.status === 'not_started' ? 'in_progress' : annotation.status
    const updated = { ...annotation, status }
    set({ annotation: updated })
    saveAnnotation(updated)
  },

  _persist: () => {
    const { annotation } = get()
    if (annotation) saveAnnotation(annotation)
  },
}))
