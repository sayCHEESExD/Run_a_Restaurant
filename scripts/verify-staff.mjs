/**
 * THE LATER GAME, played by a bot against a RUNNING dev server (npm run dev):
 * expanding the restaurant, farming (place a plot, harvest into the fridge),
 * ranching (a coop lays eggs, collect them), farmers and ranchers working the
 * yard on their own, style purchases, and the offline income a staffed
 * restaurant earns while its owner is away. Uses the dev server's cheats for
 * cash, XP, items, teleports, ripening and a simulated absence.
 *
 * Usage: start the server (npm run dev), then `npm run verify:staff`.
 */
import { Client } from 'colyseus.js';
import { PIER, PLACES, PLOT_SLOTS, POND, ROOM_NAME, toWorld } from '../shared/dist/index.js';

const ENDPOINT = process.env.ENDPOINT ?? 'ws://localhost:2820';
let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (probe, label, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await sleep(60);
  }
};

const client = new Client(ENDPOINT);
const room = await client.joinOrCreate(ROOM_NAME, { playerId: `staff-${Date.now().toString(36)}`, identity: { displayName: 'StaffBot', avatarUrl: '' } });
room.self = null;
room.notices = [];
room.away = null;
room.onMessage('self', (m) => (room.self = m));
room.onMessage('notice', (m) => room.notices.push(m.text));
room.onMessage('away', (m) => (room.away = m));
for (const type of ['fx', 'respawn', 'authState', 'levelUp', 'rankUp']) room.onMessage(type, () => {});
await waitFor(() => room.self && room.state.players.get(room.sessionId)?.slot >= 0, 'own state');

const me = () => room.state.players.get(room.sessionId);
const r = () => room.state.restaurants[me().slot];
const items = () => [...r().items.values()];
const stock = (id) => room.self.ingredients.find((s) => s.id === id)?.count ?? 0;
const act = async (type, message = {}) => {
  room.send(type, message);
  await sleep(150);
};
const go = async (x, z) => {
  const at = toWorld(PLOT_SLOTS[me().slot], x, z);
  await act('dev', { tp: [at.x, at.z] });
  await sleep(150);
};

console.log(`later game (${ENDPOINT})`);
await act('dev', { tutorial: true, cash: 2_000_000, xp: 9000, items: 3 });
await waitFor(() => me().rank >= 5, 'rank 5', 8000);
check(true, `XP and furniture raise the rank (now ${me().rank})`);

// ---------------------------------------------------------------- expand
await go(-18, -4);
await act('expand');
await waitFor(() => r().tier === 1, 'tier 1');
await act('expand');
await waitFor(() => r().tier === 2, 'tier 2');
check(r().tier === 2, 'the restaurant expands to a Bistro and then a Restaurant');

// ---------------------------------------------------------------- styles
await act('dev', { tp: [0, 62 - 5] });
await act('buy', { id: 81, count: 1 });
await waitFor(() => room.self.styles.includes(81), 'the checkered floor');
await act('style', { id: 81 });
await waitFor(() => r().floor === 81, 'floor applied');
check(true, 'a floor style is bought at the Shop and applied');

// ----------------------------------------------------------------- farm
await go(0, 2);
await act('place', { kind: 60, x: 12, z: 8, rot: 0 });
await act('place', { kind: 61, x: 17, z: 8, rot: 0 });
await act('place', { kind: 70, x: 13, z: 41, rot: 0 });
await act('place', { kind: 60, x: -10, z: 8, rot: 0 });
check(room.notices.some((t) => t.includes('farm')), 'a crop plot outside the farm is refused');
const wheat = await waitFor(() => items().find((i) => i.kind === 60), 'the wheat plot');
const coop = await waitFor(() => items().find((i) => i.kind === 70), 'the coop');
check(!!wheat && !!coop && items().some((i) => i.kind === 61), 'crop plots go in the farm and a coop in the ranch');
await act('dev', { ripen: true });
await go(12, 11);
await act('act', { verb: 'harvest', id: wheat.id });
await waitFor(() => stock(1) >= 3, 'wheat in the fridge');
check(stock(1) === 3, 'harvesting a ripe plot puts 3 Wheat in the fridge');
const regrow = items().find((i) => i.id === wheat.id).a;
check(regrow > room.state.now, 'the plot is replanted and growing again');

// ---------------------------------------------------------------- ranch
await waitFor(() => items().find((i) => i.id === coop.id).b > 0, 'eggs in the coop', 60_000);
await go(13, 45.5);
await act('act', { verb: 'collect', id: coop.id });
await waitFor(() => stock(7) > 0, 'eggs in the fridge');
check(stock(7) >= 2, `the coop lays eggs, collected into the fridge (${stock(7)})`);

