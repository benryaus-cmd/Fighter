# HAM Fighter — character asset credits

Five GLB character models were uploaded by the project owner and supplied for inclusion in this prototype. All five GLB files contain an embedded Sketchfab `asset.extras` field stating **CC BY 4.0** and identifying their original authors and source URLs. Please preserve attribution in any public build. The model creators, not this project, own the character artwork. Some models depict characters from existing franchises; the Sketchfab uploader's CC BY statement does not necessarily resolve separate underlying character-IP rights.

| Bundled filename | Model | Creator | Original source |
| --- | --- | --- | --- |
| `cat-girl.glb` | Cat Girl - Anime Character Model | VR Avatars | https://sketchfab.com/3d-models/cat-girl-anime-character-model-c3ebdd8cadf549cda8fd01685bf76ed0 |
| `cute-anime-girl.glb` | Cute Anime Girl | VR Avatars | https://sketchfab.com/3d-models/cute-anime-girl-79e0a10c1ed249b6b5c9a65030826b75 |
| `nieko.glb` | Anime girl - Nieko | omelets._.noodle | https://sketchfab.com/3d-models/anime-girl-nieko-d6ed7bebf3df43829cf7aad9f3cbdfe2 |
| `mei-tachibana.glb` | Mei Tachibana - Jashin chan Dropkick | omelets._.noodle | https://sketchfab.com/3d-models/mei-tachibana-jashin-chan-dropkick-ec61f0a4c2f648818ae8b673eaa283f2 |
| `anime-girl-base.glb` | Busty Anime Girl Base | Greebly_ | https://sketchfab.com/3d-models/busty-anime-girl-base-ddbda867b1da4457924bfc50d6d99269 |

CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ — attribution required; note if you have modified the models. All file byte contents are from the supplied GLBs; this project normalises filenames but does not modify their model meshes, textures, or rigs.

## Animation licensing

The original character GLBs contain no animation clips. The current game uses twelve offline-retargeted clips per rig plus a timed special pose. Motion sources and licences are listed below. The stored originals remain unchanged; the base character's bind pose and body vertex units are corrected at runtime.

## Code

Joystick interaction is adapted from the project owner's Aippy-derived React source: https://github.com/benryaus-cmd/Hair-and-Makeup/blob/main/src/ui/Joystick.tsx . The arena, simple fighter AI, procedural fallback models, combat logic and animation posing are original code added for this prototype.
## Combat animation clips (November 2026)

Downloaded from [KinemIQ's free fighting animation library](https://kinemiq.app/free-fighting-animations/) and retargeted offline to the five supplied rigs. Original skeleton-only clips are preserved in `assets/motion-source/`; the resulting browser-ready GLBs are in `public/animations/`.

- **Quaternius Universal Animation Library**, CC0: `punch_jab`, `punch_cross`, `hit_chest`, `death01`. [Creator and library](https://quaternius.com/packs/universalanimationlibrary.html).
- **ACCAD / The Ohio State University, Open Motion Project**, CC BY 3.0: `male2_g2_frontkick`, `male2_g3_sidekickleadingright`, `male2_e8_bounce`, `male2_e3_advance`. [Original motion capture collection](https://accad.osu.edu/research/motion-lab/mocap-system-and-data). [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- KinemIQ supplied the common-skeleton conversions. Changes here: trimmed action windows, removed net horizontal travel, corrected each target's posed bind directions, and baked local rotation/hip tracks for the actual target bone names.

## User-supplied sound previews (November 2026)

Local copies of the supplied Freesound preview URLs are bundled under `public/audio/`. The numbers below identify each original Freesound upload; no licence is inferred from a preview URL.

| Local file | Supplied source |
| --- | --- |
| fight1.mp3 | https://cdn.freesound.org/previews/189/189648_3454623-lq.mp3 |
| snap.mp3 | https://cdn.freesound.org/previews/726/726619_15172097-lq.mp3 |
| thud.mp3 | https://cdn.freesound.org/previews/541/541295_10912485-lq.mp3 |
| giggle.mp3 | https://cdn.freesound.org/previews/323/323704_950925-lq.mp3 |
| gasp.mp3 | https://cdn.freesound.org/previews/219/219890_2157839-lq.mp3 |
| grunt.mp3 | https://cdn.freesound.org/previews/242/242623_950925-lq.mp3 |
| uwu.mp3 | https://cdn.freesound.org/previews/708/708541_4530523-lq.mp3 |

The Celestial Shrine arena, procedural attack arcs, sparks, shock rings, charging motes and energy projectiles are original code. The Creedey combat pack and Robert Brooks / GameDeveloperStudio slash pack were visual references; no files from either pack are redistributed here.


Additional movement/reaction clips: `crouch_idle_loop`, `jump_loop`, `hit_knockback` (Quaternius Universal Animation Libraries 1/2, CC0), and `male2_e5_retreat` (ACCAD / Ohio State University, CC BY 3.0), obtained through the same KinemIQ library. Crouched sweep and downward flying-kick adjustments are original runtime posing. Character outlines use Three.js OutlineEffect (MIT); afterimages reuse the supplied character geometry and preserve its attribution.
