# HAM FIGHTER — 3D mobile fighting prototype

A minimal React + Vite + Three.js **two-fighter 3D game** built on the patterns in the owner's Aippy-derived `Hair-and-Makeup` source. It is a real playable prototype, not just an asset viewer or UI mockup.

## Start

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL on a browser or phone on the same network. `npm run build` creates a static site at `dist/`, ready to host in an HTTPS PWA shell or use as a base for an Aippy adaptation.

## Controls

- Left on-screen joystick — move left/right and slightly toward/away along arena depth; supports **simultaneous multi-touch** with attack buttons.
- Right four buttons — **JAB, CROSS, KICK, HEAVY**.
- Desktop **WASD** or **arrow keys**, **J/K/L/I** to attack, **R** to replay after a KO.
- Basic AI opponent approaches and chooses an attack. 90-second round, damage, knockback, hit stun and knockouts.
- Optimised 3D camera/lighting and low-poly procedural character fallback for mobile.

## Install the requested Sketchfab characters

The game references the following CC BY models by `VR_Avatars`:

1. [Cat Girl](https://sketchfab.com/3d-models/cat-girl-anime-character-model-c3ebdd8cadf549cda8fd01685bf76ed0) → `public/models/cat-girl.glb`
2. [Cute Anime Girl](https://sketchfab.com/3d-models/cute-anime-girl-79e0a10c1ed249b6b5c9a65030826b75) → `public/models/cute-anime-girl.glb`

Use Sketchfab's official authenticated Download flow. **These two third-party GLB assets have not been included**. The page automatically loads them if present and falls back to procedural lookalike-style original fighters if they are missing. The app does not pretend the placeholders are the actual Sketchfab models.

## Better combat animation from KinemIQ

Use [KinemIQ Studio](https://kinemiq.app/studio/) or the [free combat animation library](https://kinemiq.app/free-fighting-animations/). To achieve reliable animation across different skeletons, upload each target fighter into KinemIQ Studio and bake/retarget idle, walking, jab, cross, kick, heavy, hit and KO clips onto the character; export a GLB **with animations attached**. Embedded clips named e.g. `Idle`, `Walk`, `Jab`, `Cross`, `Kick`, `Heavy`, `Hit`, `Knockout` are recognised. Raw animation-only GLBs from a differently named rig are not guaranteed to play until retargeted.

The prototype's procedural combat motion does **not** depend on KinemIQ. See `ASSET_CREDITS.md` for links, licences and attribution requirements.

## Scope

One local player versus a lightweight CPU, one arena, one round. No multiplayer, combos, grabs or polished authored mocap built in. `src/game/rules.ts` contains attack timing/hit distance. `src/game/FightGame.ts` controls Three.js and opponent AI. `src/game/GLBFighter.ts` swaps in assets. `src/components/Joystick.tsx` adapts the existing Aippy joystick. `npm test` tests the core combat rules.
