import { Mesh, MeshStandardMaterial, type Group } from 'three';
import type { PartBuilder } from '../render/PartBuilder.js';
import { PartBuilder as Builder } from '../render/PartBuilder.js';
import { ball, block, cone, cylinder, dome, shade } from '../models/shapes.js';
import { paintOutfit, type NpcOutfit } from './NpcSkin.js';
import { PlayerCharacter } from './PlayerCharacter.js';
import { playerModelLoader } from './PlayerModelLoader.js';

/**
 * A RESTAURANT NPC: the Block City player model - the very same body and
 * skeleton every player wears - dressed for who they are. The outfit is
 * painted onto a copy of the body's atlas (`NpcSkin`, cached by outfit), and
 * a hat or helmet is built from blocks and worn on the head bone.
 */

export type Hat =
  | 'chef'
  | 'crown'
  | 'tricorn'
  | 'helmet'
  | 'wizard'
  | 'space'
  | 'laurel'
  | 'cap'
  | 'beanie'
  | 'beret'
  | 'straw'
  | 'visor'
  | 'bun'
  | 'none';

export interface NpcLook {
  readonly outfit: NpcOutfit;
  readonly hat: Hat;
  readonly hatColor: number;
  readonly trim?: number;
  readonly beard?: number;
  readonly glasses?: number;
}

