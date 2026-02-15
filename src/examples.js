/**
 * examples.js — Browseable library of HDSL example scripts.
 *
 * Pure data module. No DOM, no Three.js.
 * examples[0] is the default loaded at startup.
 * All examples use the pirouette source (4.9s).
 */

export const examples = [
  {
    id: 'choreography',
    title: 'Choreography',
    script: `# Choreography — slice, sequence, mirror
bpm 120

source pirouette

clip prep from pirouette 0.0-1.5
clip spin from pirouette 1.5-3.5
clip finish from pirouette 3.5-4.9

@1:1  clip prep
@2:3  clip spin
@4:3  clip spin mirror
@6:3  clip finish
`,
  },
  {
    id: 'slow-motion',
    title: 'Slow Motion',
    script: `# Slow Motion — half-speed pirouette
bpm 120

source pirouette

clip full from pirouette 0.0-4.9

@1:1  clip full speed 0.5
`,
  },
  {
    id: 'mirror-dance',
    title: 'Mirror Dance',
    script: `# Mirror Dance — alternating mirror spins
bpm 120

source pirouette

clip spin from pirouette 1.0-3.0

@1:1  clip spin
@3:1  clip spin mirror
@5:1  clip spin
@7:1  clip spin mirror
`,
  },
  {
    id: 'rewind',
    title: 'Rewind',
    script: `# Rewind — forward then reversed
bpm 120

source pirouette

clip full from pirouette 0.0-4.9

@1:1  clip full
@5:4  clip full reverse
`,
  },
  {
    id: 'posed-sequence',
    title: 'Posed Sequence',
    script: `# Posed Sequence — clips with pose overlays
bpm 120

source pirouette

clip spin from pirouette 1.0-3.5

pose arms-high
  lShldr rot 0 0 -160
  rShldr rot 0 0 160

@1:1  clip spin
@1:1  pose arms-high ease-out
@3:1  pose rest ease-in hold 2
`,
  },
  {
    id: 'full-pirouette',
    title: 'Full Pirouette',
    script: `# Full Pirouette — simplest possible script
bpm 120

source pirouette

clip full from pirouette 0.0-4.9

@1:1  clip full
`,
  },
];
