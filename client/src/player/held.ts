import { CARRY } from '@restaurant/shared';
import type { Object3D } from 'three';
import { buildDirtyDish, buildDish, buildTicket } from '../models/food.js';
import { buildRod } from '../models/pets.js';
import { PartBuilder } from '../render/PartBuilder.js';

/** Builds the model for what a character carries. */
export type HeldModelFactory = (kind: number, recipe: number) => Object3D | null;

/** A key that changes exactly when the carried model would. */
export const heldKeyOf = (kind: number, recipe: number): string => (kind === CARRY.none ? '' : `${kind}:${kind === CARRY.plate || kind === CARRY.ticket ? recipe : 0}`);

/** A fishing rod in hand, angled out over the water. */
export const buildHeldRod = (): Object3D => {
  const b = new PartBuilder();
  buildRod(b, 0x9a6a3a);
  const group = b.build('held-rod', false);
  group.rotation.set(1.1, 0, 0);
  group.position.y -= 0.4;
  return group;
};

/** The thing in someone's hands: a ticket, a plate of food, a dirty dish. */
export const buildHeldModel: HeldModelFactory = (kind, recipe) => {
  const b = new PartBuilder();
  if (kind === CARRY.ticket) buildTicket(b);
  else if (kind === CARRY.plate) buildDish(b, recipe);
  else if (kind === CARRY.dish) buildDirtyDish(b);
  else return null;
  const group = b.build('held', false);
  // Plates ride flat on the palm, in front of the hand; the ticket is held up to read.
  if (kind === CARRY.ticket) {
    group.scale.setScalar(0.9);
    group.rotation.set(0, Math.PI / 2, 0);
  } else {
    group.scale.setScalar(1.1);
    group.rotation.set(Math.PI / 2, 0, 0);
    group.position.y -= 0.1;
  }
  return group;
};