/** Hats, built in the head's own frame: the head is a unit cube round the origin (y -0.5..0.5). */
const buildHat = (b: PartBuilder, look: NpcLook): void => {
  const c = look.hatColor;
  const trim = look.trim ?? 0xd8443a;
  switch (look.hat) {
    case 'chef':
      cylinder(b, 0.56, 0.56, 0.3, 0xffffff, { y: 0.62 }, 'smooth', 14);
      ball(b, 0.5, 0xffffff, { y: 0.98, sy: 0.75 }, 'smooth', 1);
      ball(b, 0.32, 0xf6f6f6, { x: 0.28, y: 1.05, sy: 0.8 }, 'smooth', 0);
      ball(b, 0.32, 0xf6f6f6, { x: -0.28, y: 1.05, sy: 0.8 }, 'smooth', 0);
      break;
    case 'crown':
      cylinder(b, 0.52, 0.5, 0.3, 0xffd23a, { y: 0.66 }, 'smooth', 12);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        cone(b, 0.12, 0.3, 0xffd23a, { x: Math.cos(a) * 0.45, y: 0.94, z: Math.sin(a) * 0.45 }, 'smooth', 4);
        ball(b, 0.06, [0xd8443a, 0x4a8aff, 0x5ad84a][i % 3]!, { x: Math.cos(a) * 0.51, y: 0.68, z: Math.sin(a) * 0.51 }, 'glow', 0);
      }
      break;
    case 'tricorn':
      cylinder(b, 0.95, 0.95, 0.1, c, { y: 0.56 }, 'smooth', 3);
      cylinder(b, 0.5, 0.56, 0.4, c, { y: 0.78 }, 'smooth', 12);
      block(b, 0.3, 0.2, 0.05, 0xffffff, { y: 0.8, z: 0.55 });
      block(b, 0.08, 0.08, 0.06, 0x1a1a1a, { x: -0.06, y: 0.82, z: 0.58 });
      block(b, 0.08, 0.08, 0.06, 0x1a1a1a, { x: 0.06, y: 0.82, z: 0.58 });
      break;
    case 'helmet':
      block(b, 1.16, 1.12, 1.16, 0xb8bec8, { y: 0.06 });
      block(b, 0.96, 0.12, 0.08, 0x2a2a2e, { y: 0.08, z: 0.59 });
      block(b, 0.14, 0.5, 0.06, 0x2a2a2e, { y: -0.12, z: 0.59 });
      block(b, 0.16, 0.6, 0.9, trim, { y: 0.78 });
      break;
    case 'wizard':
      cylinder(b, 1, 1, 0.08, c, { y: 0.52 }, 'smooth', 16);
      cone(b, 0.55, 1.5, c, { y: 1.3, rz: 0.12 }, 'smooth', 12);
      for (let i = 0; i < 4; i += 1) ball(b, 0.07, 0xffe066, { x: Math.cos(i * 1.7) * 0.35, y: 0.8 + i * 0.25, z: Math.sin(i * 1.7) * 0.35 }, 'glow', 0);
      break;
    case 'space':
      ball(b, 0.86, 0xd8f4ff, { y: 0.02 }, 'smooth', 2);
      cylinder(b, 0.7, 0.7, 0.2, 0xe8e8ee, { y: -0.6 }, 'smooth', 14);
      block(b, 0.5, 0.34, 0.06, 0xffb02a, { y: 0.05, z: 0.82 }, 'glow');
      break;
    case 'laurel':
      for (let i = 0; i < 10; i += 1) {
        const a = Math.PI * 0.15 + (i / 9) * Math.PI * 0.7;
        for (const side of [-1, 1]) block(b, 0.22, 0.1, 0.12, 0x6ad04a, { x: side * Math.cos(a) * 0.56, y: 0.44, z: -Math.sin(a) * 0.56 + 0.05, ry: side * a });
      }
      block(b, 1.1, 0.08, 1.1, 0xffd23a, { y: 0.4 });
      break;
    case 'cap':
      block(b, 1.08, 0.28, 1.08, c, { y: 0.46 });
      block(b, 0.9, 0.06, 0.55, shade(c, 0.85), { y: 0.36, z: 0.75 });
      ball(b, 0.08, trim, { y: 0.62 }, 'smooth', 0);
      break;
    case 'beanie':
      dome(b, 0.6, c, { y: 0.38 });
      cylinder(b, 0.6, 0.6, 0.18, shade(c, 0.85), { y: 0.38 }, 'smooth', 14);
      ball(b, 0.16, trim, { y: 0.98 }, 'smooth', 0);
      break;
    case 'beret':
      cylinder(b, 0.66, 0.6, 0.18, c, { y: 0.6, rz: 0.15 }, 'smooth', 14);
      ball(b, 0.06, shade(c, 0.7), { y: 0.72, x: 0.1 }, 'smooth', 0);
      break;
    case 'straw':
      cylinder(b, 1.05, 1.05, 0.08, c, { y: 0.5 }, 'smooth', 14);
      cylinder(b, 0.56, 0.6, 0.42, c, { y: 0.72 }, 'smooth', 14);
      cylinder(b, 0.61, 0.61, 0.12, trim, { y: 0.58 }, 'smooth', 14);
      break;
    case 'visor':
      block(b, 1.08, 0.24, 1.08, c, { y: 0.44 });
      block(b, 0.96, 0.06, 0.6, trim, { y: 0.38, z: 0.72 });
      break;
    case 'bun':
      ball(b, 0.32, c, { y: 0.66, z: -0.3 }, 'smooth', 1);
      block(b, 1.06, 0.2, 1.06, c, { y: 0.46 });
      break;
    case 'none':
      break;
  }
  if (look.beard !== undefined) {
    block(b, 0.9, 0.34, 0.2, look.beard, { y: -0.36, z: 0.5 });
    block(b, 0.6, 0.5, 0.18, look.beard, { y: -0.68, z: 0.46 });
    block(b, 0.5, 0.1, 0.1, shade(look.beard, 0.9), { y: -0.12, z: 0.56 });
  }
  if (look.glasses !== undefined) {
    for (const x of [-0.24, 0.24]) block(b, 0.34, 0.22, 0.05, look.glasses, { x, y: 0.08, z: 0.54 });
    block(b, 0.2, 0.05, 0.05, look.glasses, { y: 0.12, z: 0.54 });
  }
};

const materials = new Map<string, MeshStandardMaterial>();

/** One material per outfit, shared by every NPC wearing it. */
const materialFor = (outfit: NpcOutfit): MeshStandardMaterial => {
  const key = JSON.stringify(outfit);
  let material = materials.get(key);
  if (!material) {
    material = new MeshStandardMaterial({ roughness: 0.85, metalness: 0 });
    const atlas = playerModelLoader.atlasImage;
    if (atlas) material.map = paintOutfit(atlas, outfit);
    materials.set(key, material);
  }
  return material;
};

