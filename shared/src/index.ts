/**
 * @restaurant/shared - the single source of truth for anything that must be
 * byte-for-byte identical between the client and the authoritative server.
 *
 * Nothing in here may import from `three`, `colyseus`, or the DOM.
 */
export * from './constants/network.js';
export * from './constants/world.js';
export * from './config/accounts.js';
export * from './config/camera.js';
export * from './config/customers.js';
export * from './config/economy.js';
export * from './config/fishing.js';
export * from './config/pets.js';
export * from './config/format.js';
export * from './config/handles.js';
export * from './config/items.js';
export * from './config/movement.js';
export * from './config/nav.js';
export * from './config/placement.js';
export * from './config/plot.js';
export * from './config/ranks.js';
export * from './config/rarity.js';
export * from './config/recipes.js';
export * from './config/shop.js';
export * from './config/skills.js';
export * from './config/staff.js';
export * from './config/tasks.js';
export * from './config/town.js';
export * from './types/avatar.js';
export * from './types/identity.js';
export * from './types/math.js';
export * from './types/messages.js';
export * from './types/player.js';
export * from './types/profile.js';
export * from './util/random.js';
export * from './sim/WorldCollision.js';
export * from './sim/PlayerSim.js';
