# Run a Restaurant!

Browser multiplayer restaurant tycoon for Bloxity: Three.js client, Colyseus server, npm workspaces (`shared` /
`server` / `client`). The networking, persistence, Bloxity SDK/avatars, movement and deploy pipeline were forked
from the sibling game `D:\Garden Horizons`; the town, restaurants, simulation, UI and models are this game's own.
The user's reference screenshots (a Roblox restaurant game: blue diamond-patterned window headers, cream bodies,
red square X, the left rail Premium / Shop / Manage / Groups / Skills, "Items [B]", the task card with a green
Rewards button, SKIP TUTORIAL, "[E] Take Order" prompts) are the design source of truth.

## Commands

```bash
npm run dev                 # builds shared, then server (tsx watch, :2820, --dev-cheats) + Vite client (:5520)
npm run build               # shared + server + client (client/dist)
npm run typecheck           # all workspaces
npm run verify              # verify:progression + verify:layout + verify:assets (static)
npm run verify:loop         # needs npm run dev: a bot plays the whole tutorial, visiting, persistence, staff
npm run verify:staff        # needs npm run dev: expansion, styles, farm, ranch, farmers, offline income, pets, fishing
npm run verify:capacity     # needs a running server: 18 clients, expects 15-per-room routing
npm run verify:persistence  # spawns its own server on :2821: guests, accounts, grants, restarts (JSON + Mongo)
npm run verify:stats        # Bloxity stat reporter against a mock API (guests skipped, legion_ ids, limits, batches)
npm run size:client         # client/dist size against the 12 MB budget (~2.4 MB)
```

In dev the game exposes `window.__restaurant.game` and `window.__kit` (`client/src/dev/testkit.ts`, never shipped):
`__kit.dev({...})`, `__kit.home(x, z)` (teleport to a plot-local point), `__kit.self()`, `__kit.restaurant()`,
`__kit.step(n)` (a hidden tab throttles rAF). The dev server accepts a `dev` message (`cash`, `diamonds`, `xp`,
`items`, `ingredients`, `tutorial`, `customer`, `away` (simulate an absence), `ripen`, `bite` (a fish bites now),
`tp: [x, z]`) only with
`--dev-cheats` and never in production. Editing server code restarts `tsx watch`, which disconnects browser
clients - reload the page.

Do NOT use python from the Bash tool. Never embed backticks in shell strings: write a .cjs file to the
scratchpad and run it.

## Non-negotiable rules

- Ports: server **2820**, Vite **5520**, preview 4520 (sibling games use 2567-2795 / 5173-5480). Room
  `runarestaurant`, Bloxity slug `run-a-restaurant`, 15 per room = 15 restaurant plots.
- **Client build under 12 MB.** Only the player FBX + texture, `ui/shop.png` (favicon/boot logo) and the two mp3s
  ship; `vite.config.ts` prunes the rest of `assets/`. Every model, icon and sound effect is generated in code.
- **Server-authoritative economy.** Every verb (seat, order, ticket, cook, plate, serve, dish, wash, cash, harvest,
  collect), purchase, placement, hire, expansion and claim is validated in `server/src/restaurant/*` against the
  server's position of the player, their own restaurant, inventory and purse. Visitors can walk in but cannot act.
  Cash, items, fridge, skills are PRIVATE (`SelfState`); restaurants (items, customers, staff, orders) are public.
- **NPCs walk replicated routes.** The server runs A* (`shared/config/nav.ts`, one-unit grid over the plot),
  string-pulls it and replicates `path` ("x,z;x,z") + `t0` + `speed`; clients only decode and interpolate on the
  shared clock. Arrival times are the server's. Customers' phases are `PHASE`, orders' stages `STAGE`.
- **Placement rules live in `shared/config/placement.ts`** (zones, overlap, entry/porch clearance, limits, seats)
  and are used by both the server and the client ghost. Snap is 0.5 units; items are plot-local, front faces -Z at
  rot 0. A chair touching a table is a seat (`seatOf`); chairs turn to face their table.
- **Timestamps, not ticks**: crops (`a` = ripe at), pens (`a` next produce, `b` waiting), stoves (`a` done, `c`
  order), sinks (`a` next clean, `b` queued). Crops/pens persist, so farms grow offline.