export class NpcCharacter {
  readonly character = new PlayerCharacter();

  constructor(readonly look: NpcLook) {
    const material = materialFor(look.outfit);
    this.character.body.model.traverse((child) => {
      if ((child as Mesh).isMesh) (child as Mesh).material = material;
    });
    if (look.hat !== 'none' || look.beard !== undefined || look.glasses !== undefined) {
      const hat = new Builder();
      buildHat(hat, look);
      this.character.wear(hat.build('npc-hat'), 'head');
    }
  }

  get root(): Group {
    return this.character.root;
  }

  update(delta: number): void {
    this.character.update(delta);
  }

  dispose(): void {
    this.character.dispose();
  }
}

// ------------------------------------------------------------ the cast

const SKIN = [0xf2c8a0, 0xe8b890, 0xc8905a, 0x8a5a3a, 0xf6d2b0, 0xb8784a] as const;

const outfit = (skin: number, hair: number, shirt: number, pants: number, shoes: number, details: NpcOutfit['details'] = [], sleeves?: number): NpcOutfit =>
  sleeves === undefined ? { skin, hair, shirt, pants, shoes, details } : { skin, hair, shirt, pants, shoes, details, sleeves };

/** Every customer type's look, by customer id. */
export const CUSTOMER_LOOKS: Readonly<Record<number, NpcLook>> = {
  1: { outfit: outfit(SKIN[0], 0x5a3a1a, 0x4a8ad8, 0x3a3a4a, 0x2a2a2a), hat: 'none', hatColor: 0 },
  2: { outfit: outfit(SKIN[4], 0xd89a3a, 0xff7ab0, 0x2a2a3a, 0xffffff, [{ kind: 'stripes', color: 0xffffff, every: 2 }]), hat: 'bun', hatColor: 0xd89a3a },
  3: { outfit: outfit(SKIN[1], 0x2a2a2a, 0xf6f6f6, 0x3a3a48, 0x1a1a1a, [{ kind: 'collar', color: 0x2a4a9a }, { kind: 'buttons', color: 0xc0c0c0 }]), hat: 'none', hatColor: 0 },
  4: { outfit: outfit(SKIN[2], 0x1a1a1a, 0xffd23a, 0x4a6ad8, 0xffffff), hat: 'beanie', hatColor: 0x8a4ad8, trim: 0xffffff },
  5: { outfit: outfit(SKIN[0], 0xd8d8d8, 0x8a6a4a, 0x5a5a5a, 0x3a2a1a, [{ kind: 'vest', color: 0x5a4a3a, button: 0xc0a060 }]), hat: 'none', hatColor: 0, beard: 0xe8e8e8, glasses: 0x3a3a3a },
  6: { outfit: outfit(SKIN[5], 0x3a2a1a, 0x5ad8c8, 0xe8d8b0, 0x8a5a3a, [{ kind: 'stripes', color: 0xffe066, every: 1 }]), hat: 'straw', hatColor: 0xf2d27a, trim: 0x5ad8c8 },
  7: { outfit: outfit(SKIN[1], 0xf2d27a, 0xff9a3a, 0x3a8ad8, 0xffd23a, [{ kind: 'stripes', color: 0xffffff, every: 3 }]), hat: 'none', hatColor: 0, glasses: 0x1a1a1a },
  8: { outfit: outfit(SKIN[3], 0x1a1a1a, 0x3a3a3a, 0x4a6ad8, 0xd8443a, [{ kind: 'badge', color: 0xffd23a }]), hat: 'cap', hatColor: 0xd8443a, trim: 0xffffff },
  9: { outfit: outfit(SKIN[0], 0x8a4a1a, 0xd8443a, 0x3f8f3a, 0x6a4020, [{ kind: 'overalls', color: 0x3a6ac8, button: 0xffd23a }]), hat: 'straw', hatColor: 0xf2d27a },
  10: { outfit: outfit(SKIN[4], 0x1a1a1a, 0xf6f0e4, 0x2a2a2a, 0x1a1a1a, [{ kind: 'stripes', color: 0x2a2a2a, every: 1 }]), hat: 'beret', hatColor: 0xd8443a },
  11: { outfit: outfit(SKIN[1], 0x2a2a2a, 0x2a2a3a, 0x2a2a3a, 0x0a0a0a, [{ kind: 'collar', color: 0xffffff }, { kind: 'bowtie', color: 0xd8443a }], 0x2a2a3a), hat: 'none', hatColor: 0, glasses: 0x1a1a1a },
  12: { outfit: outfit(SKIN[2], 0xff7ab0, 0xffffff, 0x6a8ad8, 0xff7ab0, [{ kind: 'badge', color: 0xff5a8a }]), hat: 'none', hatColor: 0, glasses: 0xff5a8a },
  13: { outfit: outfit(SKIN[0], 0x3a2a1a, 0x3a3a3a, 0x3a3a3a, 0x1a1a1a, [{ kind: 'stripes', color: 0xffe066, every: 1 }]), hat: 'helmet', hatColor: 0xd8443a, trim: 0xd8443a },
  14: { outfit: outfit(SKIN[3], 0x1a1a1a, 0xffffff, 0x5ab8c8, 0xffffff, [{ kind: 'cross', color: 0xd8443a }], 0x5ab8c8), hat: 'none', hatColor: 0 },
  15: { outfit: outfit(SKIN[1], 0x1a1a1a, 0xf6f0e4, 0x3a2a1a, 0x1a1a1a, [{ kind: 'vest', color: 0x6a3a1a, button: 0xffd23a }, { kind: 'sash', color: 0xd8443a }]), hat: 'tricorn', hatColor: 0x2a1a12, beard: 0x1a1a1a },
  16: { outfit: outfit(SKIN[4], 0x6a6a6a, 0x2a2a2a, 0x2a2a2a, 0x1a1a1a, [{ kind: 'collar', color: 0xffffff }, { kind: 'bowtie', color: 0xffd23a }], 0x2a2a2a), hat: 'beret', hatColor: 0x1a1a1a, glasses: 0x1a1a1a },
  17: { outfit: outfit(SKIN[2], 0x3a2a1a, 0xd8443a, 0xd8443a, 0xd8443a, [{ kind: 'cross', color: 0xd8443a }]), hat: 'cap', hatColor: 0xd8443a, trim: 0xffffff, glasses: 0x1a1a1a },
  18: { outfit: outfit(SKIN[0], 0x5a3a1a, 0xb8bec8, 0x8a8e98, 0x5a5e68, [{ kind: 'belt', color: 0x6a4020, buckle: 0xffd23a }, { kind: 'cross', color: 0xd8443a }], 0xb8bec8), hat: 'helmet', hatColor: 0xb8bec8, trim: 0xd8443a },
  19: { outfit: outfit(SKIN[0], 0xe8e8e8, 0x9a2a4a, 0x6a1a2a, 0x1a1a1a, [{ kind: 'sash', color: 0xffd23a }, { kind: 'buttons', color: 0xffd23a }]), hat: 'crown', hatColor: 0xffd23a, beard: 0xe8e8e8 },
  20: { outfit: outfit(SKIN[1], 0x3a2a1a, 0xf2f2f2, 0xf2f2f2, 0xb8bec8, [{ kind: 'badge', color: 0x3a6ac8 }, { kind: 'belt', color: 0xb8bec8, buckle: 0xffb02a }]), hat: 'space', hatColor: 0xffffff },
  21: { outfit: outfit(SKIN[0], 0xd8d8d8, 0x4a2a9a, 0x3a1a7a, 0x2a1a4a, [{ kind: 'sash', color: 0xffd23a }]), hat: 'wizard', hatColor: 0x4a2a9a, beard: 0xf2f2f2 },
  22: { outfit: outfit(SKIN[2], 0xe8e8e8, 0xf6f6f6, 0xf6f6f6, 0xffd23a, [{ kind: 'sash', color: 0xffd23a }, { kind: 'belt', color: 0xffd23a, buckle: 0xffffff }]), hat: 'laurel', hatColor: 0x6ad04a, beard: 0xf2f2f2 },
};

