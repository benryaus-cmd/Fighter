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

- Joystick / WASD / arrows: move, including during attacks at reduced speed.
- A / J: jab. B / K: cross. X / L: front kick. Y / I: power side kick.
- BURST / U / Space: Celestial Burst, a charging ranged projectile. Costs 35 KI by default. Hits and time refill energy. Sidestep it to dodge.
- Land A → A → B for **Heartbreaker**, or A → B → X for **Crimson Rush**, within the combo window. The final hit adds damage, a stronger impact and bonus energy. Press the next attack near recovery to buffer it; combos require landed hits.
- R / Fight Again: replay with a new random pair after KO.

Jab and cross now have longer, separate wind-up / extension-hold / recovery phases. Eight baked motion clips per rig cover stance, advance, four attacks, hit reactions and knockdown. Retreat currently reuses the advance cycle. Specials reuse the cross pose with their own timing.

## Fight lab

Open Settings above the arena. The fight pauses while the panel is open. Changes apply live and persist on this device.

- **Fight:** individual attack durations, extension hold, blending, hit pause, input buffering, combo window, damage, movement, game speed, CPU aggression, energy cost/regeneration and CPU/infinite-energy switches.
- **Look:** three lighting presets, toon shading strength, impacts, trails, camera shake/zoom, exposure and individual light intensities.
- **Sound:** music, combat and voice volumes, plus music/voice switches.
- **Copy JSON:** exports the full configuration with a version number. Uses the Clipboard API on secure pages and a selection/copy fallback on local HTTP. The JSON remains selectable if copying is blocked.
- **Restore defaults:** resets all settings and the saved configuration.

Music unlocks on the first real tap or keypress. Local audio buffers are decoded once and reused. Voice reactions have a cooldown. Returning from a hidden tab may require another tap to resume browser audio.

## Assets and rendering

The Celestial Shrine is a procedural floating arena with a rose sunset, temple gate, floating islands, runes and drifting motes. Hits use bounded, recycled particles, attack arcs and shock rings. No post-processing pipeline is required.

All five original characters remain: `cat-girl.glb`, `cute-anime-girl.glb`, `nieko.glb`, `mei-tachibana.glb`, `anime-girl-base.glb`. `scripts/unpack-models.mjs` restores and verifies their original bytes from committed chunks. The base model's inconsistent FBX bind pose and inverted body units are repaired at load time; the stored source asset remains unchanged.

`npm run bake:combat` regenerates the five animation GLBs from `assets/motion-source/`. This is an offline authoring step; phones load the committed, already-retargeted clips. See [ASSET_CREDITS.md](ASSET_CREDITS.md) for model, animation and audio sources.

No multiplayer, accounts or progression systems.
