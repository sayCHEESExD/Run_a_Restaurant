import { petsFromText } from '@restaurant/shared';
import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial } from 'three';
import { buildPet } from '../models/pets.js';
import { ball, block } from '../models/shapes.js';
import { PartBuilder, meshesFor, type PartKind } from '../render/PartBuilder.js';

export interface CompanionOwner {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly pets: string;
  /** 0 not fishing, 1 waiting, 2 a bite. */
  readonly fishing: number;
  readonly fishX: number;
  readonly fishZ: number;
}

interface Follower {
  readonly group: Group;
  vx: number;
  vz: number;
}

interface Entry {
  petsKey: string;
  followers: Follower[];
  line: Line | null;
  bobber: Group | null;
  seen: boolean;
}

const cache = new Map<string, Partial<Record<PartKind, BufferGeometry>>>();
const model = (key: string, build: (b: PartBuilder) => void): Group => {
  let g = cache.get(key);
  if (!g) {
    const b = new PartBuilder();
    build(b);
    g = b.geometries();
    cache.set(key, g);
  }
  return meshesFor(g, key, true);
};

/** Where each follower walks, behind and beside its owner (owner-local x, z). */
const SLOTS = [
  [-1.7, -1.6],
  [1.7, -1.6],
  [0, -3.1],
] as const;

/**
 * EVERYONE'S COMPANIONS: the pets trotting after each player (hopping when
 * they move), and the line and bobber of anyone fishing - the bobber dips
 * and splashes when a fish bites. Drawn from each player's replicated
 * `pets` and `fishing` fields; nothing here is decided locally.
 */
export class Companions {
  readonly root = new Group();
  private readonly entries = new Map<string, Entry>();
  private readonly lineMaterial = new LineBasicMaterial({ color: 0xf6f6f6 });
  private time = 0;

  constructor(private readonly splash: (x: number, z: number) => void) {}

  update(owners: readonly CompanionOwner[], delta: number): void {
    this.time += delta;
    for (const entry of this.entries.values()) entry.seen = false;
    for (const owner of owners) this.draw(owner, delta);
    for (const [id, entry] of this.entries) {
      if (entry.seen) continue;
      this.clear(entry);
      this.entries.delete(id);
    }
  }

  private draw(o: CompanionOwner, delta: number): void {
    let entry = this.entries.get(o.id);
    if (!entry) {
      entry = { petsKey: '', followers: [], line: null, bobber: null, seen: true };
      this.entries.set(o.id, entry);
    }
    entry.seen = true;
    if (entry.petsKey !== o.pets) {
      for (const f of entry.followers) f.group.removeFromParent();
      entry.followers = petsFromText(o.pets).map((type, i) => {
        const group = model(`pet:${type}`, (b) => buildPet(b, type));
        const slot = SLOTS[i] ?? SLOTS[0]!;
        group.position.set(o.x + slot[0], o.y, o.z + slot[1]);
        this.root.add(group);
        return { group, vx: 0, vz: 0 };
      });
      entry.petsKey = o.pets;
    }
    const c = Math.cos(o.yaw);
    const s = Math.sin(o.yaw);
    entry.followers.forEach((f, i) => {
      const [lx, lz] = SLOTS[i] ?? SLOTS[0]!;
      const tx = o.x + lx * c + lz * s;
      const tz = o.z - lx * s + lz * c;
      const p = f.group.position;
      const dx = tx - p.x;
      const dz = tz - p.z;
      const gap = Math.hypot(dx, dz);
      if (gap > 30) {
        p.set(tx, o.y, tz);
        return;
      }
      const k = Math.min(1, delta * 5);
      p.x += dx * k;
      p.z += dz * k;
      const moving = gap > 0.25;
      p.y = o.y + (moving ? Math.abs(Math.sin(this.time * 11 + i)) * 0.35 : Math.abs(Math.sin(this.time * 2 + i)) * 0.04);
      const face = moving ? Math.atan2(dx, dz) : o.yaw;
      let turn = face - f.group.rotation.y;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;
      f.group.rotation.y += turn * Math.min(1, delta * 8);
    });
    this.drawLine(o, entry);
  }

  private drawLine(o: CompanionOwner, entry: Entry): void {
    if (o.fishing === 0) {
      if (entry.line) {
        entry.line.removeFromParent();
        entry.line.geometry.dispose();
        entry.line = null;
      }
      entry.bobber?.removeFromParent();
      entry.bobber = null;
      return;
    }
    if (!entry.bobber) {
      entry.bobber = model('bobber', (b) => {
        ball(b, 0.22, 0xff3a2a, { y: 0.1 }, 'smooth', 0);
        ball(b, 0.2, 0xffffff, { y: -0.05 }, 'smooth', 0);
        block(b, 0.04, 0.3, 0.04, 0x2a2a2a, { y: 0.35 });
      });
      this.root.add(entry.bobber);
    }
    const bite = o.fishing === 2;
    const bob = bite ? -0.35 + Math.sin(this.time * 30) * 0.12 : Math.sin(this.time * 3) * 0.06;
    entry.bobber.position.set(o.fishX, -0.05 + bob, o.fishZ);
    if (bite && Math.random() < 0.25) this.splash(o.fishX, o.fishZ);
    // The rod's tip: out in front of the angler, up high.
    const tipX = o.x + Math.sin(o.yaw) * 2.6;
    const tipZ = o.z + Math.cos(o.yaw) * 2.6;
    const tipY = o.y + 4.4;
    const positions = [tipX, tipY, tipZ, (tipX + o.fishX) / 2, tipY * 0.45, (tipZ + o.fishZ) / 2, o.fishX, entry.bobber.position.y + 0.45, o.fishZ];
    if (!entry.line) {
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      entry.line = new Line(geometry, this.lineMaterial);
      this.root.add(entry.line);
    } else {
      const attr = entry.line.geometry.getAttribute('position') as Float32BufferAttribute;
      attr.set(positions);
      attr.needsUpdate = true;
      entry.line.geometry.computeBoundingSphere();
    }
  }

  private clear(entry: Entry): void {
    for (const f of entry.followers) f.group.removeFromParent();
    entry.line?.removeFromParent();
    entry.line?.geometry.dispose();
    entry.bobber?.removeFromParent();
  }

  dispose(): void {
    for (const entry of this.entries.values()) this.clear(entry);
    this.lineMaterial.dispose();
    this.root.removeFromParent();
  }
}
