import React from 'react'
import { AbsoluteFill, Composition, Sequence } from 'remotion'
import { T } from './theme'
import { CTA, Features, Hook, HowItWorks, Identity, Invite, Problem } from './scenes'

const SCENES: Array<[React.FC, number]> = [
  [Hook, 85],
  [Problem, 90],
  [Invite, 165],
  [HowItWorks, 240],
  [Identity, 95],
  [Features, 150],
  [CTA, 180]
]

const TOTAL = SCENES.reduce((sum, [, d]) => sum + d, 0)

const Explainer: React.FC = () => {
  let at = 0
  return (
    <AbsoluteFill style={{ background: T.bg }}>
      {SCENES.map(([Scene, duration], i) => {
        const from = at
        at += duration
        return (
          <Sequence key={i} from={from} durationInFrames={duration}>
            <Scene />
          </Sequence>
        )
      })}
    </AbsoluteFill>
  )
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Explainer"
    component={Explainer}
    durationInFrames={TOTAL}
    fps={30}
    width={1920}
    height={1080}
  />
)