// ---------------------------------------------------------- yard staff
await act('hire', { staff: 31 });
await act('hire', { staff: 41 });
await waitFor(() => r().staff.size === 2, 'farmer and rancher');
const wheatBefore = stock(1) + stock(2);
await act('dev', { ripen: true });
await go(-18, -4);
await waitFor(() => stock(1) + stock(2) > wheatBefore, 'the farmer to harvest', 30_000);
check(true, `the farmer harvests ripe crops on their own (fridge ${stock(1)} wheat, ${stock(2)} tomato)`);

// -------------------------------------------------------- offline income
await act('hire', { staff: 1 });
await act('hire', { staff: 11 });
await waitFor(() => r().staff.size === 4, 'waiter and cook');
room.away = null;
await act('dev', { away: 3600 });
await waitFor(() => room.away, 'the away report');
check(room.away.cash > 0 && room.away.served > 0, `a staffed restaurant earns while you are away ($${room.away.cash}, ${room.away.served} served in 1h)`);
check(room.away.cash <= 25_000, 'offline income is capped by the register');

// ----------------------------------------------------------------- pets
console.log('pets');
room.hatches = [];
room.onMessage('hatch', (m) => room.hatches.push(m));
await act('dev', { tp: [0, -48] });
await act('pet', { action: 'buy', egg: 1 });
check(room.notices.some((t) => t.includes('Pet Merchant')), 'eggs are only sold at the Pet Merchant');
await act('dev', { tp: [PLACES.pets.x, PLACES.pets.z] });
await act('pet', { action: 'buy', egg: 1 });
await act('pet', { action: 'buy', egg: 1 });
await waitFor(() => room.hatches.length === 2 && room.self.pets.length === 2, 'two hatched pets');
check(room.self.petsEquipped.length === 2 && me().pets.split(',').length === 2, `hatched pets follow their owner (${me().pets})`);
await act('dev', { diamonds: 500 });
await act('pet', { action: 'buy', egg: 3 });
await act('pet', { action: 'buy', egg: 3 });
await waitFor(() => room.self.pets.length === 4, 'four pets');
check(room.self.petsEquipped.length === 3, 'no more than three pets follow at once');
const extra = room.self.pets.find((p) => !room.self.petsEquipped.includes(p.uid));
await act('pet', { action: 'equip', uid: extra.uid });
check(room.notices.some((t) => t.includes('Unequip one first')), 'equipping a fourth is refused');
const cashBefore = room.self.cash;
await act('pet', { action: 'sell', uid: extra.uid });
await waitFor(() => room.self.pets.length === 3, 'a sold pet');
check(room.self.cash > cashBefore, 'a pet sells back for cash');

// -------------------------------------------------------------- fishing
console.log('fishing');
room.catches = [];
room.onMessage('catch', (m) => room.catches.push(m));
await act('dev', { tp: [PIER.x, PIER.minZ + 6] });
await act('fish', { action: 'cast' });
check(room.notices.some((t) => t.includes('rod')), 'casting without a rod is refused');
await act('dev', { tp: [0, 57] });
await act('buy', { id: 90, count: 1 });
await waitFor(() => room.self.styles.includes(90), 'the basic rod');
check(true, 'a Basic Rod is bought at the Shop');
await act('dev', { tp: [0, -48] });
await act('fish', { action: 'cast' });
check(room.notices.some((t) => t.includes('end of the pier')), 'casting away from the water is refused');
await act('dev', { tp: [PIER.x, PIER.minZ + 6] });
check(Math.abs(me().z - (PIER.minZ + 6)) < 1, `players can walk out to the end of the pier (z ${me().z.toFixed(1)})`);
await act('fish', { action: 'cast' });
await waitFor(() => me().fishing === 1, 'a line in the water');
check(room.self.fishing?.water === 'sea', 'the line goes out to sea');
await act('fish', { action: 'reel' });
check(room.notices.some((t) => t.includes('Too early')), 'reeling before the bite loses the fish');
await act('fish', { action: 'cast' });
await waitFor(() => me().fishing === 1, 'cast again');
await act('dev', { bite: true });
await waitFor(() => me().fishing === 2, 'a bite', 4000);
await act('fish', { action: 'reel' });
await waitFor(() => room.catches.length === 1, 'the catch');
const catchMsg = room.catches[0];
check(catchMsg.weight > 0 && room.self.fishIndex.length === 1 && stock(10) >= 1, `a fish is landed into the fridge (fish ${catchMsg.fish}, ${catchMsg.weight} kg)`);
check(room.self.bestFish.weight === catchMsg.weight, 'the first catch is a personal best');
await act('dev', { tp: [POND.x + POND.rx + 2, POND.z] });
await act('fish', { action: 'cast' });
await waitFor(() => me().fishing === 1, 'a pond cast');
check(room.self.fishing?.water === 'pond', 'the pond can be fished too');
await act('dev', { tp: [0, -48] });
await waitFor(() => me().fishing === 0, 'the line reeled in');
check(true, 'walking away reels the line in');

await room.leave(true);
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
