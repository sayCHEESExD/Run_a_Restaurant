import {
  AVENUE_HALF,
  BEACH_HALF,
  BOARDS,
  BOARD_SIZE,
  DISPLAYS,
  DOOR,
  FARM,
  FOUNTAIN,
  GROUND_HALF,
  LAMPS,
  LAND_HALF,
  MARKET_GREEN,
  PET_MERCHANT,
  PIER,
  PLAZA_HALF,
  PLINTH,
  PLOT_SLOTS,
  POND,
  RANCH,
  RING_IN,
  RING_OUT,
  SHOP,
  TOWN_BUILDINGS,
  TREES,
  groundAt,
  itemById,
  plotAt,
  sceneryClear,
  toLocal,
  type BoardId,
} from '@restaurant/shared';
import { BufferGeometry, Group, InstancedMesh, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { buildBoardFrame, buildShopBuilding, buildTownBuilding } from '../models/buildings.js';
import { buildAnimal, buildCrop, buildItem } from '../models/items.js';
import { blockBush, flowerPatch, grassClump, rock, tulip } from '../models/nature.js';
import { seededRandom, shade } from '../models/shapes.js';
import { buildBench, buildFountain, buildLamp } from '../models/town.js';
import { buildPlanter } from '../models/landmarks.js';
import { buildTree, TREE_VARIANTS } from '../models/trees.js';
import { KEEPER_LOOK, NpcCharacter, PET_MERCHANT_LOOK } from '../player/NpcCharacter.js';
import { buildPetStall, buildPier } from '../models/pets.js';
import { PartBuilder, partMaterials, type PartKind } from '../render/PartBuilder.js';
import { BoardSign, type BoardRow } from './BoardSign.js';
import { CanvasSign } from './CanvasSign.js';
import { paintTerrain, tileHash, valueNoise, waterSurface, type Cell } from './Terrain.js';

const MEADOW = [0x6fcc44, 0x68c640, 0x74d04a, 0x66c43e] as const;
const LAWN = [0x62c83e, 0x5cc03a] as const;
const WOODS = [0x56b03a, 0x4ea836, 0x5ab83c] as const;
const PLAZA_TILE = [0xf2ece0, 0xe6dfd0] as const;
const ASPHALT = [0x54565e, 0x50525a] as const;
const SIDEWALK = [0xd6d2ca, 0xccc8c0] as const;
const SAND = [0xf2dfa4, 0xecd797] as const;
const SOIL = [0x8a5a34, 0x7e5230] as const;
const PASTURE = [0x9ad05a, 0x92c854] as const;
const PAVER = [0xd8ccb8, 0xc8bca8] as const;
const VOID: Cell = { color: 0, liquid: 'void' };
const KINDS: readonly PartKind[] = ['stud', 'smooth', 'glow', 'flat', 'leaf'];
const CHUNK = 170;

const M = new Matrix4();
const Q = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);

interface Instanced {
  readonly build: (b: PartBuilder) => void;
  readonly spots: { x: number; y: number; z: number; ry: number; s: number }[];
  readonly shadows: boolean;
}

/**
 * THE TOWN ITSELF: the painted ground (plaza tiles, asphalt with its lane
 * line, sidewalks, avenues, lawns, the farm soil and ranch pasture of every
 * plot, the beach), the trees, lamps and flowers, the plaza with its
 * fountain, the town's buildings, the Shop with an item on every plinth and
 * its keeper, and the leaderboards. Built once; only the boards, the
 * displays' slow turn and the keeper move.
 */
export class TownWorld {
  readonly root = new Group();
  readonly keeper: NpcCharacter;
  readonly merchant: NpcCharacter;
  private readonly boards = new Map<BoardId, BoardSign>();
  private readonly displays: Group[] = [];
  private readonly disposables: { dispose(): void }[] = [];

