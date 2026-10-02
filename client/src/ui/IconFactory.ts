import { eggById, fishById, itemById, staffById } from '@restaurant/shared';
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
  type Object3D,
  type WebGLRenderer,
} from 'three';
import { buildDish, buildIngredient } from '../models/food.js';
import { buildArt, type ArtKey } from '../models/icons.js';
import { buildAnimal, buildCrop, buildItem } from '../models/items.js';
import { buildEgg, buildFish, buildPet } from '../models/pets.js';
import { CUSTOMER_LOOKS, NpcCharacter, staffLook } from '../player/NpcCharacter.js';
import { PartBuilder } from '../render/PartBuilder.js';

const SIZE = 128;

/**
 * ICONS DRAWN FROM THE MODELS THEMSELVES: every item, dish, ingredient,
 * customer, staff member and piece of UI art is rendered once, off screen,
 * into a small picture - so the stove in the Shop is exactly the stove in the
 * kitchen, and there is no icon atlas to ship. Rendered lazily, then cached.
 */
export class IconFactory {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(30, 1, 0.1, 200);
  private readonly target = new WebGLRenderTarget(SIZE, SIZE);
  private readonly cache = new Map<string, string>();
  private readonly pixels = new Uint8Array(SIZE * SIZE * 4);
  private readonly canvas = document.createElement('canvas');
  private readonly holder = new Group();

  constructor(private readonly renderer: WebGLRenderer) {
    this.target.texture.colorSpace = SRGBColorSpace;
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    this.scene.add(new AmbientLight(0xffffff, 1.5));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new DirectionalLight(0xfff0d8, 0.9);
    rim.position.set(-4, 2, -3);
    this.scene.add(rim);
    this.scene.add(this.holder);
  }

  item(id: number): string {
    return this.icon(`item:${id}`, () => {
      const def = itemById(id);
      const b = new PartBuilder();
      if (def?.category === 'structure') {
        const colors = def.colors ?? [0xffffff];
        for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) b.box(1, 0.2, 1, colors[(i + j) % colors.length]!, 'smooth', { x: i - 1, z: j - 1 });
        if (def.role === 'wall') b.box(3, 2, 0.3, colors[0]!, 'smooth', { y: 1, z: -1.5 });
      } else if (def) {
        buildItem(b, id);
        if (def.role === 'crop' && def.produces) buildCrop(b, def.produces, 1);
        if (def.role === 'animal' && def.produces) buildAnimal(b, def.produces);
      }
      const group = b.build('icon');
      group.rotation.y = Math.PI;
      return group;
    });
  }

  dish(recipe: number): string {
    return this.icon(`dish:${recipe}`, () => {
      const b = new PartBuilder();
      buildDish(b, recipe);
      return b.build('icon');
    });
  }

  ingredient(id: number): string {
    return this.icon(`ingredient:${id}`, () => {
      const b = new PartBuilder();
      buildIngredient(b, id);
      return b.build('icon');
    });
  }

  pet(type: number): string {
    return this.icon(`pet:${type}`, () => {
      const b = new PartBuilder();
      buildPet(b, type);
      const group = b.build('icon');
      group.rotation.y = 0.9;
      return group;
    });
  }

  egg(id: number): string {
    return this.icon(`egg:${id}`, () => {
      const egg = eggById(id);
      const b = new PartBuilder();
      buildEgg(b, egg?.color ?? 0xffffff, egg?.spots ?? 0x8ad06a);
      return b.build('icon');
    });
  }

  fish(id: number): string {
    return this.icon(`fish:${id}`, () => {
      const b = new PartBuilder();
      buildFish(b, fishById(id)?.color ?? 0x7aa8d8);
      const group = b.build('icon');
      group.rotation.y = Math.PI / 2 + 0.6;
      return group;
    });
  }

  art(key: ArtKey): string {
    return this.icon(`art:${key}`, () => {
      const b = new PartBuilder();
      buildArt(b, key);
      return b.build('icon');
    });
  }

  /** A customer's portrait: head and shoulders. Rendered lazily (a body is not cheap): see `pump`. */
  customer(type: number): string {
    return this.lazy(`customer:${type}`, () => new NpcCharacter(CUSTOMER_LOOKS[type] ?? CUSTOMER_LOOKS[1]!).root);
  }

  staff(member: number): string {
    return this.lazy(`staff:${member}`, () => new NpcCharacter(staffLook(staffById(member)?.role ?? 'waiter', member)).root);
  }

  private readonly queue = new Map<string, () => Object3D>();

  /** A cached portrait, or a "pending:" reference the <img> helper fills in once `pump` has drawn it. */
  private lazy(key: string, build: () => Object3D): string {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    if (!this.queue.has(key)) this.queue.set(key, build);
    return `pending:${key}`;
  }

  /** Draw a couple of queued portraits (call once a frame) and hand them to the images waiting for them. */
  pump(budget = 2): void {
    for (const [key, build] of this.queue) {
      if (budget-- <= 0) break;
      this.queue.delete(key);
      const url = this.render(build(), true);
      this.cache.set(key, url);
      document.querySelectorAll<HTMLImageElement>(`img[data-icon="${key}"]`).forEach((img) => {
        img.src = url;
        delete img.dataset['icon'];
      });
    }
  }

  private icon(key: string, build: () => Object3D, portrait = false): string {
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const url = this.render(build(), portrait);
    this.cache.set(key, url);
    return url;
  }

  private render(object: Object3D, portrait: boolean): string {
    this.holder.clear();
    this.holder.add(object);
    object.rotation.y += portrait ? 0.35 : -0.6;
    object.updateMatrixWorld(true);
    const raw = new Box3().setFromObject(object).getSize(new Vector3());
    object.scale.multiplyScalar(4 / Math.max(0.05, raw.x, raw.y, raw.z));
    object.updateMatrixWorld(true);
    const box = new Box3().setFromObject(object);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    let radius = Math.max(size.x, size.y, size.z) * 0.62 + 0.001;
    if (portrait) {
      // Head and shoulders: the top third of the body.
      centre.y = box.max.y - size.y * 0.24;
      radius = size.y * 0.27;
    }
    const distance = radius / Math.tan((this.camera.fov * Math.PI) / 360);
    if (portrait) this.camera.position.set(centre.x + distance * 0.25, centre.y + distance * 0.08, centre.z + distance * 0.96);
    else this.camera.position.set(centre.x + distance * 0.35, centre.y + distance * 0.35, centre.z + distance * 0.87);
    this.camera.lookAt(centre);
    this.camera.near = distance * 0.1;
    this.camera.far = distance * 4;
    this.camera.updateProjectionMatrix();

    const previousTarget = this.renderer.getRenderTarget();
    const previousClear = this.renderer.getClearAlpha();
    this.renderer.setRenderTarget(this.target);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, this.pixels);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearAlpha(previousClear);

    const ctx = this.canvas.getContext('2d')!;
    const image = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 1) {
      image.data.set(this.pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    }
    ctx.putImageData(image, 0, 0);
    this.holder.remove(object);
    if (!portrait) {
      object.traverse((child) => {
        const mesh = child as unknown as { isMesh?: boolean; geometry?: { dispose(): void } };
        if (mesh.isMesh) mesh.geometry?.dispose();
      });
    }
    return this.canvas.toDataURL('image/png');
  }

  dispose(): void {
    this.target.dispose();
  }
}
