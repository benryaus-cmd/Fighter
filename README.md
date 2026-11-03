# HAM FIGHTER — 3D mobile fighting prototype

One player versus a CPU opponent. **Five supplied rigged female fighters; two different characters are chosen at random per match**. A fast, lightweight React + Vite + Three.js game based on the user's Aippy/React game patterns.

## Start

Requires Node.js 20.19+ or 22.12+. Run:

```bash
npm install
npm run dev
```

For deployment run `npm run build`; `dist/` is a standalone static website. The project has no server/database and supports Android/iPhone touchscreen input. A CI workflow runs `npm test` and `npm run build` on push.

## Play

- **Left** virtual joystick moves the fighter in the small 3D arena. Works simultaneously with right-side actions using multi-touch.
- **Right** four attack buttons: **JAB, CROSS, KICK, HEAVY**.
- Keyboard: WASD/arrows to move, J/K/L/I to attack, R to restart after KO.
- 90-second fights, hit timing and reach, health, hitstun, knockback, ring limits, sound and vibration, KO results, basic CPU opponent.
- **FIGHT AGAIN** selects a *different random pair* from the five fighters.
- Models appear only when present at the paths below; otherwise original low-poly fighters are shown as a backup. Gameplay always remains usable.

## Included fighter assets

| Source upload | Runtime path |
| --- | --- |
| cat_girl_-_anime_character_model.glb | `public/models/cat-girl.glb` |
| cute_anime_girl.glb | `public/models/cute-anime-girl.glb` |
| anime_girl_-_nieko.glb | `public/models/nieko.glb` |
| mei_tachibana_-_jashin_chan_dropkick.glb | `public/models/mei-tachibana.glb` |
| busty_anime_girl_base.glb | `public/models/anime-girl-base.glb` |

These models have genuine skinned skeletons, but **none** has animation clips in the uploaded files. `src/game/GLBFighter.ts` identifies VR Avatars, Mixamo and Blender bone-name conventions and procedurally poses the arm/leg bones for fighting. It is an initial animation pass, not finished motion-captured combat animation. For advanced fighting motion, export a rig-retargeted GLB from [KinemIQ Studio](https://kinemiq.app/studio/) with `Idle`, `Walk`, `Jab`, `Cross`, `Kick`, `Heavy`, `Hit` and `KO` clips.

**Licence and author credits:** See [ASSET_CREDITS.md](ASSET_CREDITS.md). All GLBs report CC BY 4.0 in embedded metadata. Copyright of any underlying franchised characters should be reviewed separately before commercial release.

## Source structure

- `src/game/FightGame.ts` — Three.js scene, CPU AI, camera, match logic and model selection
- `src/game/GLBFighter.ts` — rigged GLB loader and bone-driven animation fallback
- `src/game/roster.ts` — character assets and nonduplicating random selection
- `src/game/rules.ts` — attacks and hit timing
- `src/components/Joystick.tsx` — multitouch movement
- `src/App.tsx`, `src/style.css` — HUD and on-screen controls
- `tests/` — unit tests for combat rules and random roster

No multiplayer, advanced combos, or authored KinemIQ mocap yet.