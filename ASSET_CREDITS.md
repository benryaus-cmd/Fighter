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

No authored combat animations are embedded in the five uploaded GLBs, and no KinemIQ animation files were supplied. This prototype uses real skeleton bones with **original procedural combat posing** for movement and four attacks. An imported GLB with retargeted animation clips (`Idle`, `Walk`, `Jab`, `Cross`, `Kick`, `Heavy`, `Hit`, `Knockout`) will be recognised by the loader when present. Additional mocap can be obtained from https://kinemiq.app/studio/ . Check and credit each animation's own licence before bundling it.

## Code

Joystick interaction is adapted from the project owner's Aippy-derived React source: https://github.com/benryaus-cmd/Hair-and-Makeup/blob/main/src/ui/Joystick.tsx . The arena, simple fighter AI, procedural fallback models, combat logic and animation posing are original code added for this prototype.