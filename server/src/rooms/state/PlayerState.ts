import { Schema, type } from '@colyseus/schema';
import { JUMP_VELOCITY, SPAWN, WALK_SPEED } from '@restaurant/shared';
import { AvatarState } from './AvatarState.js';

/**
 * Replicated per-player state: what EVERYBODY needs to draw this player.
 *
 * Every field is written by the SERVER: the transform by the authoritative
 * simulation, the rest by the room. A player's cash, items, fridge and skills
 * are NOT here - they travel to their own client alone, as the `Self` message.
 */
export class PlayerState extends Schema {
  @type('string') sessionId = '';

  @type('float32') x: number = SPAWN.x;
  @type('float32') y: number = SPAWN.y;
  @type('float32') z: number = SPAWN.z;
  @type('float32') rotationY: number = SPAWN.yaw;

  @type('float32') speed = 0;
  @type('float32') verticalVelocity = 0;
  @type('boolean') grounded = true;

  /** Authoritative velocity, for client reconciliation. */
  @type('float32') velocityX = 0;
  @type('float32') velocityY = 0;
  @type('float32') velocityZ = 0;
  @type('uint32') lastInputSeq = 0;
  @type('boolean') jumpLatched = false;
  @type('uint32') jumpCount = 0;

  @type(AvatarState) avatar = new AvatarState();
  @type('string') displayName = '';
  @type('string') avatarUrl = '';

  @type('float32') moveSpeed = WALK_SPEED;
  @type('float32') jumpVelocity = JUMP_VELOCITY;

  /** The restaurant plot this player owns (-1 before one is assigned). */
  @type('int8') slot = -1;
  /** Their restaurant's rank, for the name plate. */
  @type('uint8') rank = 0;

  /** What is in their hands, for everyone to see: 0 nothing, 1 a ticket, 2 a plate (of `carryRecipe`), 3 a dirty dish. */
  @type('uint8') carryKind = 0;
  @type('uint8') carryRecipe = 0;

  /** The pets following this player, by type ("1,6,9"). */
  @type('string') pets = '';

  /** Fishing: 0 not, 1 line in the water, 2 a bite - and where the bobber floats. */
  @type('uint8') fishing = 0;
  @type('float32') fishX = 0;
  @type('float32') fishZ = 0;

  /** The Bloxity emote playing ('' for none), and a count of emotes started so a repeat replays. */
  @type('string') emote = '';
  @type('uint16') emoteCount = 0;

  /** Restaurant actions, counted, so every client plays each one once. */
  @type('uint16') actionCount = 0;

  /** True once the server has simulated at least one input for this player. */
  @type('boolean') ready = false;
}
