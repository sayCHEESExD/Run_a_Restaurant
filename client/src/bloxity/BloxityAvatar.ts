import {
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  Quaternion,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Bone,
  type Object3D,
  type Texture,
} from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { neckScale } from '@restaurant/shared';
import { logger } from '../util/logger.js';
import {
  ACCESSORIES,
  DEFAULT_SKIN_URL,
  assetUrl,
  compositeSkinUrl,
  describeItem,
  type AccessorySlot,
} from './bloxityAssets.js';
import {
  isEquippedId,
  type LegionEquipped,
  type LegionProportions,
} from './legionTypes.js';

const SCOPE = 'bloxity/avatar';

/** Items hung on a bone like a hat (the head bone) or a back item (the upper spine). */
type HungSlot = 'hat' | 'hair' | 'mask' | 'back';
type Slot = HungSlot | AccessorySlot;

const HUNG_SLOTS: readonly HungSlot[] = ['hat', 'hair', 'mask', 'back'];
const ACCESSORY_SLOTS = Object.keys(ACCESSORIES) as AccessorySlot[];

/**
 * A pair item (hands, shoes) that follows its bone's POSITION and ROTATION
 * only: Bloxity's rule, so a proportion that scales the limb does not stretch
 * the glove. Re-placed every frame, after the pose, by `follow`.
 */
interface Follower {
  readonly object: Object3D;
  readonly bone: Bone;
  /** restInverse(bone) * [mirror] * translate(origin). */
  readonly local: Matrix4;
}

/**
 * Bloxity cosmetics, applied to one character.
 *
 *  - the SKIN, as a texture swap on the body's own material - composed by
 *    Bloxity with the worn face, shirt and pants painted on when any is worn;
 *  - the HAT, HAIR and MASK on the head bone (0.8 up it, worn together) and
 *    the BACK item on the upper spine;
 *  - the NECK, CHEST and WAIST accessories under their spine bone, and the
 *    HAND and SHOES pairs following the limb leaves, exactly where Bloxity's
 *    renderer puts them (`ACCESSORIES`);
 *  - the PROPORTIONS, as scales and offsets on those same bones (so whatever
 *    hangs on a bone follows them).
 *
 * The body PARTS are not applied here: those replace geometry on the body
 * itself and so belong to whatever built it - see `BloxityRiderFactory`. This
 * class dresses whichever body is currently mounted, Bloxity body or bundled
 * `player.fbx`, which is why `rebind` exists. Body accessories are authored
 * for `player.glb`'s space and are worn on the Bloxity body only.
 *
 * Every asset path comes from Bloxity's item catalogue rather than from a
 * pattern spelled out here. An id is looked up, its `assetPaths` are used
 * verbatim, and an item the catalogue does not know is simply not worn.
 */
export class BloxityAvatar {
  private riderVisual: Group;
  private riderModel: Object3D;
  private bones: ReadonlyMap<string, Bone>;
  /** True while the rider is a Bloxity body rather than the bundled one. */
  private wearingBloxityBody = false;

  /** The rider's own material, cloned so remote players keep the default. */
  private material: MeshStandardMaterial | null = null;
  /** The texture the model shipped with, to go back to when a skin is removed. */
  private defaultMap: Texture | null = null;

  /** What hangs in each slot (a pair is two objects). */
  private readonly attachments = new Map<Slot, Object3D[]>();
  private readonly followers: Follower[] = [];
  private readonly loadedTextures: Texture[] = [];
  /**
   * Each bone's rest transform in MODEL space, inverted - captured right after
   * a Bloxity body is mounted, before any animation or proportion touches it.
   * NOT `skeleton.boneInverses`: the leaf bones' inverse binds in player.glb are
   * 90 degrees off their rest pose, which would put hand items sideways.
   */
  private restInverse = new Map<string, Matrix4>();