/** A staff member's uniform: by role, with a per-person skin and hair. */
export const staffLook = (role: string, member: number): NpcLook => {
  const skin = SKIN[member % SKIN.length]!;
  const hair = [0x2a1a12, 0x6a3a1a, 0xd89a3a, 0x1a1a1a, 0x8a3a1a][member % 5]!;
  switch (role) {
    case 'cook':
      return { outfit: outfit(skin, hair, 0xffffff, 0x2a2a2e, 0x1a1a1a, [{ kind: 'apron', color: 0xf2f2f2, pocket: 0xd8d8d8 }, { kind: 'buttons', color: 0x1a1a1a }]), hat: 'chef', hatColor: 0xffffff };
    case 'cleaner':
      return { outfit: outfit(skin, hair, 0x5ab8e8, 0x3a6ac8, 0x2a2a2a, [{ kind: 'apron', color: 0xffe066 }]), hat: 'cap', hatColor: 0x5ab8e8, trim: 0xffffff };
    case 'farmer':
      return { outfit: outfit(skin, hair, 0xd8443a, 0x3f8f3a, 0x6a4020, [{ kind: 'overalls', color: 0x3f8f3a, button: 0xffd23a }, { kind: 'stripes', color: 0xa82e28, every: 1 }]), hat: 'straw', hatColor: 0xf2d27a, trim: 0xd8443a };
    case 'rancher':
      return { outfit: outfit(skin, hair, 0xc8a86a, 0x3a5a9a, 0x5a3a22, [{ kind: 'vest', color: 0x8a5a2a, button: 0xc0a060 }, { kind: 'belt', color: 0x4a2e1a, buckle: 0xffd23a }]), hat: 'straw', hatColor: 0x8a5a2a, trim: 0x4a2e1a };
    case 'manager':
      return { outfit: outfit(skin, hair, 0x2a3a6a, 0x2a2a3a, 0x1a1a1a, [{ kind: 'collar', color: 0xffffff }, { kind: 'bowtie', color: 0xffd23a }, { kind: 'badge', color: 0xffd23a }], 0x2a3a6a), hat: 'none', hatColor: 0, glasses: 0x1a1a1a };
    default:
      return { outfit: outfit(skin, hair, 0xffffff, 0x1a1a1a, 0x1a1a1a, [{ kind: 'vest', color: 0x1a1a1a, button: 0xc0c0c0 }, { kind: 'bowtie', color: 0xd8443a }]), hat: 'none', hatColor: 0 };
  }
};