  constructor() {
    this.buildTerrain();
    this.buildTrees();
    this.buildScatter();
    this.buildPlaza();
    this.buildTown();
    this.buildShop();
    this.buildBoards();
    this.keeper = new NpcCharacter(KEEPER_LOOK);
    this.keeper.root.position.set(SHOP.keeper.x, 0, SHOP.keeper.z);
    this.keeper.character.setYaw(Math.PI);
    this.root.add(this.keeper.root);
    this.merchant = new NpcCharacter(PET_MERCHANT_LOOK);
    this.merchant.root.position.set(PET_MERCHANT.keeper.x, 0, PET_MERCHANT.keeper.z);
    this.merchant.character.setYaw(Math.PI / 2);
    this.root.add(this.merchant.root);
    this.buildPetsAndPier();
  }

  /** The Pet Merchant's stall in the plaza, and the fishing pier down on the south beach. */
  private buildPetsAndPier(): void {
    const b = new PartBuilder();
    const stall = new PartBuilder();
    buildPetStall(stall);
    b.absorb(stall, { x: PET_MERCHANT.x, z: PET_MERCHANT.z });
    buildPier(b, PIER.x, PIER.landZ + 4, PIER.minZ, PIER.half);
    // A bait shack and a sign where the path meets the sand.
    b.box(5, 3.4, 4, 0x5a8ab8, 'stud', { x: PIER.x - PIER.half - 4, y: 1.7, z: PIER.landZ + 6 });
    b.box(5.6, 0.4, 4.6, 0xffffff, 'stud', { x: PIER.x - PIER.half - 4, y: 3.6, z: PIER.landZ + 6 });
    this.root.add(b.build('pets-and-pier'));
    const sign = new CanvasSign(7, 1.6, [{ text: 'Pet Merchant', size: 1, fill: '#ffffff', stroke: '#c8508a', strokeWidth: 0.2 }]);
    sign.mesh.position.set(PET_MERCHANT.x + 2.3, 5.4, PET_MERCHANT.z);
    sign.mesh.rotation.y = Math.PI / 2;
    this.root.add(sign.mesh);
    this.disposables.push(sign);
    const sub = new CanvasSign(6, 0.8, [{ text: 'Buy & Sell Pets!', size: 1, fill: '#ffffff', stroke: '#6a4024', strokeWidth: 0.2 }]);
    sub.mesh.position.set(PET_MERCHANT.x + 2.3, 4.5, PET_MERCHANT.z);
    sub.mesh.rotation.y = Math.PI / 2;
    this.root.add(sub.mesh);
    this.disposables.push(sub);
    const pier = new CanvasSign(7, 1.4, [{ text: 'Fishing Pier', size: 1, fill: '#ffffff', stroke: '#2f6ab8', strokeWidth: 0.2 }]);
    pier.mesh.position.set(PIER.x, 3.4, PIER.landZ + 9);
    this.root.add(pier.mesh);
    this.disposables.push(pier);
    const post = new PartBuilder();
    for (const dx of [-3, 3]) post.box(0.3, 3.6, 0.3, 0x7a4a2a, 'stud', { x: PIER.x + dx, y: 1.8, z: PIER.landZ + 9.2 });
    this.root.add(post.build('pier-sign'));
  }

  // ---------------------------------------------------------------- ground

