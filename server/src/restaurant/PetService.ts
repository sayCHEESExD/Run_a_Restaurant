import {
  EQUIP_LIMIT,
  MessageType,
  PERK_TEXT,
  PET_LIMIT,
  PET_MERCHANT,
  RANKS,
  WALK_SPEED,
  eggById,
  formatPrice,
  petBonus,
  petById,
  weightedPick,
  type HatchMessage,
  type PetPerk,
} from '@restaurant/shared';
import { addCash, spendCash, spendDiamonds, type Chef } from './Chef.js';
import type { RoomContext } from './RoomContext.js';

/** How close to the Pet Merchant's counter a purchase may be made from. */
const MERCHANT_REACH = 12;

/**
 * PETS: hatching eggs at the Pet Merchant (the odds are the egg's, the roll
 * is the server's), equipping up to three, and selling. What the equipped
 * pets do - tips, cooking, walking, XP, rare customers, fishing luck - is
 * read through `bonus` wherever it applies.
 */
export class PetService {
  constructor(private readonly ctx: RoomContext) {}

  /** The equipped pets' types. */
  equippedTypes(chef: Chef): number[] {
    return chef.profile.petsEquipped.map((uid) => chef.profile.pets.find((p) => p.uid === uid)?.type ?? 0).filter((t) => t > 0);
  }

  bonus(chef: Chef | null | undefined, perk: PetPerk): number {
    return chef ? petBonus(this.equippedTypes(chef), perk) : 0;
  }

  /** Show the followers and apply the walk-speed perk. */
  sync(chef: Chef): void {
    chef.player.pets = this.equippedTypes(chef).join(',');
    chef.player.moveSpeed = WALK_SPEED * (1 + this.bonus(chef, 'speed'));
    chef.dirty = true;
  }

  buy(chef: Chef, eggId: number): void {
    const egg = eggById(Math.floor(eggId));
    if (!egg) return;
    const p = chef.player;
    if (Math.hypot(p.x - PET_MERCHANT.x, p.z - PET_MERCHANT.z) > MERCHANT_REACH) return this.ctx.notify(chef, 'bad', 'Visit the Pet Merchant in the plaza to buy an egg.');
    if (chef.player.rank < egg.rank) return this.ctx.notify(chef, 'bad', `The ${egg.name} needs ${RANKS[egg.rank]!.name} rank.`);
    if (chef.profile.pets.length >= PET_LIMIT) return this.ctx.notify(chef, 'bad', `Your pet inventory is full (${PET_LIMIT}). Sell a pet first.`);
    const paid = egg.diamonds ? spendDiamonds(chef, egg.diamonds) : spendCash(chef, egg.price);
    if (!paid) return this.ctx.notify(chef, 'bad', egg.diamonds ? `The ${egg.name} costs ${egg.diamonds} Diamonds.` : `The ${egg.name} costs $${formatPrice(egg.price)}.`);
    const type = weightedPick(this.ctx.random, egg.odds);
    const uid = chef.profile.nextPetUid;
    chef.profile.nextPetUid += 1;
    chef.profile.pets.push({ uid, type });
    // A first pet goes straight to your side.
    if (chef.profile.petsEquipped.length < EQUIP_LIMIT) chef.profile.petsEquipped.push(uid);
    this.sync(chef);
    this.ctx.send(chef, MessageType.Hatch, { pet: type, uid, egg: egg.id } satisfies HatchMessage);
    this.ctx.fx({ kind: 'confetti', slot: -1, x: p.x, z: p.z });
  }

  equip(chef: Chef, uid: number, on: boolean): void {
    const pet = chef.profile.pets.find((x) => x.uid === Math.floor(uid));
    if (!pet) return;
    const list = chef.profile.petsEquipped;
    const at = list.indexOf(pet.uid);
    if (on && at < 0) {
      if (list.length >= EQUIP_LIMIT) return this.ctx.notify(chef, 'bad', `You can take ${EQUIP_LIMIT} pets along at once. Unequip one first.`);
      list.push(pet.uid);
    }
    if (!on && at >= 0) list.splice(at, 1);
    this.sync(chef);
  }

  sell(chef: Chef, uid: number): void {
    const at = chef.profile.pets.findIndex((x) => x.uid === Math.floor(uid));
    if (at < 0) return;
    const def = petById(chef.profile.pets[at]!.type)!;
    chef.profile.pets.splice(at, 1);
    chef.profile.petsEquipped = chef.profile.petsEquipped.filter((x) => x !== Math.floor(uid));
    addCash(chef, def.sell, false);
    this.sync(chef);
    this.ctx.notify(chef, 'good', `Sold your ${def.name} for $${formatPrice(def.sell)}.`);
  }

  /** Describe a pet's perk ("+12% tips"). */
  static perkLine(type: number): string {
    const def = petById(type);
    return def ? `+${Math.round(def.value * 100)}% ${PERK_TEXT[def.perk]}` : '';
  }
}
