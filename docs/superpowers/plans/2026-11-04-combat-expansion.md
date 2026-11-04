# Combat expansion implementation plan

Goal: make the existing four-button mobile fight readable, varied and cinematic using the user's tuning and real KinemIQ motion clips.
Architecture: preserve the offline retarget pipeline and rig assets. Add directional move resolution and contact metadata to rules, real clips to the baker, and round/guard/evade/launch state to FightGame. No new dependencies or runtime retargeting.

- [x] Add focused regression tests: directional choices, launches require finishers, guard/low bypass, all actual rig clips animate.
- [x] Fetch the named skeleton-only motions from KinemIQ, bake aligned front/back/capoeira kicks, backfists, uppercut, knee, high guard, dodges, two taunts and two victories. Preserve sources and credits.
- [x] Add three-second non-combat intro, alternating taunts/victories, relative directional attacks, retreat guard and double-flick dodges. Retain neutral attacks and sweep/flying-kick controls.
- [x] Restrict flyback to combo finishers, burst or heavy counters. Pull camera back on launch; apply slow motion and movement-only past-pose ghosts. Delay results until the finish plays.
- [x] Apply supplied settings as defaults; keep saved overrides. Explain controls in Fight Lab and README.
- [x] One unit/build run and one focused browser pass covering countdown, contact/air knee/sweep, guard/dodge, combo launch/camera/trails and end state. Inspect selected screenshots; publish verified tree to main.

Review focus: both facing directions; no combat during countdown; correct physical striking limb; airborne legs retain height; no flyback from isolated ordinary kicks; trails remain at previous locations and disappear; terminal KO still shows the dramatic finish.

Validation: production build and 31 tests passed. Browser checks covered the non-combat intro, jab/cross/front and power kicks, both backfists, uppercut, back/capoeira kicks, sweep, flying knee, high guard, retreat dodge, combo launch, previous-position ghosts and delayed victory results. Software-rendered browser checks sampled game frames directly and rendered screenshots only at selected poses. The existing Vite large-chunk advisory remains.
