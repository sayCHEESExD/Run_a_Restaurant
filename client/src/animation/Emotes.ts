import { Euler, Quaternion } from 'three';
import { logger } from '../util/logger.js';
import type { PoseBuffer } from './PoseBuffer.js';
import type { PlayerRig } from './rig/PlayerRig.js';
import type { BoneName } from './rig/boneNames.js';

const SCOPE = 'emotes';

/** Bloxity's emote catalogue: fetched once at startup, grown without a game release. */
const CATALOGUE_URL = 'https://api.bloxity.io/v1/avatar/emotes';

/** Seconds to blend into (and out of) an emote rather than snapping to its pose. */
export const EMOTE_BLEND = 0.1;

/**
 * BLOXITY EMOTES, played on the avatar's rig.
 *
 * The players here wear Bloxity's own `player.glb`, and the catalogue's clips
 * are authored for it: per bone, keys of `[t, x, y, z]` DEGREES, deltas over
 * the bind pose, XYZ euler order, right-multiplied onto the bone's bind
 * quaternion (`bind * D`), eased between keys with smoothstep, clamped outside
 * the key range, looping on `t % len`.
 *
 * `PlayerRig` poses every bone as a CHARACTER-SPACE rotation over its bind
 * (that is what the procedural walk and the cooking actions are written in),
 * so a clip's local delta `D` is converted exactly: on a bone whose bind
 * orientation in character space is `W`, `bind * D` is the character-space
 * rotation `W * D * W^-1`. `W` is read off the live rig, never assumed, so the
 * conversion holds for whichever body is worn. The `_Offset` bones above each
 * upper arm are not bound by the rig; their rotation is composed (parent
 * first) onto that arm's `ArmX1`, with the offset's own bind - `ArmX1`'s
 * parent - as its `W`. Tracks for any other bone are ignored.
 */
const TARGETS: readonly (readonly [string, BoneName, 'self' | 'parent'])[] = [
  ['Spine1', 'Spine1', 'self'],
  ['Spine2', 'Spine2', 'self'],
  ['Neck1', 'Neck1', 'self'],
  ['ArmR_Offset', 'ArmR1', 'parent'],
  ['ArmR1', 'ArmR1', 'self'],
  ['ArmR2', 'ArmR2', 'self'],
  ['ArmL_Offset', 'ArmL1', 'parent'],
  ['ArmL1', 'ArmL1', 'self'],
  ['ArmL2', 'ArmL2', 'self'],
  ['LegR1', 'LegR1', 'self'],
  ['LegR2', 'LegR2', 'self'],
  ['LegL1', 'LegL1', 'self'],
  ['LegL2', 'LegL2', 'self'],
];

type Key = readonly [number, number, number, number];

interface Track {
  readonly target: BoneName;
  readonly bind: 'self' | 'parent';
  readonly keys: readonly Key[];
}

export interface Emote {
  readonly id: string;
  readonly name: string;
  readonly len: number;
  readonly loop: boolean;
  readonly tracks: readonly Track[];
}

/** Catalogue ids: 24 hex characters. Anything else is ignored before it reaches a lookup. */
export const isEmoteId = (id: unknown): id is string => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);

const emotes = new Map<string, Emote>();
let loading: Promise<void> | null = null;

const parseClip = (raw: unknown): Emote | null => {
  const entry = raw as { id?: unknown; name?: unknown; clip?: { len?: unknown; loop?: unknown; tracks?: unknown } } | null;
  if (!entry || !isEmoteId(entry.id) || !entry.clip || typeof entry.clip !== 'object') return null;
  const len = Number(entry.clip.len);
  if (!Number.isFinite(len) || len <= 0) return null;
  const tracksRaw = (entry.clip.tracks ?? {}) as Record<string, unknown>;
  const tracks: Track[] = [];
  for (const [source, target, bind] of TARGETS) {
    const keysRaw = tracksRaw[source];
    if (!Array.isArray(keysRaw)) continue;
    const keys = keysRaw
      .filter((key): key is number[] => Array.isArray(key) && key.length >= 4 && key.slice(0, 4).every((v) => typeof v === 'number' && Number.isFinite(v)))
      .map((key) => [key[0]!, key[1]!, key[2]!, key[3]!] as const)
      .sort((a, b) => a[0] - b[0]);
    if (keys.length > 0) tracks.push({ target, bind, keys });
  }
  return { id: entry.id.toLowerCase(), name: typeof entry.name === 'string' ? entry.name : entry.id, len, loop: entry.clip.loop !== false, tracks };
};

