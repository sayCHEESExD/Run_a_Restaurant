# Run a Restaurant!

A multiplayer restaurant tycoon for the browser, styled like a polished Roblox game. Fifteen players share a
restaurant town: each owns a restaurant plot on the ring road, seats customers, takes orders, cooks, serves,
washes up and collects the cash - then buys furniture and appliances at the big Shop in the plaza, grows
ingredients on the farm, raises chickens, cows and pigs, hires staff to automate everything, expands the
restaurant and climbs from Bronze I to Master. Walk into anyone's restaurant to see how they run it, and leave
a like.

Three.js client, authoritative Colyseus server (15 players and 15 restaurants per room), hosted on Bloxity.

## Play

| Action | PC | Mobile |
| --- | --- | --- |
| Walk / jump | WASD or arrows / Space | left stick / JUMP |
| Camera / zoom | right-drag (or left-drag) / wheel | drag |
| Seat, take order, cook, serve, wash, collect, buy... | E at the prompt (F for the second one) | tap the prompt |
| Build mode (place, move, pick up) | B, click to place, R to rotate | Items button, tap then Place |
| Music | M | - |

The left rail opens Premium (Diamond boosts, daily Diamonds, store), the Shop (or Home, near the Shop), Manage
(Staff, Recipes, Customers, Pets, Restaurant), Visit (restaurants in this server, leaderboards) and Skills (Skills,
Rank, Milestones). The card on the right is the current milestone; Rewards claims it.

## The loop

1. A short tutorial with a guide chef: walk in, place a table and chairs, seat the first customer, take the
   order, grab the ticket, cook it, grab the plate, serve, clear and wash the dish, collect the cash, visit the
   Shop, buy and place an upgrade.
2. Customers keep arriving (more, and rarer, as the restaurant ranks up and is decorated). Rare, Gourmet and
   Legendary guests pay more and bring perks (tips, rating, XP, Diamonds).
3. Recipes unlock with Cooking level and need ingredients from the farm (Wheat, Tomato, Potato, Lettuce, Corn,
   Carrot) and the ranch (Egg, Milk, Bacon), stored in fridges.
4. Staff (Waiters, Cooks, Cleaners, Farmers, Ranchers, a Manager) take over the work and earn while you are away.
5. Expand from a Cozy Diner to a Grand Restaurant; restyle the floor and walls.
6. Pets: buy eggs from the Pet Merchant in the plaza and hatch one of 10 blocky pets. Up to three follow you
   and help (bigger tips, faster cooking, walk speed, skill XP, rarer customers, better fishing).
7. Fishing (from Silver I): buy a rod in the Shop's Fishing aisle, walk to the end of the Fishing Pier south
   of town (or the park pond), cast with E and reel in when the bobber dips. Fish stock the fridge for
   Fish & Chips, Grilled Fish, Sushi and the Seafood Platter; the heaviest catch makes the Biggest Fish board.

## Develop

```bash
npm install
npm run dev
```

Client on http://localhost:5520, server on :2820. See `CLAUDE.md` for the rules, the verification scripts and
the layout facts.

## Deploy (Bloxity Hosting)

`.github/workflows/deploy.yml` publishes on every push (`dev` -> DEV channel, `main` -> PROD):

- **Backend:** the Colyseus server is built from the root `Dockerfile`, pushed to
  `ghcr.io/<owner>/run-a-restaurant-server:<channel>-<sha>` and rolled with
  `POST https://legion.bloxity.io/v1/apps/run-a-restaurant/deploy` (`seatCap` 15). Legion injects `PORT` and
  `MONGODB_URI` and probes `/health`.
- **Frontend:** `client/dist` is built with that channel's WebSocket URL baked in and uploaded to
  `POST https://api.bloxity.io/v1/hosting/games/run-a-restaurant/frontend?channel=<channel>&version=<sha>`.

One-time setup: create the game `run-a-restaurant` on https://hosting.bloxity.io, add the repository secret
`LEGION_DEPLOY_TOKEN`, make the GHCR package public after the first run, and (optionally) create the SKUs
`diamonds_small`, `diamonds_large` and `cash_small` and set `BLOXITY_WEBHOOK_SECRET` on the backend.

Bloxity extras:

- **Profile stats** ("Only in this game"): the server reports cash, customers served, rank, likes, staff,
  cooking level, pets and fish every 60 s and on shutdown when Legion injects `BLOXITY_REPORT_TOKEN` and
  `BLOXITY_GAME_ID` (`server/src/bloxity/statReporter.ts`; `npm run verify:stats` checks it against a mock).
- **Emotes**: the game registers the `emotes` feature on boot; the portal's picker plays Bloxity's catalogue
  clips on the avatar and every other player sees them. Moving ends an emote.
- **Servers panel**: `GET /api/coly-matchmaker/all-rooms?mode=0`. Set the catalogue row's `allRoomsUrl` (Developer
  panel) to `https://<hosting id>.host.bloxity.io/api/coly-matchmaker/all-rooms?mode=0`. In a Legion deployment
  (`MATCHMAKER_REPORT_URL` set) it answers from the cross-pod directory reader once one is installed
  (`installDirectoryReader`), and 502 until then rather than undercounting one pod.
- **Invite links**: `?roomId=` joins that room by id, falling back to any room.
