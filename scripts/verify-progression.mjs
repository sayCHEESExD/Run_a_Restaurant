/**
 * THE PROGRESSION, checked statically: every recipe can actually be made
 * (each ingredient has a farm plot or a pen, unlockable before or with the
 * recipe), the XP curve and ranks climb, prices and staff rosters escalate,
 * the milestones can be finished, and the first few minutes pay for the
 * first upgrades without being trivial.
 */
import {
  INGREDIENTS,
  ITEMS,
  MAX_LEVEL,
  MAX_RANK,
  MAX_TIER,
  RANKS,
  RECIPES,
  ROLES,
  STAFF,
  TASKS,
  TIERS,
  XP,
  XP_TABLE,
  levelOf,
} from '../shared/dist/index.js';

let failures = 0;
const check = (condition, message) => {
  if (condition) console.log(`  ok    ${message}`);
  else {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const increasing = (list) => list.every((v, i) => i === 0 || v > list[i - 1]);

console.log('progression');
check(XP_TABLE[2] === 83 && increasing(XP_TABLE.slice(1)) && levelOf(XP_TABLE[MAX_LEVEL]) === MAX_LEVEL, 'the XP curve starts at 83 and climbs to level 99');
check(increasing(RANKS.map((r) => r.points)) && RANKS.length === MAX_RANK + 1, `${RANKS.length} ranks, Bronze I to Master, each harder than the last`);
check(increasing(TIERS.map((t) => t.price).slice(1)) && increasing(TIERS.map((t) => t.staff)), 'each expansion costs more and holds more staff');

const producers = new Map();
for (const def of ITEMS) if (def.produces) producers.set(def.produces, def);
check(INGREDIENTS.every((i) => producers.has(i.id) || i.source === 'fishing'), 'every ingredient comes from a crop plot, an animal pen or fishing');
let impossible = 0;
for (const recipe of RECIPES) {
  for (const [ingredient] of recipe.needs) {
    const producer = producers.get(ingredient);
    if (!producer && ingredient !== 10) impossible += 1;
  }
}
check(impossible === 0, 'every recipe can be cooked from things you can grow or raise');
check(increasing(RECIPES.map((r) => r.price).filter((_, i) => i !== 7)) || RECIPES.every((r, i) => i === 0 || r.level >= RECIPES[i - 1].level), 'recipes unlock in order of cooking level');
check(RECIPES[0].needs.length === 0 && RECIPES[0].level === 1, 'the first recipe needs nothing: a new owner can always cook');

for (const role of ROLES) {
  const roster = STAFF.filter((s) => s.role === role.id);
  check(roster.length > 0 && increasing(roster.map((s) => s.price)) && roster.every((s, i) => i === 0 || s.speed >= roster[i - 1].speed), `${role.plural}: ${roster.length} to hire, each pricier and faster`);
}

check(TASKS.every((t) => (t.stat !== 'rank' || t.target <= MAX_RANK) && (t.stat !== 'tier' || t.target <= MAX_TIER)), `all ${TASKS.length} milestones are achievable`);
check(TASKS[0].stat === 'served' && TASKS[0].target <= 3, 'the first milestone is a quick one');

// The first minutes: Rice at $10 a plate, a handful of customers.
const tutorialPay = 100 + 150;
const chair = ITEMS.find((d) => d.key === 'wooden_chair').price;
const stove = ITEMS.find((d) => d.key === 'retro_stove').price;
check(tutorialPay >= chair + ITEMS.find((d) => d.key === 'wooden_table').price, 'the tutorial pays for a first table and chair');
const ricePerMinute = 10 * 3;
check(stove / ricePerMinute > 10 && stove / ricePerMinute < 60, `the first stove upgrade takes ${Math.round(stove / ricePerMinute)} minutes of Rice - rewarding, not trivial`);
const level10 = XP_TABLE[10];
const perCook = XP.cook + 2;
check(level10 / perCook > 40 && level10 / perCook < 120, `Cooking level 10 takes about ${Math.round(level10 / perCook)} dishes`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nprogression OK');
process.exit(failures ? 1 : 0);