  private buildTerrain(): void {
    const tone = valueNoise(7);
    const paint = (x: number, z: number): Cell => {
      const g = groundAt(x, z);
      const h = tileHash(x, z, 3);
      switch (g) {
        case 'water':
          return VOID;
        case 'sand':
          return { color: Math.max(Math.abs(x), Math.abs(z)) > BEACH_HALF - 3 ? 0xe0c888 : SAND[h < 0.5 ? 0 : 1]! };
        case 'pond':
          return { color: 0x5ab8e8, liquid: 'water', liquidColor: 0x4ab0e8 };
        case 'plaza': {
          const ring = Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z);
          if (ring < FOUNTAIN.radius + 5 && ring > FOUNTAIN.radius + 2.6) return { color: 0xc8b8a0 };
          if (Math.abs(x) > PLAZA_HALF - 2.4 || Math.abs(z) > PLAZA_HALF - 2.4) return { color: 0xc8b8a0 };
          const i = Math.floor((x + 1000) / 4.4);
          const j = Math.floor((z + 1000) / 4.4);
          return { color: PLAZA_TILE[(i + j) % 2]! };
        }
        case 'road': {
          const r = Math.max(Math.abs(x), Math.abs(z));
          const mid = (RING_IN + RING_OUT) / 2;
          const along = Math.abs(x) > Math.abs(z) ? z : x;
          if (Math.abs(r - mid) < 0.6 && Math.floor((along + 1000) / 4.4) % 2 === 0) return { color: 0xffd23a };
          if (Math.abs(r - RING_IN) < 0.6 || Math.abs(r - RING_OUT) < 0.6) return { color: 0xe8e8e8 };
          return { color: ASPHALT[h < 0.5 ? 0 : 1]! };
        }
        case 'path':
          return { color: PAVER[(Math.floor(x / 2.2) + Math.floor(z / 2.2)) % 2 === 0 ? 0 : 1]! };
        case 'sidewalk':
          return { color: SIDEWALK[(Math.floor(x / 2.2) + Math.floor(z / 2.2)) % 2 === 0 ? 0 : 1]! };
        case 'avenue': {
          const across = Math.abs(x) <= AVENUE_HALF ? Math.abs(x) : Math.abs(z);
          if (across > AVENUE_HALF - 1.2) return { color: 0xb8553a };
          return { color: PAVER[(Math.floor(x / 2.2) + Math.floor(z / 2.2)) % 2 === 0 ? 0 : 1]! };
        }
        case 'plot': {
          const slot = PLOT_SLOTS[plotAt(x, z)]!;
          const l = toLocal(slot, x, z);
          if (l.x > FARM.minX && l.x < FARM.maxX && l.z > FARM.minZ && l.z < FARM.maxZ) return { color: SOIL[Math.floor(l.z / 2.2) % 2 === 0 ? 0 : 1]! };
          if (l.x > RANCH.minX && l.x < RANCH.maxX && l.z > RANCH.minZ && l.z < RANCH.maxZ) return { color: PASTURE[h < 0.5 ? 0 : 1]! };
          if (Math.abs(l.x - DOOR.x) < 2.8 && l.z < 6) return { color: PAVER[Math.floor(l.z / 2.2) % 2 === 0 ? 0 : 1]! };
          return { color: LAWN[Math.floor((l.z + 200) / 4.4) % 2]! };
        }
        case 'grass': {
          // The paths from the sidewalk to every plot's door.
          for (const slot of PLOT_SLOTS) {
            const l = toLocal(slot, x, z);
            if (Math.abs(l.x - DOOR.x) < 2.8 && l.z < 0.5 && l.z > -6) return { color: PAVER[0] };
          }
          const n = tone(x * 0.035, z * 0.035);
          const r = Math.max(Math.abs(x), Math.abs(z));
          if (r > RING_OUT + 6 && plotAt(x, z, 6) < 0) return { color: WOODS[n < 0.4 ? 1 : n > 0.62 ? 2 : 0]! };
          return { color: MEADOW[n < 0.36 ? 1 : n > 0.66 ? 2 : h < 0.14 ? 3 : 0]! };
        }
      }
    };
    const b = new PartBuilder();
    for (let x0 = -GROUND_HALF; x0 < GROUND_HALF; x0 += CHUNK) {
      for (let z0 = -GROUND_HALF; z0 < GROUND_HALF; z0 += CHUNK) {
        const parts = paintTerrain({ minX: x0, maxX: x0 + CHUNK, minZ: z0, maxZ: z0 + CHUNK, y: 0, paint, bank: 0xc8a870 });
        if (parts.ground.getAttribute('position')?.count) {
          b.addPainted(parts.ground, 'stud');
          const chunk = b.build('terrain', false);
          for (const child of chunk.children) (child as Mesh).receiveShadow = true;
          this.root.add(chunk);
        }
        if (parts.water) {
          const mesh = new Mesh(parts.water, waterSurface());
          mesh.renderOrder = 2;
          this.root.add(mesh);
          this.disposables.push(parts.water);
        }
      }
    }
  }

  // ----------------------------------------------------------------- growth

  private instance(name: string, prototypes: readonly Instanced[]): void {
    const materials = partMaterials();
    for (const proto of prototypes) {
      if (proto.spots.length === 0) continue;
      const b = new PartBuilder();
      proto.build(b);
      const geometries = b.geometries();
      for (const kind of KINDS) {
        const geometry: BufferGeometry | undefined = geometries[kind];
        if (!geometry) continue;
        const mesh = new InstancedMesh(geometry, materials[kind], proto.spots.length);
        proto.spots.forEach((spot, i) => {
          Q.setFromAxisAngle(UP, spot.ry);
          P.set(spot.x, spot.y, spot.z);
          S.setScalar(spot.s);
          mesh.setMatrixAt(i, M.compose(P, Q, S));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.name = `${name}-${kind}`;
        mesh.castShadow = proto.shadows && kind !== 'glow';
        mesh.receiveShadow = kind !== 'glow';
        this.root.add(mesh);
        this.disposables.push(geometry);
      }
    }
  }

  private buildTrees(): void {
    const groups = new Map<string, Instanced>();
    const species = [0, 1, 2, 4] as const;
    for (const tree of TREES) {
      const kind = species[tree.kind] ?? 0;
      const variant = tree.variant % TREE_VARIANTS;
      const key = `${kind}:${variant}`;
      let group = groups.get(key);
      if (!group) {
        group = { build: (b) => buildTree(b, kind, variant), spots: [], shadows: true };
        groups.set(key, group);
      }
      group.spots.push({ x: tree.x, y: 0, z: tree.z, ry: (tree.x * 13.7 + tree.z * 7.3) % 6.283, s: tree.scale });
    }
    this.instance('trees', [...groups.values()]);
    this.instance('lamps', [{ build: (b) => buildLamp(b, 0, 0), spots: LAMPS.map((l) => ({ x: l.x, y: 0, z: l.z, ry: 0, s: 1 })), shadows: false }]);
  }

  private buildScatter(): void {
    const r = seededRandom(0x5ca7);
    const make = (build: (b: PartBuilder, rr: () => number) => void): Instanced => {
      const seed = Math.floor(r() * 1e9);
      return { build: (b) => build(b, seededRandom(seed)), spots: [], shadows: false };
    };
    const bushes = [0, 1, 2].map((i) => make((b, rr) => blockBush(b, rr, 0, 0, 1, 0, i % 2 ? 3 : 0)));
    const flowers = [0xff4a5a, 0xffd23a, 0xff8ad8, 0xffffff, 0xb07aff].map((color) => make((b, rr) => flowerPatch(b, rr, 0, 0, color)));
    const tulips = [0xff4a4a, 0xffd23a].map((color) =>
      make((b, rr) => {
        for (let k = 0; k < 6; k += 1) tulip(b, rr, (rr() - 0.5) * 4, (rr() - 0.5) * 4, 0.9 + rr() * 0.3, color);
      }),
    );
    const grass = [0, 1].map(() => make((b, rr) => grassClump(b, rr, 0, 0, 1)));
    const rocks = [0, 1].map(() => make((b, rr) => rock(b, rr, 0, 0, 1)));
    const one = <T>(list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;
    for (let x = -LAND_HALF + 4; x < LAND_HALF - 4; x += 9) {
      for (let z = -LAND_HALF + 4; z < LAND_HALF - 4; z += 9) {
        const px = x + (r() - 0.5) * 7;
        const pz = z + (r() - 0.5) * 7;
        if (!sceneryClear(px, pz, 1.5)) continue;
        const roll = r();
        const outer = Math.max(Math.abs(px), Math.abs(pz)) > RING_OUT;
        const spot = { x: px, y: 0, z: pz, ry: r() * Math.PI * 2, s: 0.8 + r() * 0.5 };
        if (roll < 0.22) one(bushes).spots.push(spot);
        else if (roll < 0.36) one(flowers).spots.push(spot);
        else if (roll < 0.44 && !outer) one(tulips).spots.push(spot);
        else if (roll < 0.62) one(grass).spots.push(spot);
        else if (roll < 0.68 && outer) one(rocks).spots.push(spot);
      }
    }
    this.instance('scatter', [...bushes, ...flowers, ...tulips, ...grass, ...rocks]);
  }

  // ----------------------------------------------------------------- plaza

  private buildPlaza(): void {
    const b = new PartBuilder();
    const f = new PartBuilder();
    buildFountain(f);
    b.absorb(f, { x: FOUNTAIN.x, z: FOUNTAIN.z, sx: 1.15, sy: 1.15, sz: 1.15 });
    // Benches round the fountain, planters at the plaza corners.
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      buildBench(b, FOUNTAIN.x + Math.cos(a) * 14, FOUNTAIN.z + Math.sin(a) * 14, -a + Math.PI / 2);
    }
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        if (sz > 0) continue;
        buildPlanter(b, sx * (PLAZA_HALF - 8), sz * (PLAZA_HALF - 8), 6, 2.4, 0, [0xff5a8a, 0xffd23a, 0xffffff]);
      }
      // Flower beds either side of the Shop's doors.
      buildPlanter(b, sx * 14, SHOP.minZ - 4, 8, 2, 0, [0xff8ad8, 0xffd23a, 0xff5a5a]);
    }
    // The welcome arch where the south avenue enters the plaza.
    const archZ = -PLAZA_HALF + 1;
    for (const x of [-8, 8]) {
      b.box(1.6, 9, 1.6, 0xf2ece0, 'stud', { x, y: 4.5, z: archZ });
      b.box(2, 0.6, 2, 0xd8443a, 'stud', { x, y: 9.2, z: archZ });
    }
    b.box(18, 2.6, 1.2, 0xd8443a, 'stud', { y: 10.6, z: archZ });
    this.root.add(b.build('plaza'));
    const welcome = new CanvasSign(16, 2.2, [{ text: 'Restaurant Town', size: 1, fill: '#ffffff', stroke: '#7a1a1a', strokeWidth: 0.16 }]);
    welcome.mesh.position.set(0, 10.6, archZ - 0.62);
    welcome.mesh.rotation.y = Math.PI;
    this.root.add(welcome.mesh);
    this.disposables.push(welcome);
    const back = new CanvasSign(16, 2.2, [{ text: 'Restaurant Town', size: 1, fill: '#ffffff', stroke: '#7a1a1a', strokeWidth: 0.16 }]);
    back.mesh.position.set(0, 10.6, archZ + 0.62);
    this.root.add(back.mesh);
    this.disposables.push(back);
  }

  // ------------------------------------------------------------------ town

  private buildTown(): void {
    const b = new PartBuilder();
    for (const building of TOWN_BUILDINGS) {
      const one = new PartBuilder();
      buildTownBuilding(one, building);
      b.absorb(one, { x: building.x, z: building.z, ry: building.yaw });
      if (building.kind === 'house' || building.kind === 'gazebo') continue;
      const sign = new CanvasSign(building.hx * 1.3, 1.8, [{ text: building.name, size: 1, fill: '#ffffff', stroke: shadeHex(building.roof), strokeWidth: 0.18 }]);
      const out = building.hz + (building.kind === 'market' ? 1.5 : 0.25);
      sign.mesh.position.set(building.x + Math.sin(building.yaw) * out, building.kind === 'market' ? 5.6 : 6.4, building.z + Math.cos(building.yaw) * out);
      sign.mesh.rotation.y = building.yaw;
      this.root.add(sign.mesh);
      this.disposables.push(sign);
    }
    // Crates and barrels round the market green.
    const r = seededRandom(0x3a7e);
    for (let i = 0; i < 6; i += 1) {
      const x = MARKET_GREEN.x - 12 + i * 5 + (r() - 0.5) * 2;
      b.box(1.4, 1.2, 1.4, [0xc89a5a, 0xb8854a][i % 2]!, 'stud', { x, y: 0.6, z: MARKET_GREEN.z + 8 + (r() - 0.5) * 3, ry: r() });
    }
    // A picnic spot by the pond.
    b.box(4, 0.2, 1.8, 0xb87a45, 'stud', { x: POND.x + 22, y: 1.4, z: POND.z + 4 });
    for (const dz of [-1.6, 1.6]) b.box(4, 0.2, 0.6, 0xb87a45, 'stud', { x: POND.x + 22, y: 0.8, z: POND.z + 4 + dz });
    this.root.add(b.build('town'));
  }

  // ------------------------------------------------------------------ shop

  private buildShop(): void {
    const shop = buildShopBuilding();
    this.root.add(shop.solid, shop.glass);
    const sign = new CanvasSign(14, 2.6, [{ text: 'SHOP', size: 1, fill: '#ffffff', stroke: '#2f6ab8', strokeWidth: 0.2 }]);
    sign.mesh.position.set(0, SHOP.height - 0.9, SHOP.minZ - 1.25);
    sign.mesh.rotation.y = Math.PI;
    this.root.add(sign.mesh);
    this.disposables.push(sign);
    // Category banners over the aisles.
    const byCategory = new Map<string, { x: number; z: number; n: number }>();
    for (const d of DISPLAYS) {
      const category = itemById(d.item)?.category ?? 'decor';
      const at = byCategory.get(category) ?? { x: 0, z: 0, n: 0 };
      at.x += d.x;
      at.z += d.z;
      at.n += 1;
      byCategory.set(category, at);
    }
    const names: Record<string, string> = { furniture: 'Furniture', appliances: 'Appliances', decor: 'Decor', farming: 'Farming', ranching: 'Ranching' };
    const colors: Record<string, string> = { furniture: '#b8553a', appliances: '#2f6ab8', decor: '#a83a9a', farming: '#3f8f3a', ranching: '#a8701a' };
    for (const [category, at] of byCategory) {
      const banner = new CanvasSign(9, 1.6, [{ text: names[category] ?? category, size: 1, fill: '#ffffff', stroke: colors[category] ?? '#333', strokeWidth: 0.2 }]);
      banner.mesh.position.set(at.x / at.n, 7.6, at.z / at.n - 2);
      banner.mesh.rotation.y = Math.PI;
      this.root.add(banner.mesh);
      this.disposables.push(banner);
    }
    // An item on every plinth, turning slowly.
    for (const d of DISPLAYS) {
      const def = itemById(d.item);
      if (!def) continue;
      const b = new PartBuilder();
      buildItem(b, def.id);
      if (def.role === 'crop' && def.produces) buildCrop(b, def.produces, 1);
      if (def.role === 'animal' && def.produces) {
        const a = new PartBuilder();
        buildAnimal(a, def.produces);
        b.absorb(a, { x: -0.6, z: -0.4 });
      }
      const group = b.build(`display-${def.key}`);
      const span = Math.max(def.w, def.d, def.h * 0.8);
      const scale = Math.min(1, (PLINTH.half * 2 - 0.4) / Math.max(0.5, span));
      group.scale.setScalar(scale);
      group.position.set(d.x, PLINTH.height + 0.1, d.z);
      group.rotation.y = Math.PI + (d.x > 0 ? -0.5 : 0.5);
      this.root.add(group);
      this.displays.push(group);
    }
  }

  // ---------------------------------------------------------------- boards

  private buildBoards(): void {
    for (const spot of BOARDS) {
      const frame = new PartBuilder();
      buildBoardFrame(frame, BOARD_SIZE.width, BOARD_SIZE.height);
      const group = frame.build(`board-${spot.id}`);
      group.position.set(spot.x, 0, spot.z);
      group.rotation.y = spot.yaw;
      const sign = new BoardSign(BOARD_SIZE.width, BOARD_SIZE.height, spot.title, spot.subtitle);
      sign.mesh.position.set(0, BOARD_SIZE.height / 2 + 1, 0.0);
      group.add(sign.mesh);
      this.root.add(group);
      this.boards.set(spot.id, sign);
      this.disposables.push(sign);
    }
  }

  setBoard(id: BoardId, rows: readonly BoardRow[]): void {
    this.boards.get(id)?.set(rows);
  }

  update(delta: number, px: number, pz: number): void {
    // The keeper and the displays only matter up close.
    if (Math.abs(px) < SHOP.maxX + 40 && pz > SHOP.minZ - 50 && pz < SHOP.maxZ + 20) {
      this.keeper.update(delta);
      for (const d of this.displays) d.rotation.y += delta * 0.35;
    }
    if (Math.hypot(px - PET_MERCHANT.x, pz - PET_MERCHANT.z) < 80) this.merchant.update(delta);
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.keeper.dispose();
    this.merchant.dispose();
    this.root.removeFromParent();
  }
}

const shadeHex = (color: number): string => `#${shade(color, 0.6).toString(16).padStart(6, '0')}`;
