/**
 * THE CORE LOOP, played by bots against a RUNNING dev server (npm run dev).
 *
 * A brand-new owner plays the whole tutorial through the real verbs - walk
 * in, place a table and chairs, seat the first customer, take the order, grab
 * the ticket, cook, grab the plate, serve, clear and wash the dish, collect
 * the cash, visit the Shop, buy, place - and every step is checked in what the
 * server sends back. Walking is done with the dev server's teleport (the only
 * cheat used for the tutorial). Then: a visitor cannot act in someone else's
 * restaurant, progress survives a rejoin, and hired staff run the restaurant
 * on their own.
 *
 * Usage: start the server (npm run dev), then `npm run verify:loop`.
 */
import { Client } from 'colyseus.js';
import { PHASE, ROOM_NAME, STAGE, TUTORIAL, PLOT_SLOTS, SHOP, toWorld, DISPLAYS } from '../shared/dist/index.js';

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
    await sleep(50);
  }
};

const join = async (playerId, name) => {
  const client = new Client(ENDPOINT);
  const room = await client.joinOrCreate(ROOM_NAME, { playerId, identity: { displayName: name, avatarUrl: '' } });
  room.self = null;
  room.notices = [];
  room.away = null;
  room.onMessage('self', (m) => {
    room.self = m;
  });
  room.onMessage('notice', (m) => room.notices.push(m.text));
  room.onMessage('away', (m) => {
    room.away = m;
  });
  for (const type of ['fx', 'respawn', 'authState', 'levelUp', 'rankUp']) room.onMessage(type, () => {});
  await waitFor(() => room.self && room.state.players.get(room.sessionId)?.slot >= 0, 'own state');
  return room;
};
const me = (room) => room.state.players.get(room.sessionId);
const slotOf = (room) => PLOT_SLOTS[me(room).slot];
const restaurantOf = (room) => room.state.restaurants[me(room).slot];
const items = (room) => [...restaurantOf(room).items.values()];
const customers = (room) => [...restaurantOf(room).customers.values()];
const orders = (room) => [...restaurantOf(room).orders.values()];
/** Actions are rate limited per player: space them out. */
const act = async (room, type, message = {}) => {
  room.send(type, message);
  await sleep(140);
};
/** Teleport to a plot-local point of the bot's own restaurant (dev cheat). */
const goLocal = async (room, lx, lz) => {
  const at = toWorld(slotOf(room), lx, lz);
  await act(room, 'dev', { tp: [at.x, at.z] });
  await sleep(120);
};
const verb = (room, v, id = 0) => act(room, 'act', { verb: v, id });
const byKey = (room, kind) => items(room).find((i) => i.kind === kind);

console.log(`core loop (${ENDPOINT})`);
const tag = Date.now().toString(36);
const a = await join(`loop-a-${tag}`, 'LoopA');
check(a.self.cash === 0 && a.self.tutorial === TUTORIAL.enter, 'a new owner starts with $0 and the tutorial');
check(restaurantOf(a).owner === a.sessionId, `they are given a restaurant (plot ${me(a).slot})`);
check(items(a).length === 11, `the starter restaurant is laid out (${items(a).length} items)`);
check(a.self.inventory.some((s) => s.id === 3) && a.self.inventory.some((s) => s.id === 1 && s.count === 2), 'their Items hold a table and two chairs');

await goLocal(a, -20, 16);
await waitFor(() => a.self.tutorial === TUTORIAL.place, 'tutorial: entered');
check(true, 'walking inside moves the tutorial on');

await act(a, 'place', { kind: 3, x: -14.5, z: 13.5, rot: 0 });
await act(a, 'place', { kind: 1, x: -17, z: 13.5, rot: 3 });
await act(a, 'place', { kind: 1, x: -12, z: 13.5, rot: 1 });
await waitFor(() => a.self.tutorial === TUTORIAL.seat, 'tutorial: placed');
check(items(a).length === 14, 'the table and both chairs are placed');
await act(a, 'place', { kind: 3, x: -25.5, z: 11.5, rot: 0 });
check(a.notices.some((t) => t.includes('no Wooden Table')), 'placing an item you do not own is refused');