- **Shop stock is a pure function** of (restock epoch, item, the player's refresh salt) (`shared/config/shop.ts`);
  what each player bought this restock is on their profile.
- **Art style: a polished Roblox game.** Everything is built with `PartBuilder` from blocks; NPCs are the player
  model re-dressed (`NpcSkin` paints outfits, `NpcCharacter` adds hats). UI styles: `client/src/ui/styles.ts`
  (`rr-` classes, sizes in `--u`, touch rules at the end).

## Layout facts

- Square town: plaza |x|,|z| < 72 with the Shop (x -40..40, z 16..68, keeper at (0,62), 66 plinths), the fountain,
  spawn (0,-48) and six leaderboards at x = +-60. Ring road 166..178. Plots: front edge 186 from the middle,
  4 north / 4 east / 3 south (market green at x -45) / 4 west, each 80 x 64 plot-local (x -40..40, z 0..64).
- In a plot: the restaurant's door is fixed at x = -18 in the front wall (z 6); tiers grow it about that door
  (22x16 -> 40x28). Farm x 8..38 z 4..30, ranch x 8..38 z 36..62, fenced, gates on the x = 8 side. Customers come
  from the street at (-18,-8) and queue at `QUEUE_SPOTS`.
- Pet Merchant stall at (-38,-44) (`PET_MERCHANT`, NPC behind the counter, buy within 12). Fishing Pier runs
  south from the ring road at x = -60 out to z -352 (`PIER`, a `'path'` ground strip); casting works from
  z <= -338 on the pier (sea) or at the park pond's edge (`castFrom`). Biggest Fish board at (60,-62).
- `npm run verify:layout` checks plots/buildings/trees/Shop don't collide and the starter kitchen is reachable.

## Pets and fishing

- Pets (`shared/config/pets.ts`): 10 pets hatched from 3 eggs (Basic $750, Rare $12k at Silver I, Royal 60
  Diamonds) at the Pet Merchant. 25 owned, 3 follow (`EQUIP_LIMIT`); each equipped pet adds a perk (tips, cook
  speed, walk speed, XP, rare-customer luck, fishing luck), summed per perk and capped at 60%. Server:
  `PetService` (`sync` writes `player.pets` "1,6,9" and `moveSpeed`), perks read via `ctx.perk(chef, perk)`.
  Client: `world/Companions.ts` (pets follow every player; fishing line + bobber), Manage > Pets,
  `ui/PetWindows.ts` (Pet Merchant window, hatch dialog).
- Fishing (`shared/config/fishing.ts`): skill index 5, unlocks at Silver I. Rods are zone `'none'` Shop items
  (ids 90-93, owned once, kept in `profile.styles`; the best owned rod counts). `FishingService`: cast ->
  bite after 4-9 s (faster with rod and level) -> a 2.6 s reel window; too early or too late loses it; walking
  6+ away reels in. A catch adds Fish (ingredient 10) to the fridge for the seafood recipes, fills the fish
  index, and sets `bestFish` (the Biggest Fish board, stored as kg x 100). PlayerState `fishing` 0/1/2 +
  `fishX`/`fishZ` replicate the bobber.

## Bloxity

- One module, `client/src/bloxity/Bloxity.ts`, and one `onUserChanged`. `registerFeature('emotes')` runs in
  `start()` (before assets). `play_emote` -> `Game.playEmote` -> `animation/Emotes.ts` (catalogue fetched once;
  clips converted onto `PlayerRig` as `W * D * W^-1` with `W` read off the live rig; `_Offset` tracks compose onto
  `ArmX1`) and `MessageType.Emote` -> `PlayerState.emote`/`emoteCount`; moving clears it on both sides.
- Appearance has 19 slots (`shared/types/avatar.ts`): hair and masks hang like hats; neck/chest/waist under
  their bone at `restInverse * translate(origin)`; hand/shoes are mirrored pairs re-placed each frame
  (`BloxityAvatar.follow`); face/shirt/pants make the skin the `skin-texture` composite URL.
- `playerInRoom`/`playerJoined` are sent the player's DISPLAY NAME (the SDK matches friends on it).
- Server: `bloxity/statReporter.ts` (rooms register a source; leavers hand over a last row) and
  `routes/rooms.ts` (all-rooms; the cross-pod reader is a seam - `legion-room-reporter.ts` is not in this repo).

## Progress and identity

Per-key storage (`server/src/persistence/`), Mongo via `MONGODB_URI` else JSON (`RESTAURANT_DATA_DIR`), profile
read at join, Bloxity token verified server-side, guest -> account migration, webhook grants (`BUX_PACKS`:
`diamonds_small`, `diamonds_large`, `cash_small`). Profile: `StoredProfile.ts` (cash, diamonds, inventory, styles,
fridge, xp, recipesOff, customer index, counters, milestone index, shop purchases, boosts, restaurant record,
rank, likes, daily, pets, petsEquipped, nextPetUid, fishIndex, bestFish). Offline income on join (`RestaurantService.offlineIncome`): needs a waiter and a cook, capped
by hours (more with a manager) and by the register's capacity.