  /*
   * What is currently WORN in each slot.
   *
   * THREE states, not two: absent (`undefined`) means "nothing has been
   * applied to this body yet", `null` means "applied, and the answer was none".
   *
   * Collapsing those two is a real bug and it shipped. A rebind used to set
   * these to `null` to mean "re-wear everything", but for a player with no
   * skin equipped the WANTED value is also `null` - so the comparison matched,
   * the load was skipped, and a freshly built Bloxity body was left with no
   * texture at all, which renders white.
   */
  private currentSkin: string | null | undefined = undefined;
  private readonly worn = new Map<Slot, string | null>();

  private readonly objLoader = new OBJLoader();
  private readonly textureLoader = new TextureLoader();

  private disposed = false;

  constructor(riderVisual: Group, riderModel: Object3D) {
    this.riderVisual = riderVisual;
    this.riderModel = riderModel;
    this.bones = collectBones(riderModel);
    this.material = this.cloneRiderMaterial(riderModel);
    this.defaultMap = this.material?.map ?? null;
  }

  /**
   * Wear what the account has equipped.
   *
   * Safe to call on every avatar event: each slot is compared against what is
   * already worn, so the common case - a proportions change - touches no
   * network at all.
   */
  apply(equipped: LegionEquipped, proportions: LegionProportions): void {
    if (this.disposed) return;

    this.applySkin(equipped);
    void this.applyItem('hat', equipped.hatId ?? null);
    void this.applyItem('hair', equipped.hairId ?? null);
    void this.applyItem('mask', equipped.maskId ?? null);
    void this.applyItem('back', equipped.backId ?? null);
    for (const slot of ACCESSORY_SLOTS) void this.applyAccessory(slot, equipped[`${slot}Id`] ?? null);
    this.applyProportions(proportions);
  }

  /**
   * Follow the rider onto a new body.
   *
   * Called when the mount swaps in a Bloxity avatar, or swaps back to the
   * bundled one. Everything this class holds is bound to a particular model -
   * the bones it hangs items on, the material it re-skins - so a swap has to
   * re-collect all of it and then re-wear what was already worn, which is what
   * forgetting every slot arranges: the next `apply` sees every slot as
   * changed and puts it back on the new body.
   */
  rebind(riderVisual: Group, riderModel: Object3D, bloxityBody: boolean): void {
    this.removeAll();

    this.riderVisual = riderVisual;
    this.riderModel = riderModel;
    this.bones = collectBones(riderModel);
    this.material = this.cloneRiderMaterial(riderModel);
    this.defaultMap = this.material?.map ?? null;
    this.wearingBloxityBody = bloxityBody;
    this.restInverse = bloxityBody ? captureRestInverse(riderModel, this.bones) : new Map();

    // UNDEFINED, not null: "not applied to this body yet". See the fields.
    this.currentSkin = undefined;
    this.worn.clear();
  }

