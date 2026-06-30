# MBTI Fights — 16型人格 2D 网页格斗游戏

A small browser fighting game themed around the 16 MBTI personality types. Pick
from **32 fighters** (16 types × male/female), grouped into the four
16Personalities families, and fight with light/heavy punches & kicks, jumps, and
a **unique special (大招) for every personality type**.

- **Pure vanilla JS + HTML5 Canvas.** No dependencies, no build step.
- **Custom anime-style character art** — a single source grid
  (`assets/mbti-characters.png`) is sliced into 32 transparent sprites by
  `tools/slice_sprites.py`. The fighters are animated with canvas transforms
  (bob / hop / lunge / tilt / KO tumble). Stage, effects, and HUD are drawn in code.
- **Two modes:** single player vs CPU, or two players on one keyboard.

## Play online

Hosted on GitHub Pages: **https://isparkyou-github.github.io/MBTI-Fights/**

## Run it locally

ES modules need to be served over HTTP (not opened as a `file://`). From the
project folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, etc.).

## Controls

| Action            | Player 1 | Player 2 |
|-------------------|:--------:|:--------:|
| 移动 Move L/R     | `A` / `D` | `←` / `→` |
| 跳 Jump           | `W`      | `↑`      |
| 防御 Block (hold) | `S`      | `↓`      |
| 小拳 Light punch  | `F`      | `J`      |
| 大拳 Heavy punch  | `G`      | `K`      |
| 小脚 Light kick   | `C`      | `N`      |
| 大脚 Heavy kick   | `V`      | `M`      |
| 大招 Special      | `R`      | `U`      |

The 大招 needs a full super meter (it fills as you deal and take damage). In
**single-player** mode Player 2 is controlled by the CPU.

### Menus

- **Title:** click or press `Enter`.
- **Select:** click a fighter to assign it (P1 then P2), or use arrows / `WASD`
  to move the cursor and `Space` to confirm. `M` toggles 1P/2P, `R` randomizes,
  `Enter` / **START** begins the match.
- **Result:** `Enter` to rematch, `Backspace` to pick again.

## The 16 unique specials

| Family | Type | Role | 大招 | Mechanic |
|---|---|---|---|---|
| Analysts | INTJ | Architect 建筑师 | 蓝图打击 | charged energy beam |
| Analysts | INTP | Logician 逻辑学家 | 逻辑炸弹 | lobbed bomb → AoE blast |
| Analysts | ENTJ | Commander 指挥官 | 统帅冲锋 | dashing multi-hit charge |
| Analysts | ENTP | Debater 辩论家 | 舌战连击 | rapid projectile spread |
| Diplomats | INFJ | Advocate 提倡者 | 心灵之盾 | defense buff + reflect |
| Diplomats | INFP | Mediator 调停者 | 治愈之歌 | self-heal |
| Diplomats | ENFJ | Protagonist 主人公 | 鼓舞冲击 | strike + attack buff |
| Diplomats | ENFP | Campaigner 竞选者 | 热情旋风 | spinning AoE |
| Sentinels | ISTJ | Logistician 物流师 | 秩序铁拳 | armored heavy strike |
| Sentinels | ISFJ | Defender 守卫者 | 守护反击 | counter stance |
| Sentinels | ESTJ | Executive 总经理 | 命令重锤 | ground shockwave |
| Sentinels | ESFJ | Consul 执政官 | 团结光环 | heal + defense buff |
| Explorers | ISTP | Virtuoso 鉴赏家 | 机械连段 | fast dash combo |
| Explorers | ISFP | Adventurer 探险家 | 艺术爆发 | ranged burst |
| Explorers | ESTP | Entrepreneur 企业家 | 极限飞踢 | leaping launcher kick |
| Explorers | ESFP | Entertainer 表演者 | 聚光灯秀 | dazzle AoE + stun |

## Project layout

```
index.html / styles.css        page shell + canvas
assets/mbti-characters.png     source art grid (32 characters)
assets/sprites/<ID>.png         sliced transparent sprites (e.g. INTJ_M.png)
tools/slice_sprites.py         regenerates the sprites from the source grid
src/sprites.js                 preloads the 32 sprites
src/main.js                    state machine (LOADING→TITLE→SELECT→FIGHT→RESULT) + loop
src/config.js                  tunables: physics, damage table, controls
src/characters.js              16 types → 32 fighters, family palettes
src/specials.js                the 16 大招 definitions
src/fighter.js                 physics, state machine, attacks, special execution
src/projectile.js              projectiles / blasts / reflects
src/match.js                   one fight: timer, win condition, collisions, sfx
src/ai.js                      CPU controller
src/render.js                  procedural low-poly fighters, arena, HUD
src/ui.js                      title, select grid, result screen
src/audio.js                   tiny WebAudio sound effects
src/input.js / src/utils.js    keyboard + helpers
```

Art and code are original; only the personality names/roles are inspired by the
public MBTI taxonomy.
