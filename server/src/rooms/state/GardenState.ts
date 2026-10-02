import { MapSchema, Schema, type } from '@colyseus/schema';

/** One plant, in its garden's LOCAL frame. Growth is timestamps: every client computes the rest. */
export class PlantState extends Schema {
  @type('uint32') id = 0;
  @type('uint8') crop = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  /** Wall clock (ms) the current growth began: the planting, or the last harvest of a regrowing crop. */
  @type('float64') plantedAt = 0;
  /** Wall clock (ms) it is (or was) ready to harvest. Watering, sprinklers and rain pull it closer. */
  @type('float64') readyAt = 0;
  /** Mutation bits. */
  @type('uint16') mut = 0;
  /** Size roll: the fruit's weight is the crop's base weight times this. */
  @type('float32') size = 1;
  /** Times harvested: a regrowing crop that has been harvested stands fully grown. */
  @type('uint16') harvests = 0;
}

/** One placed decoration, garden-local, a quarter-turn rotation. */
export class DecorState extends Schema {
  @type('uint32') id = 0;
  @type('uint8') kind = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('uint8') rot = 0;
}

/** A sprinkler running in a garden until `endsAt`. */
export class SprinklerState extends Schema {
  @type('uint32') id = 0;
  @type('uint8') gear = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('float64') endsAt = 0;
}

/**
 * ONE OF THE FIFTEEN GARDENS. Empty until a player is given it; then it
 * holds their plants, decorations, sprinklers and house, for everyone to
 * visit.
 */
export class GardenState extends Schema {
  @type('uint8') slot = 0;
  /** The owner's session id, or '' for an empty garden. */
  @type('string') owner = '';
  @type('string') ownerName = '';
  @type('string') ownerAvatar = '';
  @type('uint32') likes = 0;
  /** What everything growing is worth right now, for the sign. */
  @type('float64') value = 0;
  @type('uint8') expansion = 0;
  @type('uint8') house = 0;
  @type({ map: PlantState }) plants = new MapSchema<PlantState>();
  @type({ map: DecorState }) decor = new MapSchema<DecorState>();
  @type({ map: SprinklerState }) sprinklers = new MapSchema<SprinklerState>();
}
