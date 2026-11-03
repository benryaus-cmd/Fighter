# Optional Sketchfab fighter models

Place your officially downloaded, licensed GLB 2.0 files here with exactly these names:

- `cat-girl.glb` — VR_Avatars, Cat Girl — https://sketchfab.com/3d-models/cat-girl-anime-character-model-c3ebdd8cadf549cda8fd01685bf76ed0
- `cute-anime-girl.glb` — VR_Avatars, Cute Anime Girl — https://sketchfab.com/3d-models/cute-anime-girl-79e0a10c1ed249b6b5c9a65030826b75

Both are described by the author as rigged, available under CC BY. You must obtain the files yourself through an authenticated Sketchfab download (Sketchfab does not allow direct anonymous model download). Preserve the artist and licence attribution in your distributed game. Read `ASSET_CREDITS.md`.

The game loads them automatically, scales each to ~1.95 world units high, and uses available embedded animations where named recognisably. Otherwise it tries a basic bone-rotation fallback. Character/skeleton retargeting from unrelated KinemIQ animation files isn't automatic — for best combat motion, bake/retarget animations onto these specific models in KinemIQ Studio/Blender, then export each animated character as a GLB.

If either GLB is missing/invalid, the game uses a stylised original procedural female character so it still runs immediately.
