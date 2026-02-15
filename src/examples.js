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
  {
    id: 'bharatanatyam-adavu',
    title: 'Bharatanatyam: Adavu Stances',
    script: `# Bharatanatyam: Adavu Stances — the four body postures (sthanaka)
# Sama, Mandala (Aramandi), Alidha, Kuncita janu (Muzhumandi)
# Reference: Padma Subrahmanyam, "Bharata's Art Then and Now"
bpm 80

source pirouette

# sama sthana: feet together, body erect, arms at sides
pose sama
  hip pos 0 85 0
  lShldr rot -70 0 0
  rShldr rot 70 0 0
  lThigh rot 0 0 0
  rThigh rot 0 0 0
  lShin rot 0 0 0
  rShin rot 0 0 0

# mandala sthana / aramandi: feet parshva (turned out), knees bent
# "the outward bend of the thigh and knees is prominent"
# hands in natyarambha: arms at shoulder height (T-pose)
pose aramandi
  hip pos 0 70 0
  lShldr rot 0 0 0
  rShldr rot 0 0 0
  lThigh rot 20 -40 0
  rThigh rot -20 -40 0
  lShin rot 0 50 0
  rShin rot 0 50 0

# alidha: left leg in mandala, right leg stretched straight on the side
# "the extended leg has the heel touching the ground"
pose alidha
  hip pos -5 68 0
  lShldr rot 0 0 0
  rShldr rot 0 0 0
  lThigh rot 20 -45 0
  rThigh rot -35 0 0
  lShin rot 0 55 0
  rShin rot 0 0 0

# kuncita janu / muzhumandi: deep squat, thighs and shanks in contact
# "the back rests on the heel, knees spread out on the sides"
pose muzhumandi
  hip pos 0 55 0
  lShldr rot 0 0 0
  rShldr rot 0 0 0
  lThigh rot 25 -70 0
  rThigh rot -25 -70 0
  lShin rot 0 90 0
  rShin rot 0 90 0

@1:1  pose sama ease-out hold 2
@3:1  pose aramandi ease-in hold 4
@5:1  pose alidha ease-in-out hold 2
@7:1  pose aramandi ease-in hold 4
@9:1  pose muzhumandi ease-in hold 2
@11:1 pose aramandi ease-out hold 4
@13:1 pose sama ease-in hold 2
`,
  },
];