const guest = await waitFor(() => customers(a).find((c) => c.phase === PHASE.queued), 'the tutorial customer queues');
check(true, `the tutorial customer arrives and waits at the door (id ${guest.id})`);
await goLocal(a, -18, 10);
await verb(a, 'seat', guest.id);
await waitFor(() => a.self.tutorial === TUTORIAL.order, 'tutorial: seated');
const seated = await waitFor(() => customers(a).find((c) => c.id === guest.id && c.phase === PHASE.ready), 'customer ready to order', 20_000);
const chair = items(a).find((i) => i.id === seated.seat);
check(!!chair, 'they walked to a chair and are ready to order');
await goLocal(a, chair.x, chair.z - 2.2);
await verb(a, 'order', guest.id);
await waitFor(() => a.self.tutorial === TUTORIAL.ticket, 'tutorial: ordered');
check(orders(a).length === 1 && orders(a)[0].stage === STAGE.posted && orders(a)[0].recipe === 1, 'the order (Rice) goes up on the stand');

const stand = byKey(a, 32);
const stove = byKey(a, 20);
const sink = byKey(a, 29);
const register = byKey(a, 34);
await goLocal(a, stove.x, stove.z - 2);
await verb(a, 'cook', stove.id);
check(a.notices.some((t) => t.includes('Grab a ticket')), 'cooking with no ticket is refused');
await goLocal(a, stand.x, stand.z - 2);
await verb(a, 'ticket', stand.id);
await waitFor(() => a.self.carry.kind === 1, 'carrying the ticket');
check(me(a).carryKind === 1, 'the ticket is in their hands (and everyone sees it)');
await goLocal(a, stove.x, stove.z - 2);
await verb(a, 'cook', stove.id);
await waitFor(() => a.self.tutorial === TUTORIAL.plate, 'tutorial: cooking');
check(items(a).find((i) => i.id === stove.id).c !== 0, 'the stove is cooking');
await waitFor(() => orders(a)[0]?.stage === STAGE.ready, 'the rice is ready', 10_000);
check(true, 'the finished plate comes out on the order stand');
await goLocal(a, stand.x, stand.z - 2);
await verb(a, 'plate', stand.id);
await waitFor(() => a.self.carry.kind === 2, 'carrying the plate');
await goLocal(a, chair.x, chair.z - 2.2);
await verb(a, 'serve', guest.id);
await waitFor(() => a.self.tutorial === TUTORIAL.dish, 'tutorial: served');
check(customers(a).find((c) => c.id === guest.id)?.phase === PHASE.eating, 'the customer eats');
await waitFor(() => items(a).find((i) => i.id === chair.id).b === 1, 'the dirty dish', 15_000);
check(restaurantOf(a).register === 100, `they pay $100 into the register (${restaurantOf(a).register})`);
await verb(a, 'dish', chair.id);
await waitFor(() => a.self.carry.kind === 3, 'carrying the dish');
await goLocal(a, sink.x, sink.z - 2);
await verb(a, 'wash', sink.id);
await waitFor(() => a.self.tutorial === TUTORIAL.cash, 'tutorial: washing');
check(items(a).find((i) => i.id === sink.id).b === 1, 'the dish is in the sink');
await goLocal(a, register.x - 2.2, register.z);
await verb(a, 'cash', register.id);
await waitFor(() => a.self.tutorial === TUTORIAL.shop, 'tutorial: cash');
check(a.self.cash === 100, `collecting the register pays $100 (${a.self.cash})`);

