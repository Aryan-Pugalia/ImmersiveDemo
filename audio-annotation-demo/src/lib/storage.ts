import type { TaskAnnotation } from './schema'

const PREFIX = 'audio_ann_v1_'

export function loadAnnotation(taskId: string): TaskAnnotation | null {
  try {
    const raw = localStorage.getItem(PREFIX + taskId)
    if (!raw) return null
    return JSON.parse(raw) as TaskAnnotation
  } catch {
    return null
  }
}

export function saveAnnotation(ann: TaskAnnotation): void {
  try {
    ann.updatedAt = new Date().toISOString()
    localStorage.setItem(PREFIX + ann.taskId, JSON.stringify(ann))
  } catch (e) {
    console.warn('localStorage write failed', e)
  }
}

export function deleteAnnotation(taskId: string): void {
  localStorage.removeItem(PREFIX + taskId)
}

export function listSavedTaskIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length))
  }
  return ids
}
