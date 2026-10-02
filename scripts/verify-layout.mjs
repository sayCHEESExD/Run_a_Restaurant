/**
 * THE TOWN AND THE PLOTS, checked statically (no server needed):
 *
 *   - the fifteen plots never overlap each other, the plaza, the ring road,
 *     the Shop or a town building, and stay on dry land;
 *   - the grandest building and both yards fit inside every plot;
 *   - the starter restaurant is legal, has its two seats, and a customer can
 *     walk from the street to every seat and appliance;
 *   - no tree stands on a plot, the plaza or a road;
 *   - every placeable item has a display plinth in the Shop;
 *   - the spawn and every named place are clear of solids.
 */
import {
  BUILDING,
  DISPLAYS,
  FARM,
  ITEMS,
  LAND_HALF,
  MAX_TIER,
  PLACES,
  PLAZA_HALF,
  PLOT,
  PLOT_SLOTS,
  RANCH,
  RING_OUT,
  SHOP,
  STARTER_LAYOUT,
  STREET_POINT,
  TOWN_BUILDINGS,
  TREES,
  WorldCollision,
  accessPoint,
  buildNav,
  findPath,
  interiorOf,
  placeProblem,
  plotAt,
  seatOf,
  toWorldBox,
} from '../shared/dist/index.js';

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

console.log('layout');
const plots = PLOT_SLOTS.map((slot) => toWorldBox(slot, { ...PLOT, minY: 0, maxY: 1 }));
let clash = 0;
for (let i = 0; i < plots.length; i += 1) for (let j = i + 1; j < plots.length; j += 1) if (overlaps(plots[i], plots[j])) clash += 1;
check(clash === 0 && plots.length === 15, `15 plots, none overlapping (${clash} clashes)`);
const ring = { minX: -RING_OUT, maxX: RING_OUT, minZ: -RING_OUT, maxZ: RING_OUT };
check(plots.every((p) => !overlaps(p, ring)), 'every plot lies outside the ring road');
check(plots.every((p) => Math.max(Math.abs(p.minX), Math.abs(p.maxX), Math.abs(p.minZ), Math.abs(p.maxZ)) < LAND_HALF), 'every plot is on dry land');
const town = TOWN_BUILDINGS.map((b) => ({ minX: b.x - b.hx, maxX: b.x + b.hx, minZ: b.z - b.hz, maxZ: b.z + b.hz }));
check(plots.every((p) => town.every((t) => !overlaps(p, t))), 'no plot overlaps a town building');
check(town.every((t) => !overlaps(t, { minX: -PLAZA_HALF, maxX: PLAZA_HALF, minZ: -PLAZA_HALF, maxZ: PLAZA_HALF })), 'the town buildings keep off the plaza');
check(SHOP.minX > -PLAZA_HALF && SHOP.maxX < PLAZA_HALF && SHOP.maxZ < PLAZA_HALF, 'the Shop stands inside the plaza');

const big = interiorOf(MAX_TIER);
const inside = (r) => r.minX - BUILDING.wall >= PLOT.minX && r.maxX + BUILDING.wall <= PLOT.maxX && r.minZ - BUILDING.wall >= PLOT.minZ && r.maxZ + BUILDING.wall <= PLOT.maxZ;
check(inside(big) && inside(FARM) && inside(RANCH), 'the Grand Restaurant and both yards fit the plot');
check(big.maxX + BUILDING.wall < FARM.minX && big.maxZ + BUILDING.wall < PLOT.maxZ, 'the biggest building clears the farm fence');

const items = [];
let id = 1;
const contents = { tier: 0, forEachItem: (visit) => items.forEach(visit) };
let illegal = 0;
for (const it of STARTER_LAYOUT) {
  if (placeProblem(contents, it.kind, it.x, it.z, it.rot)) illegal += 1;
  items.push({ id: id++, ...it });
}
check(illegal === 0, 'the starter restaurant is laid out legally');
const seats = items.filter((it) => seatOf(contents, it));
check(seats.length === 2, `the starter restaurant has two seats (${seats.length})`);
const nav = buildNav(0, items);
let unreachable = 0;
for (const it of items) {
  const def = ITEMS.find((d) => d.id === it.kind);
  if (!def || def.role === 'decor') continue;
  const target = def.role === 'chair' ? { x: it.x, z: it.z } : accessPoint(nav, it);
  if (!target || !findPath(nav, STREET_POINT, target)) unreachable += 1;
}
check(unreachable === 0, 'a customer can walk from the street to every seat and appliance');

check(TREES.every((t) => plotAt(t.x, t.z, 1) < 0), `no tree stands on a plot (${TREES.length} trees)`);
check(TREES.every((t) => Math.max(Math.abs(t.x), Math.abs(t.z)) > PLAZA_HALF), 'no tree stands on the plaza');

const placeable = ITEMS.filter((d) => d.zone !== 'none');
check(placeable.every((d) => DISPLAYS.some((s) => s.item === d.id)), `every placeable item is on a Shop plinth (${DISPLAYS.length})`);

const world = new WorldCollision();
check(Object.values(PLACES).every((p) => !world.occupied(p.x, p.z, 0.8)), 'the spawn and every named place are clear of solids');

console.log(failures ? `\n${failures} check(s) FAILED` : '\nlayout OK');
process.exit(failures ? 1 : 0);
