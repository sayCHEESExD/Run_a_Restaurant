import {
  BOOSTS,
  DAILY_DIAMONDS,
  MessageType,
  RANKS,
  RANK_UP_DIAMONDS,
  RECIPES,
  SKILL,
  SKILLS,
  TASKS,
  itemById,
  levelOf,
  qualityOf,
  rankOf,
  rankPoints,
  type LevelUpMessage,
  type RankBreakdown,
  type RankUpMessage,
  type StatKey,
} from '@restaurant/shared';
import { addCash, addDiamonds, spendDiamonds, type Chef } from './Chef.js';
import type { RoomContext } from './RoomContext.js';

/** Days since the epoch (UTC), for the daily Diamonds and daily likes. */
export const dayNumber = (ms: number): number => Math.floor(ms / 86_400_000);

/**
 * PROGRESSION: skill XP and level-ups, the restaurant's rank (and its
 * rank-up rewards), the milestone chain, premium boosts and the daily gift.
 */
export class Progress {
  constructor(private readonly ctx: RoomContext) {}

  /** Grant skill XP; a level-up is announced and the rank refreshed. */
  xp(chef: Chef, skill: number, amount: number): void {
    if (!(amount > 0) || skill < 0 || skill >= SKILLS.length) return;
    const before = levelOf(chef.profile.xp[skill] ?? 0);
    chef.profile.xp[skill] = Math.min(2e9, (chef.profile.xp[skill] ?? 0) + amount * (1 + this.ctx.perk(chef, 'xp')));
    chef.dirty = true;
    const after = levelOf(chef.profile.xp[skill]!);
    if (after > before) {
      this.ctx.send(chef, MessageType.LevelUp, { skill, level: after } satisfies LevelUpMessage);
      this.refreshRank(chef);
    }
  }

  /** The rank's parts, from the restaurant as it stands. */
  breakdown(chef: Chef): RankBreakdown {
    const r = chef.restaurant;
    let quality = 0;
    if (r) quality = qualityOf(r.contents).quality;
    const styleQuality = (itemById(r?.state.floor ?? 0)?.quality ?? 0) + (itemById(r?.state.wall ?? 0)?.quality ?? 0);
    const levels = SKILLS.reduce((sum, skill) => sum + (skill.rank <= chef.profile.bestRank ? levelOf(chef.profile.xp[skill.index] ?? 0) : 0), 0);
    return rankPoints(quality + styleQuality, levels, chef.profile.served, r?.state.tier ?? chef.profile.restaurant.tier);
  }

  /** Recompute the rank; a new best pays Diamonds and is announced. */
  refreshRank(chef: Chef): void {
    const points = this.breakdown(chef).total;
    const rank = rankOf(points);
    chef.profile.rankPoints = points;
    chef.player.rank = rank;
    const r = chef.restaurant;
    if (r) {
      r.state.rankPoints = points;
      r.state.rank = rank;
    }
    if (rank > chef.profile.bestRank) {
      const gained = rank - chef.profile.bestRank;
      chef.profile.bestRank = rank;
      addDiamonds(chef, RANK_UP_DIAMONDS * gained);
      this.ctx.send(chef, MessageType.RankUp, { rank } satisfies RankUpMessage);
      this.ctx.notify(chef, 'gold', `Your restaurant reached ${RANKS[rank]!.name}! +${RANK_UP_DIAMONDS * gained} Diamonds`);
      if (r) this.ctx.fx({ kind: 'confetti', slot: r.slot.index, x: -18, z: 2 });
    }
    chef.dirty = true;
  }

  /** The lifetime figures the milestones read. */
  stats(chef: Chef): Record<StatKey, number> {
    const p = chef.profile;
    const level = (skill: number): number => levelOf(p.xp[skill] ?? 0);
    let placed = 0;
    chef.restaurant?.state.items.forEach(() => {
      placed += 1;
    });
    const cooking = level(SKILL.cooking);
    return {
      served: p.served,
      earned: Math.floor(p.earned),
      placed,
      rank: chef.player.rank,
      cooking,
      service: level(SKILL.service),
      cleaning: level(SKILL.cleaning),
      farming: level(SKILL.farming),
      ranching: level(SKILL.ranching),
      hired: p.restaurant.staff.length,
      harvested: p.counters.harvested,
      collected: p.counters.collected,
      tier: chef.restaurant?.state.tier ?? p.restaurant.tier,
      recipes: RECIPES.filter((recipe) => recipe.level <= cooking).length,
      washed: p.counters.washed,
      rare: p.counters.rare,
      fish: p.counters.fish,
      pets: p.pets.length,
      fishing: level(SKILL.fishing),
    };
  }

  claimTask(chef: Chef): void {
    const task = TASKS[chef.profile.task];
    if (!task) {
      this.ctx.notify(chef, 'info', 'You have finished every milestone!');
      return;
    }
    const value = this.stats(chef)[task.stat];
    if (value < task.target) {
      this.ctx.notify(chef, 'bad', `Not yet: ${task.text} (${Math.min(value, task.target)}/${task.target})`);
      return;
    }
    chef.profile.task += 1;
    if (task.cash > 0) addCash(chef, task.cash, false);
    if (task.diamonds > 0) addDiamonds(chef, task.diamonds);
    const prize = [task.cash > 0 ? `$${task.cash.toLocaleString('en-US')}` : '', task.diamonds > 0 ? `${task.diamonds} Diamonds` : ''].filter(Boolean).join(' + ');
    this.ctx.notify(chef, 'gold', `Milestone complete! ${prize}`);
    chef.dirty = true;
  }

  boost(chef: Chef, id: string): void {
    const def = BOOSTS.find((b) => b.id === id);
    if (!def) return;
    if (!spendDiamonds(chef, def.diamonds)) {
      this.ctx.notify(chef, 'bad', `${def.name} costs ${def.diamonds} Diamonds.`);
      return;
    }
    const now = this.ctx.now();
    const boosts = chef.profile.boosts;
    boosts[def.id] = Math.max(boosts[def.id], now) + def.minutes * 60_000;
    this.ctx.notify(chef, 'gold', `${def.name} active for ${def.minutes} minutes!`);
    chef.dirty = true;
  }

  claimDaily(chef: Chef): void {
    const today = dayNumber(this.ctx.now());
    if (chef.profile.dailyDay === today) {
      this.ctx.notify(chef, 'info', 'You already claimed today\'s Diamonds. Come back tomorrow!');
      return;
    }
    chef.profile.dailyDay = today;
    addDiamonds(chef, DAILY_DIAMONDS);
    this.ctx.notify(chef, 'gold', `Daily reward: +${DAILY_DIAMONDS} Diamonds!`);
  }
}
