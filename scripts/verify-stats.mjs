/**
 * BLOXITY STAT REPORTING, checked against a mock Bloxity API (no network, no
 * game server): the built `server/dist/bloxity/statReporter.js` is pointed at a
 * local HTTP server that records what it is sent.
 *
 * Checks: a no-op without the environment; definitions on every call; guests
 * skipped; `legion_` identities with any `#m` mode suffix stripped; values
 * that are not finite, negative or over the ceiling omitted (never clamped);
 * batches of 200; departed players reported once; a failing endpoint never
 * throws.
 *
 * Usage: npm run verify:stats
 */
import { createServer } from 'node:http';

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};

// ------------------------------------------------------------ mock Bloxity
const received = [];
let status = 200;
const mock = createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    received.push({ url: request.url, auth: request.headers.authorization, body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') });
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: status === 200, accepted: 1, dropped: {} }));
  });
});
await new Promise((resolve) => mock.listen(0, '127.0.0.1', resolve));
const port = mock.address().port;

const { installStatReporter, statRegistry, rowsOf, STAT_DEFINITIONS } = await import('../server/dist/bloxity/statReporter.js');

/** A server-side chef, as the room holds it. */
const chef = (key, overrides = {}) => ({
  key,
  player: { rank: 2 },
  restaurant: null,
  profile: {
    cash: 1234.7,
    earned: 50_000,
    served: 321,
    rankPoints: 900,
    xp: [0, 5000, 0, 0, 0, 0],
    counters: { rare: 4, fish: 9 },
    pets: [{ uid: 1, type: 2 }],
    bestFish: { fish: 7, weight: 3.456 },
    restaurant: { tier: 1, likes: 6, staff: [{}, {}] },
    ...overrides,
  },
});

console.log('stat reporting');
delete process.env.BLOXITY_REPORT_TOKEN;
const inert = installStatReporter();
await inert.flush();
check(received.length === 0, 'without the environment nothing is sent');

process.env.BLOXITY_REPORT_TOKEN = 'test-token';
process.env.BLOXITY_GAME_ID = 'run-a-restaurant';
process.env.BLOXITY_API_URL = `http://127.0.0.1:${port}/`;
const reporter = installStatReporter();

const chefs = [
  chef('guest:abc123'),
  chef('bloxity:64f0c0ffee0000000000aaaa'),
  chef('bloxity:64f0c0ffee0000000000bbbb#m2'),
  chef('bloxity:legion_64f0c0ffee0000000000cccc', { cash: Number.NaN, earned: -5, served: 2_000_000_000 }),
];
const stop = statRegistry.addSource(() => rowsOf(chefs));
await reporter.flush();
check(received.length === 1, 'one request for a handful of players');
const first = received[0];
check(first.url === '/v1/games/run-a-restaurant/stats', `posted to /v1/games/<id>/stats (${first.url})`);
check(first.auth === 'Bearer test-token', 'authorised with the report token');
check(Array.isArray(first.body.definitions) && first.body.definitions.length === STAT_DEFINITIONS.length, 'the definitions go with every call');
check(first.body.definitions.every((d) => /^[a-z0-9_]{1,32}$/.test(d.key) && d.label.length <= 40), 'every key and label fits Bloxity\'s rules');
const ids = first.body.players.map((p) => p.userId).sort();
check(!ids.some((id) => id.includes('guest')), 'guests are skipped');
check(ids.includes('legion_64f0c0ffee0000000000aaaa') && ids.includes('legion_64f0c0ffee0000000000bbbb'), `accounts are reported as legion_<id>, mode suffix stripped (${ids.join(', ')})`);
check(ids.includes('legion_64f0c0ffee0000000000cccc') && !ids.some((id) => id.startsWith('legion_legion_')), 'an id already prefixed is not prefixed twice');
const a = first.body.players.find((p) => p.userId.endsWith('aaaa')).values;
check(a.cash === 1234 && a.customers_served === 321 && a.restaurant_rank === 3 && a.cooking_level >= 1 && a.biggest_fish_kg === 3.46 && a.staff_hired === 2, 'values come from the server\'s own profile');
const c = first.body.players.find((p) => p.userId.endsWith('cccc')).values;
check(!('cash' in c) && !('total_earned' in c) && !('customers_served' in c) && c.fish_caught === 9, 'NaN, negative and over-ceiling values are omitted, the rest still sent');

// Departing players are reported once more, then not again.
received.length = 0;
statRegistry.depart(chef('bloxity:64f0c0ffee0000000000dddd'));
await reporter.flush();
check(received[0]?.body.players.some((p) => p.userId === 'legion_64f0c0ffee0000000000dddd'), 'a player who left is reported on the next flush');
received.length = 0;
await reporter.flush();
check(!received[0]?.body.players.some((p) => p.userId.endsWith('dddd')), '...and only once');
stop();

// Batching at 200.
received.length = 0;
const crowd = Array.from({ length: 450 }, (_, i) => chef(`bloxity:user${String(i).padStart(4, '0')}`));
const stopCrowd = statRegistry.addSource(() => rowsOf(crowd));
await reporter.flush();
check(received.length === 3 && received.every((r) => r.body.players.length <= 200), `450 players go in ${received.length} requests of at most 200`);
stopCrowd();

// A failing endpoint is logged, never thrown.
status = 500;
const stopOne = statRegistry.addSource(() => rowsOf([chef('bloxity:x1')]));
let threw = false;
try {
  await reporter.flush();
} catch {
  threw = true;
}
check(!threw, 'a failing endpoint does not throw');
mock.close();
let threwOffline = false;
try {
  await reporter.flush();
} catch {
  threwOffline = true;
}
check(!threwOffline, 'an unreachable endpoint does not throw');
stopOne();
reporter.stop();

console.log(failures ? `\n${failures} check(s) FAILED` : '\nstats OK');
process.exit(failures ? 1 : 0);
