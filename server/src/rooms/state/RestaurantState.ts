import { MapSchema, Schema, type } from '@colyseus/schema';

/**
 * One placed item, plot-local, a quarter-turn rotation. The three spare
 * fields carry each kind's live state, so nothing else needs a schema:
 *
 *   stove      a = when the dish is done (ms), c = the order cooking
 *   sink       a = when the next dish is clean (ms), b = dishes waiting
 *   chair      b = 1 while a dirty dish sits at it
 *   crop       a = when it is ripe (ms)
 *   animal     a = when the next produce comes (ms), b = produce waiting
 */
export class ItemState extends Schema {
  @type('uint32') id = 0;
  @type('uint16') kind = 0;
  @type('float32') x = 0;
  @type('float32') z = 0;
  @type('uint8') rot = 0;
  @type('float64') a = 0;
  @type('uint16') b = 0;
  @type('uint32') c = 0;
}

/**
 * A customer. Where they are is NOT sent every tick: they walk a PATH (plot-
 * local waypoints) that started at `t0` at `speed`, and every client places
 * them along it from the shared clock. `phase` says what they are doing.
 */
export class CustomerState extends Schema {
  @type('uint32') id = 0;
  @type('uint8') type = 0;
  /** CUSTOMER_PHASE. */
  @type('uint8') phase = 0;
  /** The chair (item id) they sit at, once seated. */
  @type('uint32') seat = 0;
  /** What they ordered (recipe id), once ordered. */
  @type('uint8') recipe = 0;
  @type('string') path = '';
  @type('float64') t0 = 0;
  @type('float32') speed = 0;
  /** When the current wait runs out (browsing, patience, eating), ms. */
  @type('float64') until = 0;
  /** Facing once arrived (seated customers face their table). */
  @type('float32') face = 0;
}

/** A staff member at work: the same walking scheme as a customer, and what they hold. */
export class StaffState extends Schema {
  @type('uint32') id = 0;
  /** The roster entry (STAFF id). */
  @type('uint8') member = 0;
  @type('uint8') level = 1;
  @type('string') path = '';
  @type('float64') t0 = 0;
  @type('float32') speed = 0;
  /** 0 standing or walking, 1 working at something. */
  @type('uint8') pose = 0;
  @type('float32') face = 0;
  /** CARRY kind, and the recipe on a plate. */
  @type('uint8') carry = 0;
  @type('uint8') carryRecipe = 0;
}

/** An order: a ticket on the stand, in a hand, on a stove, a plate on the stand or in a hand. */
export class OrderState extends Schema {
  @type('uint32') id = 0;
  @type('uint32') customer = 0;
  @type('uint8') recipe = 0;
  /** ORDER_STAGE. */
  @type('uint8') stage = 0;
  /** When it went up on the stand (ms), so the oldest is taken first. */
  @type('float64') at = 0;
}

/**
 * ONE OF THE FIFTEEN RESTAURANTS. Empty until a player is given it; then it
 * holds their furniture, their customers, their staff and their orders, for
 * everyone to visit.
 */
export class RestaurantState extends Schema {
  @type('uint8') slot = 0;
  /** The owner's session id, or '' for an empty lot. */
  @type('string') owner = '';
  @type('string') ownerName = '';
  @type('string') ownerAvatar = '';
  @type('uint8') rank = 0;
  @type('uint32') rankPoints = 0;
  @type('uint32') served = 0;
  @type('float32') rating = 0;
  @type('uint32') likes = 0;
  @type('uint8') tier = 0;
  @type('uint16') floor = 0;
  @type('uint16') wall = 0;
  /** Cash waiting in the register. */
  @type('float64') register = 0;
  @type({ map: ItemState }) items = new MapSchema<ItemState>();
  @type({ map: CustomerState }) customers = new MapSchema<CustomerState>();
  @type({ map: StaffState }) staff = new MapSchema<StaffState>();
  @type({ map: OrderState }) orders = new MapSchema<OrderState>();
}
