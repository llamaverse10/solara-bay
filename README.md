# solara-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/llamaverse10/solara-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/llamaverse10/solara-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLARA BAY is an open-world crime game in three.js: explore the sun-soaked coastal city of Solara Bay on foot and by car, steal cars, dodge the police, and climb from small-time wheelman to King of Solara across four story missions. Traffic, pedestrians, a wanted system with responding police, combat, a HUD with a minimap, and a save that keeps your money and rank.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome and click Play. WASD move, Shift sprint, Space jump, mouse to look, E enter car / interact, click to shoot, R reload, F punch, Esc pause. Tip: the pier at the south end of the boardwalk hides a cash stash — walk out to the end of it.

## The game

- **City**: Solara Bay — Marina boardwalk and beach in the south, Downtown high-rises in the centre, Old Harbor west, La Colina hills north, industrial port east. Procedural streets, buildings, palms, billboards, and a sunset sky.
- **Missions**: four story jobs for Leo Marín — steal a car for the Chop Shop, run pickups around the Marina, lose a 3-star heat, and pull the Marina Job at Solara Trust bank. Earn money, rise through the ranks: Wheelman → Hustler → Outlaw → King of Solara.
- **Wanted**: 0–5 stars. Police cars pursue and ram; foot cops chase and bust you. Lay low out of sight and the heat decays.
- **Combat**: pistol with reload and headshot bonus, punch, rival thugs and bank guards who shoot back.
- **Tech**: three.js 0.187.0 (vendored), ES modules with no build step, fixed-step 60 Hz simulation, WebAudio synth sound effects and music, DOM HUD with a live minimap, localStorage save.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tvfbjxfd&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