/** The Pet Merchant: a vet's coat, a cap with a paw badge. */
export const PET_MERCHANT_LOOK: NpcLook = {
  outfit: outfit(0xc8905a, 0x2a1a12, 0xf6f6f6, 0x5a8a4a, 0x4a2e1a, [{ kind: 'apron', color: 0x8ad06a, pocket: 0xffd23a }, { kind: 'badge', color: 0xff7ad9 }]),
  hat: 'cap',
  hatColor: 0x8ad06a,
  trim: 0xff7ad9,
  glasses: 0x3a3a3a,
};

/** The tutorial guide and the shopkeeper. */
export const GUIDE_LOOK: NpcLook = { outfit: outfit(0xf2c8a0, 0x2a1a12, 0xffffff, 0x1a1a1a, 0x1a1a1a, [{ kind: 'buttons', color: 0x1a1a1a }]), hat: 'chef', hatColor: 0xffffff };
export const KEEPER_LOOK: NpcLook = {
  outfit: outfit(0xe8b890, 0x6a3a1a, 0xf6f6f6, 0x4a4a52, 0x2a2a2a, [{ kind: 'apron', color: 0x2f8ad8, pocket: 0xff9a3a }, { kind: 'badge', color: 0xffd23a }]),
  hat: 'visor',
  hatColor: 0xff9a3a,
  trim: 0x2f8ad8,
};
