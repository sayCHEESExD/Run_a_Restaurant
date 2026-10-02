import {
  CARRY,
  FISHING,
  MessageType,
  RANKS,
  SKILL,
  SKILLS,
  XP,
  bestRod,
  castFrom,
  levelOf,
  rarityStep,
  rollFish,
  rollWeight,
  type CatchMessage,
} from '@restaurant/shared';
import { addDiamonds, addStack, stockFridge, type Chef } from './Chef.js';
import type { PetService } from './PetService.js';
import type { RoomContext } from './RoomContext.js';

/**
 * FISHING, server side: a cast is only made from the pier's end or the pond's
 * bank, with a rod owned. The bite comes at a time the server picks; reeling
 * in during the bite's short window lands a fish the server rolls (by water,
 * Fishing level, the rod and the pets' luck). Too early, too late, or walking
 * off with the line out, and it is gone.
 */
export class FishingService {
  constructor(
    private readonly ctx: RoomContext,
    private readonly pets: PetService,
  ) {}

  private level(chef: Chef): number {
    return levelOf(chef.profile.xp[SKILL.fishing] ?? 0);
  }

  private luck(chef: Chef, rod: number): number {
    return rod + this.level(chef) * 0.02 + this.pets.bonus(chef, 'fish') * 2;
  }

  cast(chef: Chef): void {
    if (chef.fishing) return;
    const unlock = SKILLS[SKILL.fishing]!.rank;
    if (chef.profile.bestRank < unlock) return this.ctx.notify(chef, 'bad', `Fishing unlocks at ${RANKS[unlock]!.name} rank.`);
    const rod = bestRod(chef.profile.styles);
    if (!rod) return this.ctx.notify(chef, 'bad', 'You need a fishing rod! Buy one in the Shop\'s Fishing section.');
    if (chef.carry.kind !== CARRY.none) return this.ctx.notify(chef, 'bad', 'Your hands are full!');
    const spot = castFrom(chef.player.x, chef.player.z);
    if (!spot) return this.ctx.notify(chef, 'bad', 'Fish from the end of the pier or at the park pond.');
    const now = this.ctx.now();
    const speed = rod.speed * (1 + this.level(chef) * 0.01);
    const wait = (FISHING.biteMin + this.ctx.random() * (FISHING.biteMax - FISHING.biteMin)) / speed;
    const biteAt = now + wait * 1000;
    chef.fishing = { state: 1, water: spot.water, x: chef.player.x, z: chef.player.z, biteAt, until: biteAt + FISHING.window * 1000 };
    chef.player.fishing = 1;
    chef.player.fishX = spot.x;
    chef.player.fishZ = spot.z;
    chef.dirty = true;
  }

  reel(chef: Chef): void {
    const line = chef.fishing;
    if (!line) return;
    const now = this.ctx.now();
    if (line.state !== 2 || now > line.until) {
      this.stop(chef);
      return this.ctx.notify(chef, 'bad', line.state === 1 ? 'Too early! The fish swam off.' : 'Too slow - it got away!');
    }
    this.stop(chef);
    const rod = bestRod(chef.profile.styles);
    const luck = this.luck(chef, rod?.luck ?? 0);
    const fish = rollFish(this.ctx.random, line.water, this.level(chef), luck);
    const weight = rollWeight(this.ctx.random, fish, luck);
    const stored = stockFridge(chef, 10, fish.yield);
    addStack(chef.profile.fishIndex, fish.id, 1);
    chef.profile.counters.fish += 1;
    const best = chef.profile.bestFish;
    const record = weight > best.weight;
    if (record) chef.profile.bestFish = { fish: fish.id, weight };
    if (fish.rarity === 'legendary') addDiamonds(chef, 2);
    this.ctx.xp(chef, SKILL.fishing, XP.fish + rarityStep(fish.rarity) * 8);
    chef.dirty = true;
    this.ctx.send(chef, MessageType.Catch, { fish: fish.id, weight, stored, record } satisfies CatchMessage);
    this.ctx.fx({ kind: 'sparkle', slot: -1, x: chef.player.fishX, z: chef.player.fishZ });
    if (stored < fish.yield) this.ctx.notify(chef, 'info', 'Your fridges are full - only some of the fish fit.');
  }

  stop(chef: Chef): void {
    if (!chef.fishing) return;
    chef.fishing = null;
    chef.player.fishing = 0;
    chef.dirty = true;
  }

  /** Bites come, bites go, and a line walked away from is reeled in. */
  tick(chef: Chef): void {
    const line = chef.fishing;
    if (!line) return;
    const now = this.ctx.now();
    if (Math.hypot(chef.player.x - line.x, chef.player.z - line.z) > FISHING.leash) {
      this.stop(chef);
      return;
    }
    if (line.state === 1 && now >= line.biteAt) {
      line.state = 2;
      chef.player.fishing = 2;
      chef.dirty = true;
    } else if (line.state === 2 && now > line.until) {
      this.stop(chef);
      this.ctx.notify(chef, 'bad', 'It got away! Reel in when the bobber dips.');
    }
  }
}
