import React from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from './theme'

export const useSpringIn = (delay: number, durationInFrames = 20) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: frame - delay, fps, durationInFrames, config: { damping: 200 } })
}

export const FadeUp: React.FC<{
  delay: number
  children: React.ReactNode
  style?: React.CSSProperties
  dist?: number
}> = ({ delay, children, style, dist = 30 }) => {
  const s = useSpringIn(delay)
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * dist}px)`, ...style }}>
      {children}
    </div>
  )
}

export const Typewriter: React.FC<{
  text: string
  delay: number
  cps?: number
  color?: string
  style?: React.CSSProperties
}> = ({ text, delay, cps = 2.6, color = T.termText, style }) => {
  const frame = useCurrentFrame()
  const chars = Math.max(0, Math.floor((frame - delay) * cps))
  const done = chars >= text.length
  const blink = Math.floor(frame / 14) % 2 === 0
  return (
    <span style={{ fontFamily: T.mono, color, whiteSpace: 'pre-wrap', ...style }}>
      {text.slice(0, chars)}
      {!done && frame >= delay && (
        <span style={{ opacity: blink ? 1 : 0, color: T.accent }}>▋</span>
      )}
    </span>
  )
}

// Dark slate code window on the ivory page.
export const Terminal: React.FC<{
  title: string
  width: number
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ title, width, children, style }) => (
  <div
    style={{
      width,
      background: T.termBg,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 18px 50px rgba(20,20,19,0.18)',
      ...style
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 16px',
        background: '#232320',
        borderBottom: '1px solid #3a3934'
      }}
    >
      <Dot c="#ff5f57" />
      <Dot c="#febc2e" />
      <Dot c="#28c840" />
      <span style={{ marginLeft: 10, color: T.termDim, fontFamily: T.mono, fontSize: 19 }}>{title}</span>
    </div>
    <div style={{ padding: 22, fontSize: 26, lineHeight: 1.55 }}>{children}</div>
  </div>
)

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <div style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
)

export const DrawnLine: React.FC<{
  x1: number
  y1: number
  x2: number
  y2: number
  delay: number
  color?: string
  width?: number
  dashed?: boolean
}> = ({ x1, y1, x2, y2, delay, color = T.accent, width = 5, dashed = false }) => {
  const s = useSpringIn(delay, 18)
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x1 + (x2 - x1) * s}
      y2={y1 + (y2 - y1) * s}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dashed ? '13 11' : undefined}
      opacity={s > 0.01 ? 1 : 0}
    />
  )
}

export const Packet: React.FC<{
  x1: number
  y1: number
  x2: number
  y2: number
  start: number
  end: number
  color?: string
}> = ({ x1, y1, x2, y2, start, end, color = T.accentDeep }) => {
  const frame = useCurrentFrame()
  if (frame < start || frame > end + 6) return null
  const t = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  const fade = interpolate(frame, [end, end + 6], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  })
  return (
    <circle
      cx={x1 + (x2 - x1) * t}
      cy={y1 + (y2 - y1) * t}
      r={11}
      fill={color}
      opacity={fade}
      style={{ filter: `drop-shadow(0 0 10px ${color})` }}
    />
  )
}

export const SceneTitle: React.FC<{ text: React.ReactNode; delay?: number; top?: number }> = ({
  text,
  delay = 0,
  top = 62
}) => (
  <FadeUp delay={delay} style={{ position: 'absolute', top, width: '100%', textAlign: 'center' }}>
    <span style={{ fontFamily: T.serif, fontSize: 56, fontWeight: 700, color: T.ink }}>{text}</span>
  </FadeUp>
)

export const PageBg: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: T.bg,
      backgroundImage: `radial-gradient(${T.border} 1.2px, transparent 1.2px)`,
      backgroundSize: '56px 56px'
    }}
  />
)