/** Fetch the catalogue once. A failure leaves emotes unavailable (and is retried on the next ask); nothing throws. */
export const loadEmotes = (): Promise<void> => {
  loading ??= fetch(CATALOGUE_URL)
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { emotes?: unknown[] } | unknown[];
      const list = Array.isArray(body) ? body : (body.emotes ?? []);
      for (const raw of list) {
        const emote = parseClip(raw);
        if (emote) emotes.set(emote.id, emote);
      }
      logger.info(SCOPE, `${emotes.size} emotes loaded`);
    })
    .catch((error: unknown) => {
      logger.warn(SCOPE, `emote catalogue unavailable: ${String(error)}`);
      loading = null;
    });
  return loading;
};

export const emoteById = (id: string): Emote | undefined => emotes.get(id.toLowerCase());

const EULER = new Euler();
const D = new Quaternion();
const C = new Quaternion();
const IDENTITY = new Quaternion();
const composed = new Map<BoneName, Quaternion>();
const pool: Quaternion[] = [];
const DEG = Math.PI / 180;
const DEGREES: [number, number, number] = [0, 0, 0];

/** One track's degrees at time t: clamped outside the keys, smoothstep between them. */
const sample = (keys: readonly Key[], t: number, out: [number, number, number]): void => {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  const hold = t <= first[0] ? first : t >= last[0] ? last : null;
  if (hold) {
    out[0] = hold[1];
    out[1] = hold[2];
    out[2] = hold[3];
    return;
  }
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1]![0] <= t) i += 1;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  let s = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
  s = s * s * (3 - 2 * s);
  out[0] = a[1] + (b[1] - a[1]) * s;
  out[1] = a[2] + (b[2] - a[2]) * s;
  out[2] = a[3] + (b[3] - a[3]) * s;
};

/** Write an emote's pose at `time` into a pose buffer (only the bones it drives), for this rig. */
export const writeEmotePose = (emote: Emote, time: number, pose: PoseBuffer, rig: PlayerRig): void => {
  const t = emote.loop ? ((time % emote.len) + emote.len) % emote.len : Math.min(time, emote.len);
  composed.clear();
  let used = 0;
  for (const track of emote.tracks) {
    const w = (track.bind === 'self' ? rig.bindOrientation(track.target) : rig.bindParentOrientation(track.target)) ?? null;
    if (!w && !rig.bindOrientation(track.target)) continue;
    sample(track.keys, t, DEGREES);
    EULER.set(DEGREES[0] * DEG, DEGREES[1] * DEG, DEGREES[2] * DEG, 'XYZ');
    D.setFromEuler(EULER);
    // The local delta as a character-space rotation: W * D * W^-1.
    const bind = w ?? IDENTITY;
    C.copy(bind).multiply(D);
    C.multiply(D.copy(bind).invert());
    const existing = composed.get(track.target);
    if (existing) existing.multiply(C);
    else {
      const q = (pool[used] ??= new Quaternion());
      used += 1;
      composed.set(track.target, q.copy(C));
    }
  }
  for (const [bone, q] of composed) {
    // PlayerRig applies Rz * Ry * Rx about the character axes: the ZYX euler of the rotation.
    EULER.setFromQuaternion(q, 'ZYX');
    pose.set(bone, EULER.x, EULER.y, EULER.z);
  }
};

/**
 * One character's emote: which one, how far in, and how strongly it holds the
 * body (blended in and out over `EMOTE_BLEND`). The body stops it the moment
 * the character moves, so it never fights the walk cycle.
 */
export class EmotePlayer {
  private emote: Emote | null = null;
  private time = 0;
  private weight = 0;
  private stopping = false;

  get active(): boolean {
    return this.emote !== null && !this.stopping;
  }

  /** Start an emote by catalogue id. An unknown id is ignored silently (false). */
  play(id: string): boolean {
    const emote = emoteById(id);
    if (!emote) return false;
    this.emote = emote;
    this.time = 0;
    this.stopping = false;
    return true;
  }

  stop(): void {
    if (this.emote) this.stopping = true;
  }

  /** Advance, and blend the emote over `pose` (the body's own animation) by its weight. */
  apply(dt: number, pose: PoseBuffer, scratch: PoseBuffer, rig: PlayerRig): void {
    const emote = this.emote;
    if (!emote) return;
    this.time += dt;
    const rate = dt / EMOTE_BLEND;
    this.weight = this.stopping ? Math.max(0, this.weight - rate) : Math.min(1, this.weight + rate);
    if (this.stopping && this.weight <= 0) {
      this.emote = null;
      this.stopping = false;
      return;
    }
    // Deltas over the BIND pose: the whole body blends toward bind + clip, so a bone the clip
    // leaves alone rests rather than holding a cooking pose from underneath.
    scratch.reset();
    writeEmotePose(emote, this.time, scratch, rig);
    pose.lerpBetween(pose, scratch, this.weight);
    // A one-shot that has played out lets go by itself.
    if (!emote.loop && this.time >= emote.len) this.stopping = true;
  }
}