  /**
   * Place the hand and shoe pairs on this frame's pose: `compose(bone
   * position, bone rotation, scale 1) * local`, in model space. Called by the
   * character right after its pose is written; free when none is worn.
   */
  follow(): void {
    if (this.followers.length === 0) return;
    const model = this.riderModel;
    model.updateMatrixWorld(true);
    MODEL_INVERSE.copy(model.matrixWorld).invert();
    for (const follower of this.followers) {
      BONE_IN_MODEL.multiplyMatrices(MODEL_INVERSE, follower.bone.matrixWorld).decompose(POSITION, ROTATION, SCALE);
      follower.object.matrix.compose(POSITION, ROTATION, ONE).multiply(follower.local);
      follower.object.matrixWorldNeedsUpdate = true;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.removeAll();
    for (const texture of this.loadedTextures) texture.dispose();
    this.loadedTextures.length = 0;
    this.material?.dispose();
    this.material = null;
  }

  private removeAll(): void {
    for (const [, nodes] of this.attachments) for (const node of nodes) node.removeFromParent();
    this.attachments.clear();
    this.followers.length = 0;
  }

  private remove(slot: Slot): void {
    for (const node of this.attachments.get(slot) ?? []) {
      node.removeFromParent();
      const at = this.followers.findIndex((follower) => follower.object === node);
      if (at >= 0) this.followers.splice(at, 1);
    }
    this.attachments.delete(slot);
  }

  /** Mark a slot as wanting `id`; false when it already does (nothing to do). */
  private claim(slot: Slot, raw: string | null | undefined): { changed: boolean; wanted: string | null } {
    const wanted = isEquippedId(raw ?? null) ? (raw as string) : null;
    if (this.worn.has(slot) && this.worn.get(slot) === wanted) return { changed: false, wanted };
    this.worn.set(slot, wanted);
    this.remove(slot);
    return { changed: true, wanted };
  }

  // ------------------------------------------------------------------ skin

  private applySkin(equipped: LegionEquipped): void {
    const skinId = isEquippedId(equipped.skinId ?? null) ? (equipped.skinId as string) : '';
    // A face, shirt or pants makes the skin a composite; the key is whichever URL that is.
    const composite = compositeSkinUrl({
      skinId,
      faceId: equipped.faceId ?? '',
      shirtId: equipped.shirtId ?? '',
      pantsId: equipped.pantsId ?? '',
    });
    const wanted = composite ?? (skinId || null);
    if (wanted === this.currentSkin) return;
    this.currentSkin = wanted;
    void this.loadSkin(wanted, composite !== null);
  }

  /**
   * Put a skin on the body.
   *
   * A Bloxity body with no skin equipped is not bare - it wears Bloxity's own
   * default, which is what their renderer falls back to. The bundled rider
   * instead goes back to the texture it shipped with, because a Bloxity skin
   * is authored for a different UV layout entirely.
   */
  private async loadSkin(wanted: string | null, composite: boolean): Promise<void> {
    const material = this.material;
    if (!material) return;

    let url: string | null = null;
    if (composite) {
      // Already a URL: Bloxity's compositor, with the face, shirt and pants painted on.
      url = wanted;
    } else if (wanted) {
      const item = await describeItem(wanted);
      const path = item?.assetPaths?.texture;
      if (path) url = assetUrl(path);
    } else if (this.wearingBloxityBody) {
      url = DEFAULT_SKIN_URL;
    }

    // Still wanted? The player may have changed skin while this was in flight.
    if (this.disposed || this.currentSkin !== wanted) return;

    if (!url) {
      material.map = this.defaultMap;
      material.needsUpdate = true;
      return;
    }

    this.textureLoader.load(
      url,
      (texture) => {
        if (this.disposed || this.currentSkin !== wanted) {
          texture.dispose();
          return;
        }
        texture.colorSpace = SRGBColorSpace;
        texture.flipY = false;
        // Bloxity skins are 64x64 pixel art. Smoothing them turns a face into
        // a smudge, which is why their own renderer filters them this way too.
        texture.magFilter = NearestFilter;
        texture.minFilter = NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        this.loadedTextures.push(texture);
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      () => logger.warn(SCOPE, `skin ${wanted ?? 'default'} failed to load`),
    );
  }

  // ------------------------------------------------------------------ items

  /**
   * Load one catalogue item's mesh with its texture.
   *
   * NO `flipY = false` on the texture, unlike the skin: the skin is applied to
   * the GLB body, and glTF puts the UV origin at the TOP left, while an item is
   * an OBJ, whose origin is at the BOTTOM left - three.js's default. Forcing
   * the glTF rule onto it flipped every item vertically into smeared garbage.
   * Bloxity's own renderer sets `flipY` on the skin and nowhere else.
   */
  private async loadItem(slot: Slot, id: string): Promise<Object3D | null> {
    const item = await describeItem(id);
    const meshPath = item?.assetPaths?.mesh;
    const texturePath = item?.assetPaths?.texture;
    if (!meshPath || !texturePath) {
      logger.warn(SCOPE, `${slot} ${id} has no mesh in the catalogue`);
      return null;
    }
    try {
      const object = await this.objLoader.loadAsync(assetUrl(meshPath));
      const texture = await this.textureLoader.loadAsync(assetUrl(texturePath));
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      this.loadedTextures.push(texture);
      const material = new MeshStandardMaterial({ map: texture, roughness: 0.85 });
      object.traverse((child) => {
        if (child instanceof Mesh) {
          child.material = material;
          child.castShadow = true;
        }
      });
      return object;
    } catch {
      logger.warn(SCOPE, `${slot} ${id} failed to load`);
      return null;
    }
  }

  /**
   * Parent a hat, hair, a mask or a back item to a real bone.
   *
   * To a BONE, not to the rider group: an item hung off the group would keep
   * its own idea of where the head is while the head moved. Hair and masks are
   * their own slots, worn TOGETHER with a hat, and placed exactly like one.
   */
  private async applyItem(slot: HungSlot, id: string | null): Promise<void> {
    const { changed, wanted } = this.claim(slot, id);
    if (!changed || !wanted) return;

    const anchor = this.bones.get(slot === 'back' ? 'Spine2' : 'Neck1');
    if (!anchor) {
      logger.warn(SCOPE, `no bone to hang a ${slot} on`);
      return;
    }
    const object = await this.loadItem(slot, wanted);
    // Still wanted, on the same body? The player may have changed it while this was in flight.
    if (!object || this.disposed || this.worn.get(slot) !== wanted || !this.bones.has(anchor.name) || this.bones.get(anchor.name) !== anchor) return;

    // An item is sized against the BONE it hangs on, and the two bodies do
    // not share a bone space: `player.fbx` is authored in centimetres and
    // scaled down on load, while the Bloxity body is the rig these items
    // were made for. So a Bloxity body gets Bloxity's own numbers - scale 1,
    // a head item lifted 0.8 up the head bone, a back item on the spine -
    // and the bundled body keeps the values tuned for it.
    const native = this.wearingBloxityBody;
    object.scale.setScalar(native ? 1 : ITEM_SCALE);
    if (slot === 'back') object.position.set(0, 0, native ? 0 : BACK_OFFSET);
    else object.position.set(0, native ? BLOXITY_HAT_LIFT : HAT_LIFT, 0);

    anchor.add(object);
    this.attachments.set(slot, [object]);
    logger.info(SCOPE, `wearing ${slot} ${wanted}`);
  }

  /**
   * A body accessory where Bloxity puts it. Neck, chest and waist hang under
   * their bone at `restInverse(bone) * translate(origin)`; hands and shoes are
   * a pair - the mesh on the left leaf and a copy mirrored across x on the
   * right - that follow position and rotation only (see `follow`).
   */
  private async applyAccessory(slot: AccessorySlot, id: string | null): Promise<void> {
    const { changed, wanted } = this.claim(slot, id);
    if (!changed || !wanted || !this.wearingBloxityBody) return;

    const spec = ACCESSORIES[slot];
    const bones = this.bones;
    const object = await this.loadItem(slot, wanted);
    if (!object || this.disposed || this.worn.get(slot) !== wanted || this.bones !== bones) return;

    const [x, y, z] = spec.origin;
    const origin = new Matrix4().makeTranslation(x, y, z);
    const place = (copy: Object3D, boneName: string, mirror: boolean): boolean => {
      const bone = bones.get(boneName);
      const rest = this.restInverse.get(boneName);
      if (!bone || !rest) return false;
      const local = rest.clone();
      if (mirror) local.multiply(MIRROR);
      local.multiply(origin);
      copy.matrixAutoUpdate = false;
      if (spec.pair) {
        // Position and rotation only: lives in model space, re-placed every frame.
        this.riderModel.add(copy);
        this.followers.push({ object: copy, bone, local });
        copy.matrix.copy(local);
      } else {
        copy.matrix.copy(local);
        bone.add(copy);
      }
      return true;
    };

    const placed: Object3D[] = [];
    if (place(object, spec.bone, false)) placed.push(object);
    if (spec.pair) {
      const mirrored = object.clone();
      if (place(mirrored, spec.pair, true)) placed.push(mirrored);
    }
    if (placed.length === 0) {
      logger.warn(SCOPE, `no bone to wear ${slot} on`);
      return;
    }
    this.attachments.set(slot, placed);
    this.follow();
    logger.info(SCOPE, `wearing ${slot} ${wanted}`);
  }

  // ----------------------------------------------------------- proportions

  /**
   * Apply the account's proportions.
   *
   * Scale and POSITION only - never rotation. `PlayerRig` rebuilds every
   * bone's quaternion from its rest pose on every single frame, so a rotation
   * written here would be gone before it was drawn; scale and position are
   * untouched by it and therefore survive. These MOVE the bones, so items hung
   * on them follow automatically.
   */
  private applyProportions(p: LegionProportions): void {
    const num = (value: number, fallback = 1): number =>
      Number.isFinite(value) && value > 0 ? value : fallback;

    this.riderVisual.scale.setScalar(num(p.height));

    const spine1 = this.bones.get('Spine1');
    if (spine1) spine1.scale.x = num(p.torsoScaleX);

    const spine2 = this.bones.get('Spine2');
    if (spine2) spine2.scale.x = num(p.shoulderWidth);

    /*
     * The portal's head proportion, TIMES this game's own (`neckScale`
     * multiplies the two), so a player's own choice still does what they chose
     * without undoing the enlargement the camera framing needs.
     */
    const neck = this.bones.get('Neck1');
    if (neck) neck.scale.setScalar(neckScale(num(p.headScale)));

    for (const name of ['ArmL1', 'ArmR1'] as const) {
      const bone = this.bones.get(name);
      if (bone) bone.scale.y = num(p.armLength);
    }

    // `legOffsetX` moves the legs apart rather than scaling them.
    const straddle = Number.isFinite(p.legOffsetX) ? p.legOffsetX : 1;
    for (const [name, side] of [['LegL1', 1], ['LegR1', -1]] as const) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      if (bone.userData['restX'] === undefined) bone.userData['restX'] = bone.position.x;
      bone.position.x = (bone.userData['restX'] as number) + side * (straddle - 1) * LEG_SPREAD;
    }
  }

  /**
   * Give this rider its own material.
   *
   * Every instance shares ONE material by design, which is exactly right until
   * one of them needs a different skin - at which point writing to it would
   * re-skin every other player too.
   */
  private cloneRiderMaterial(model: Object3D): MeshStandardMaterial | null {
    let cloned: MeshStandardMaterial | null = null;
    model.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const material = child.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      cloned ??= material.clone();
      child.material = cloned;
    });
    return cloned;
  }
}

