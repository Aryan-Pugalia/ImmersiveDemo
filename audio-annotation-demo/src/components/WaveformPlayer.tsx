import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin, { type Region } from 'wavesurfer.js/dist/plugins/regions.esm.js'
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js'
import { Play, Pause, Volume2, VolumeX, RotateCcw, Repeat } from 'lucide-react'
import type { Segment } from '../lib/schema'
import { msToSec, secToMs, SPEAKER_COLORS } from '../lib/utils'

export interface WaveformHandle {
  seekToMs: (ms: number) => void
  getCurrentMs: () => number
  addRegion: (seg: Segment) => void
  removeRegion: (segId: string) => void
  updateRegion: (seg: Segment) => void
}

interface Props {
  audioUrl:        string
  durationSec:     number
  segments:        Segment[]
  selectedId:      string | null
  onRegionCreated: (startMs: number, endMs: number) => void
  onRegionUpdated: (id: string, startMs: number, endMs: number) => void
  onSegmentSelect: (id: string) => void
  readOnly?:       boolean
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5]

const WaveformPlayer = forwardRef<WaveformHandle, Props>(({
  audioUrl, durationSec, segments, selectedId,
  onRegionCreated, onRegionUpdated, onSegmentSelect, readOnly = false,
}, ref) => {
  const containerRef  = useRef<HTMLDivElement>(null)
  const timelineRef   = useRef<HTMLDivElement>(null)
  const wsRef         = useRef<WaveSurfer | null>(null)
  const regionsRef    = useRef<RegionsPlugin | null>(null)
  const regionMapRef  = useRef<Map<string, Region>>(new Map())

  const [isPlaying,   setIsPlaying]   = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(durationSec)
  const [volume,      setVolume]      = useState(0.8)
  const [muted,       setMuted]       = useState(false)
  const [speed,       setSpeed]       = useState(1)
  const [loop,        setLoop]        = useState(false)
  const [audioOk,     setAudioOk]     = useState<boolean | null>(null)

  // ── Init WaveSurfer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !timelineRef.current) return

    const regions = RegionsPlugin.create()
    regionsRef.current = regions

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     '#334155',
      progressColor: '#818cf8',
      cursorColor:   '#a78bfa',
      cursorWidth:   2,
      height:        80,
      normalize:     true,
      interact:      true,
      plugins: [
        regions,
        TimelinePlugin.create({ container: timelineRef.current, timeInterval: 1, primaryLabelInterval: 5 }),
      ],
    })

    wsRef.current = ws

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      setAudioOk(true)
    })
    ws.on('error', () => { setAudioOk(false) })
    ws.on('play',  () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => {
      setIsPlaying(false)
      if (loop) ws.play()
    })
    ws.on('timeupdate', (t) => setCurrentTime(t))

    // Region creation by drag
    regions.on('region-created', (r: Region) => {
      if (!r.id.startsWith('seg_')) {
        // new drag region → fire callback then remove (segment will come from store)
        const start = secToMs(r.start)
        const end   = secToMs(r.end)
        r.remove()
        onRegionCreated(start, end)
      }
    })

    regions.on('region-updated', (r: Region) => {
      if (r.id.startsWith('seg_')) {
        onRegionUpdated(r.id, secToMs(r.start), secToMs(r.end))
      }
    })

    regions.on('region-clicked', (r: Region, e: MouseEvent) => {
      e.stopPropagation()
      if (r.id.startsWith('seg_')) onSegmentSelect(r.id)
    })

    // Enable drag-to-create
    if (!readOnly) {
      regions.enableDragSelection({ color: 'rgba(129, 140, 248, 0.2)' })
    }

    // Load audio (will fail gracefully if file missing)
    ws.load(audioUrl).catch(() => setAudioOk(false))

    return () => ws.destroy()
  }, [audioUrl]) // eslint-disable-line

  // ── Sync segments → regions ───────────────────────────────────────────────
  useEffect(() => {
    const regions = regionsRef.current
    const ws      = wsRef.current
    if (!regions || !ws) return

    const existing = new Set(regionMapRef.current.keys())

    segments.forEach(seg => {
      const isSelected = seg.segmentId === selectedId
      const color      = SPEAKER_COLORS[seg.speaker] + (isSelected ? '55' : '25')

      if (regionMapRef.current.has(seg.segmentId)) {
        const r = regionMapRef.current.get(seg.segmentId)!
        r.setOptions({
          start: msToSec(seg.startMs),
          end:   msToSec(seg.endMs),
          color,
        })
        existing.delete(seg.segmentId)
      } else {
        const r = regions.addRegion({
          id:    seg.segmentId,
          start: msToSec(seg.startMs),
          end:   msToSec(seg.endMs),
          color,
          drag:  !readOnly,
          resize: !readOnly,
        })
        regionMapRef.current.set(seg.segmentId, r)
        existing.delete(seg.segmentId)
      }
    })

    // Remove deleted
    existing.forEach(id => {
      const r = regionMapRef.current.get(id)
      r?.remove()
      regionMapRef.current.delete(id)
    })
  }, [segments, selectedId, readOnly])

  // ── Volume / speed ────────────────────────────────────────────────────────
  useEffect(() => { wsRef.current?.setVolume(muted ? 0 : volume) }, [volume, muted])
  useEffect(() => { wsRef.current?.setPlaybackRate(speed) }, [speed])

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    seekToMs: (ms) => wsRef.current?.seekTo(msToSec(ms) / (wsRef.current.getDuration() || 1)),
    getCurrentMs: () => secToMs(wsRef.current?.getCurrentTime() ?? 0),
    addRegion: () => {},
    removeRegion: () => {},
    updateRegion: () => {},
  }))

  const togglePlay = useCallback(() => {
    if (!wsRef.current) return
    wsRef.current.isPlaying() ? wsRef.current.pause() : wsRef.current.play()
  }, [])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const ss = Math.floor(s % 60)
    return `${m}:${String(ss).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-2 select-none">
      {/* Waveform */}
      <div className="relative bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        {audioOk === false && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10 gap-2 text-slate-400 text-sm">
            <Volume2 size={16} />
            <span>Audio placeholder — UI fully functional without audio file</span>
          </div>
        )}
        <div ref={containerRef} className="px-2 pt-2" />
        <div ref={timelineRef}  className="px-2 pb-1 text-slate-500" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 bg-slate-900 rounded-lg border border-slate-700 px-3 py-2">

        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-700 hover:bg-brand-600 transition-colors text-white"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Time */}
        <span className="text-xs font-mono text-slate-400 w-20 shrink-0">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        {/* Seek bar */}
        <input
          type="range" min={0} max={duration} step={0.01}
          value={currentTime}
          onChange={e => wsRef.current?.seekTo(Number(e.target.value) / duration)}
          className="flex-1 h-1 accent-brand-500"
          aria-label="Seek"
        />

        {/* Speed */}
        <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
          {SPEEDS.map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                speed === s ? 'bg-brand-700 text-white' : 'hover:bg-slate-700 text-slate-400'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Loop */}
        <button
          onClick={() => setLoop(l => !l)}
          aria-label="Loop segment"
          className={`p-1.5 rounded transition-colors ${loop ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <Repeat size={14} />
        </button>

        {/* Volume */}
        <button
          onClick={() => setMuted(m => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <input
          type="range" min={0} max={1} step={0.01}
          value={muted ? 0 : volume}
          onChange={e => { setVolume(Number(e.target.value)); setMuted(false) }}
          className="w-16 h-1 accent-brand-500"
          aria-label="Volume"
        />
      </div>
    </div>
  )
})

WaveformPlayer.displayName = 'WaveformPlayer'
export default WaveformPlayer
