# HAM FIGHTER

Mobile-first 3D anime fighting prototype. One player versus a CPU, with two random fighters from five supplied GLBs. React, TypeScript, Vite and Three.js; one React root, no server or database.

## Run

```sh
npm ci
npm run dev
```

Open the printed network address on a phone connected to the same Wi-Fi. `npm run dev -- --port 5187 --strictPort` uses an alternate port if an older server is still running. Accept Node.js access to Windows Private networks when prompted.

`npm test` runs the focused rules/rig/settings checks. `npm run build` restores verified model assets and produces the static site in `dist/`.

## Play

- Joystick left/right or A/D: move. Up / W jumps once per push; down / S crouches. There is no camera-depth movement. Movement remains available during attacks at reduced speed.
- A / J: jab. B / K: cross. X / L: front kick. Y / I: power side kick. While crouched, X/Y become low sweeps; while airborne, X/Y become forward flying kicks.
- BURST / U / Space: Celestial Burst, a charging ranged projectile. Costs 35 KI by default. Hits and time refill energy. Sidestep it to dodge.
- Land A → A → B for **Heartbreaker**, or A → B → X for **Crimson Rush**, within the combo window. The final hit adds damage, a stronger impact and bonus energy. Press the next attack near recovery to buffer it; combos require landed hits.
- R / Fight Again: replay with a new random pair after KO.

Jab and cross now have longer, separate wind-up / extension-hold / recovery phases. Twelve baked clips per rig cover stance, advance, four attacks, hit reactions, knockdown, crouch, jump, retreat and fly-back. Sweeps combine the crouch rig with a low leg arc; flying kicks use the power-kick pose with a downward strike angle. Specials reuse the cross pose with their own timing.

## Fight lab

Open Settings above the arena. The fight pauses while the panel is open. Changes apply live and persist on this device.

- **Fight:** attack durations, extension hold, blending, hit pause, input buffering, combo window, damage, movement, jump strength/gravity, game speed, CPU aggression, energy, critical chance/damage/slow-motion, contact radius, body hitbox scale and a visible hitbox overlay.
- **Look:** three lighting presets; toon strength/band count, shadow lift and contrast; skinned character outline thickness, colour and opacity; ghost afterimages; impacts, trails, camera shake/zoom, exposure and individual lights.
- **Sound:** music, combat and voice volumes, plus music/voice switches.
- **Copy JSON:** exports the full configuration with a version number. Uses the Clipboard API on secure pages and a selection/copy fallback on local HTTP. The JSON remains selectable if copying is blocked.
- **Restore defaults:** resets all settings and the saved configuration.

Music unlocks on the first real tap or keypress. Local audio buffers are decoded once and reused. Voice reactions have a cooldown. Returning from a hidden tab may require another tap to resume browser audio.

## Assets and rendering

The Celestial Shrine is a procedural floating arena with a rose sunset, temple gate, floating islands, runes and drifting motes. Hits use bounded, recycled particles, attack arcs and shock rings. No post-processing pipeline is required.

All five original characters remain: `cat-girl.glb`, `cute-anime-girl.glb`, `nieko.glb`, `mei-tachibana.glb`, `anime-girl-base.glb`. `scripts/unpack-models.mjs` restores and verifies their original bytes from committed chunks. The base model's inconsistent FBX bind pose and inverted body units are repaired at load time; the stored source asset remains unchanged.

`npm run bake:combat` regenerates the five animation GLBs from `assets/motion-source/`. This is an offline authoring step; phones load the committed, already-retargeted clips. See [ASSET_CREDITS.md](ASSET_CREDITS.md) for model, animation and audio sources.

No multiplayer, accounts or progression systems.

## Contact and opponent behaviour

Melee damage requires swept contact from the animated fist or foot against the opponent's current head, torso and leg volumes. Both poses update before contact checks. Crouching can duck a high punch, jumping can clear a sweep, and afterimages never have hitboxes. Energy shots also check actual posed body volumes in 3D.

The CPU varies approach, pressure and retreat, leaves room after an attack and sometimes crouches or jumps in response. Heavy hits use the KinemIQ fly-back reaction. Combo finishers and counters can trigger critical bullet time; random critical chance is adjustable. Ghost movement uses at most two cached skeletal snapshots per fighter, with shared geometry.

## Fullscreen launch

On your phone, open the HTTPS game link in Chrome, wait for the fighters to load and tap **Tap to Fight**. That gesture requests real fullscreen with browser navigation hidden and unlocks sound. The match stays paused until you start. The toolbar fullscreen button can restore fullscreen after exiting.

A fullscreen web-app manifest and home-screen icons are included for installation where supported. On iPhone, use the browser's Add to Home Screen option for an app-style launch. Browser fullscreen support varies; a refused request never prevents the game from starting. The service worker uses network-only navigation and stores no game assets, so it does not retain old builds. This is an online game, not an offline package.