/** How big a CDN item is, in the bone space it hangs in (bundled body). */
const ITEM_SCALE = 0.9;
/** A head item sits above the head bone's origin, on the bundled body. */
const HAT_LIFT = 0.55;
/**
 * The same lift on a Bloxity body: Bloxity's own figure - their renderer
 * parents hats, hair and masks to the head bone at `(0, 0.8, 0)`.
 */
const BLOXITY_HAT_LIFT = 0.8;
/** A back item sits behind the chest (bundled body). */
const BACK_OFFSET = -0.35;
/** World units the legs move apart per unit of `legOffsetX`. */
const LEG_SPREAD = 0.12;

const MIRROR = new Matrix4().makeScale(-1, 1, 1);
const MODEL_INVERSE = new Matrix4();
const BONE_IN_MODEL = new Matrix4();
const POSITION = new Vector3();
const ROTATION = new Quaternion();
const SCALE = new Vector3();
const ONE = new Vector3(1, 1, 1);

/** The rig's bones, by name. Same first-bone rule `PlayerRig` uses. */
const collectBones = (model: Object3D): Map<string, Bone> => {
  const found = new Map<string, Bone>();
  model.traverse((child) => {
    const bone = child as Bone;
    if (bone.isBone && !found.has(bone.name)) found.set(bone.name, bone);
  });
  return found;
};

/** `inverse(inverse(model.matrixWorld) * bone.matrixWorld)` for every accessory bone, in the bind pose. */
const captureRestInverse = (model: Object3D, bones: ReadonlyMap<string, Bone>): Map<string, Matrix4> => {
  model.updateMatrixWorld(true);
  const modelInverse = model.matrixWorld.clone().invert();
  const out = new Map<string, Matrix4>();
  for (const spec of Object.values(ACCESSORIES)) {
    for (const name of [spec.bone, spec.pair]) {
      const bone = name ? bones.get(name) : undefined;
      if (!bone || out.has(bone.name)) continue;
      out.set(bone.name, new Matrix4().multiplyMatrices(modelInverse, bone.matrixWorld).invert());
    }
  }
  return out;
};