await act(a, 'dev', { tp: [SHOP.keeper.x, SHOP.keeper.z - 5] });
await waitFor(() => a.self.tutorial === TUTORIAL.buy, 'tutorial: in the shop');
check(true, 'entering the Shop moves the tutorial on');
await act(a, 'buy', { id: 1, count: 1 });
await waitFor(() => a.self.tutorial === TUTORIAL.placeNew, 'tutorial: bought');
check(a.self.cash === 50 && a.self.inventory.some((s) => s.id === 1), 'buying a Wooden Chair from the keeper costs $50');
const plinth = DISPLAYS.find((d) => d.item === 2);
await act(a, 'dev', { tp: [plinth.x, plinth.z - 3] });
await act(a, 'buy', { id: 2, count: 1 });
await waitFor(() => a.self.inventory.some((s) => s.id === 2), 'bought from the plinth');
check(true, 'buying straight off a display plinth works too');
await act(a, 'dev', { tp: [0, -40] });
await act(a, 'buy', { id: 1, count: 1 });
check(a.notices.some((t) => t.includes('Walk up')), 'buying away from the Shop is refused');
await act(a, 'teleport', { to: 'home' });
await sleep(200);
await act(a, 'place', { kind: 1, x: -14.5, z: 16, rot: 2 });
await waitFor(() => a.self.tutorial === TUTORIAL.done, 'tutorial: done');
check(a.self.cash === 150, `the tutorial finishes with a $150 bonus (${a.self.cash})`);

await act(a, 'place', { kind: 2, x: -25.5, z: 11.5, rot: 0 });
check(a.notices.some((t) => t.includes('overlaps')), 'an overlapping placement is refused');

// -------------------------------------------------------------- visitors
console.log('visiting');
const b = await join(`loop-b-${tag}`, 'LoopB');
check(me(b).slot !== me(a).slot, 'a second owner gets another plot');
await act(b, 'teleport', { to: `visit:${me(a).slot}` });
await sleep(250);
const before = items(a).length;
await act(b, 'pickup', { id: stove.id });
await act(b, 'act', { verb: 'cash', id: register.id });
check(items(a).length === before && b.self.cash === 0, "a visitor cannot pick up or collect in someone else's restaurant");
await act(b, 'like', { slot: me(a).slot });
await waitFor(() => restaurantOf(a).likes === 1, 'the like');
check(true, 'a visitor can like the restaurant');

// ---------------------------------------------------------- persistence
console.log('persistence');
const cashBefore = a.self.cash;
const placedBefore = items(a).length;
await a.leave(true);
await sleep(600);
const a2 = await join(`loop-a-${tag}`, 'LoopA');
check(a2.self.cash === cashBefore && a2.self.tutorial === TUTORIAL.done, `cash and tutorial survive a rejoin ($${a2.self.cash})`);
check(items(a2).length === placedBefore, `the restaurant layout survives (${items(a2).length} items)`);

// ---------------------------------------------------------------- staff
console.log('staff');
await act(a2, 'dev', { cash: 50_000, xp: 1200 });
await waitFor(() => me(a2).rank >= 1, 'rank Bronze II');
await act(a2, 'hire', { staff: 1 });
await act(a2, 'hire', { staff: 11 });
await act(a2, 'hire', { staff: 21 });
await waitFor(() => restaurantOf(a2).staff.size === 3, 'three staff', 5000).catch(() => null);
check(restaurantOf(a2).staff.size >= 2, `staff are hired and appear (${restaurantOf(a2).staff.size})`);
await act(a2, 'teleport', { to: 'boards' });
const servedBefore = a2.self.served;
await act(a2, 'dev', { customer: 2 });
await act(a2, 'dev', { customer: 3 });
await waitFor(() => a2.self.served >= servedBefore + 2, 'staff serve two customers on their own', 90_000);
check(true, `staff seated, cooked and served on their own (served ${a2.self.served - servedBefore})`);
await sleep(8000);
const dirty = items(a2).filter((i) => i.kind <= 13 && i.b === 1).length;
check(dirty === 0, `the cleaner cleared the dishes (${dirty} dirty)`);

await a2.leave(true);
await b.leave(true);
console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
