import type { Rarity } from './rarity.js';

/**
 * EVERYTHING A RESTAURANT CAN OWN: furniture, appliances, decorations, farm
 * plots, ranch pens and structure styles. One catalog, read by the Shop (its
 * shelves and display plinths), the placement rules, the simulation and the
 * renderer (which builds each model by `key`).
 *
 * Sizes are in GRID CELLS of one unit. At rotation 0 an item's front faces
 * -Z (toward the restaurant's door), so a stove pushed against the back wall
 * faces the room.
 */

export type Category = 'furniture' | 'appliances' | 'decor' | 'farming' | 'ranching' | 'fishing' | 'structure';

export const CATEGORIES: readonly { id: Category; name: string }[] = [
  { id: 'furniture', name: 'Furniture' },
  { id: 'appliances', name: 'Appliances' },
  { id: 'decor', name: 'Decor' },
  { id: 'farming', name: 'Farming' },
  { id: 'ranching', name: 'Ranching' },
  { id: 'fishing', name: 'Fishing' },
  { id: 'structure', name: 'Structure' },
];

export type ItemRole =
  | 'chair'
  | 'table'
  | 'counter'
  | 'stove'
  | 'fridge'
  | 'sink'
  | 'stand'
  | 'register'
  | 'decor'
  | 'rug'
  | 'crop'
  | 'sprinkler'
  | 'animal'
  | 'feeder'
  | 'rod'
  | 'floor'
  | 'wall';

/** Where an item may stand: in the restaurant, the farm, the ranch, the lawn, or in or out. */
export type Zone = 'interior' | 'farm' | 'ranch' | 'outdoor' | 'any' | 'none';

export interface ItemDef {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly desc: string;
  readonly category: Category;
  readonly role: ItemRole;
  readonly rarity: Rarity;
  /** Cash price; 0 with `diamonds` set for a premium item. */
  readonly price: number;
  readonly diamonds?: number;
  readonly w: number;
  readonly d: number;
  /** Height of its solid (and what a customer's plate sits on, for tables). */
  readonly h: number;
  /** Blocks walking. Chairs, rugs and crop beds do not (they are kept off the walk grid separately). */
  readonly solid: boolean;
  readonly zone: Zone;
  /** Rank points it adds while placed (or applied). */
  readonly quality: number;
  /** Stove: cook speed. Sink: wash speed. Sprinkler/feeder: boost. */
  readonly speed?: number;
  /** Fridge: ingredients held. Sink: dishes queued. Register: offline cash held. Animal: products stored. */
  readonly capacity?: number;
  /** Crop / animal: the ingredient produced, seconds per cycle and how many per cycle. */
  readonly produces?: number;
  readonly seconds?: number;
  readonly yield?: number;
  /** Least rank index to buy. */
  readonly rank?: number;
  /** Least skill level to buy: [skill index, level]. */
  readonly skill?: readonly [number, number];
  /** Most of these one restaurant may place. */
  readonly limit?: number;
  /** Tips bonus (order stands). */
  readonly tips?: number;
  /** Structure styles: the colours applied. */
  readonly colors?: readonly number[];
}

const item = (def: ItemDef): ItemDef => def;

export const ITEMS: readonly ItemDef[] = [
  // ----------------------------------------------------------- furniture
  item({ id: 1, key: 'wooden_chair', name: 'Wooden Chair', desc: 'Comfortable seating for your restaurant customers', category: 'furniture', role: 'chair', rarity: 'common', price: 50, w: 2, d: 2, h: 2.4, solid: false, zone: 'interior', quality: 1 }),
  item({ id: 2, key: 'wooden_stool', name: 'Wooden Stool', desc: 'A simple stool. It does the job!', category: 'furniture', role: 'chair', rarity: 'common', price: 50, w: 2, d: 2, h: 1.6, solid: false, zone: 'interior', quality: 1 }),
  item({ id: 3, key: 'wooden_table', name: 'Wooden Table', desc: 'A sturdy table for up to four diners', category: 'furniture', role: 'table', rarity: 'common', price: 75, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 2 }),
  item({ id: 4, key: 'dark_chair', name: 'Dark Wood Chair', desc: 'Polished dark wood with a tall back', category: 'furniture', role: 'chair', rarity: 'uncommon', price: 100, w: 2, d: 2, h: 2.6, solid: false, zone: 'interior', quality: 2 }),
  item({ id: 5, key: 'dark_table', name: 'Dark Wood Table', desc: 'Elegant dark wood dining table', category: 'furniture', role: 'table', rarity: 'uncommon', price: 100, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 3 }),
  item({ id: 6, key: 'diner_chair', name: 'Diner Chair', desc: 'Retro red cushions and chrome legs', category: 'furniture', role: 'chair', rarity: 'uncommon', price: 300, w: 2, d: 2, h: 2.4, solid: false, zone: 'interior', quality: 3, rank: 1 }),
  item({ id: 7, key: 'diner_table', name: 'Diner Table', desc: 'A checkered classic from the fifties', category: 'furniture', role: 'table', rarity: 'uncommon', price: 400, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 4, rank: 1 }),
  item({ id: 8, key: 'modern_chair', name: 'Modern Chair', desc: 'Sleek, minimal and comfy', category: 'furniture', role: 'chair', rarity: 'rare', price: 1_200, w: 2, d: 2, h: 2.5, solid: false, zone: 'interior', quality: 6, rank: 3 }),
  item({ id: 9, key: 'industrial_table', name: 'Industrial Table', desc: 'Industrial-style dining table', category: 'furniture', role: 'table', rarity: 'rare', price: 1_600, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 8, rank: 3 }),
  item({ id: 10, key: 'velvet_chair', name: 'Velvet Chair', desc: 'Plush purple velvet fit for gourmets', category: 'furniture', role: 'chair', rarity: 'epic', price: 6_000, w: 2, d: 2, h: 2.7, solid: false, zone: 'interior', quality: 14, rank: 6 }),
  item({ id: 11, key: 'glass_table', name: 'Glass Table', desc: 'Crystal clear glass on golden legs', category: 'furniture', role: 'table', rarity: 'epic', price: 8_000, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 16, rank: 6 }),
  item({ id: 12, key: 'royal_chair', name: 'Royal Chair', desc: 'A gilded throne for royal diners', category: 'furniture', role: 'chair', rarity: 'legendary', price: 60_000, w: 2, d: 2, h: 3.2, solid: false, zone: 'interior', quality: 40, rank: 9 }),
  item({ id: 13, key: 'royal_table', name: 'Royal Table', desc: 'Marble and gold, the finest table in town', category: 'furniture', role: 'table', rarity: 'legendary', price: 75_000, w: 3, d: 3, h: 1.7, solid: true, zone: 'interior', quality: 45, rank: 9 }),
  item({ id: 14, key: 'wooden_counter', name: 'Wooden Counter', desc: 'A kitchen counter with a wooden top', category: 'furniture', role: 'counter', rarity: 'common', price: 50, w: 2, d: 2, h: 1.8, solid: true, zone: 'interior', quality: 1 }),
  item({ id: 15, key: 'marble_counter', name: 'Marble Counter', desc: 'A gleaming marble kitchen counter', category: 'furniture', role: 'counter', rarity: 'rare', price: 2_500, w: 2, d: 2, h: 1.8, solid: true, zone: 'interior', quality: 7, rank: 3 }),

  // ---------------------------------------------------------- appliances
  item({ id: 20, key: 'rusty_stove', name: 'Rusty Stove', desc: 'It still gets hot. Mostly.', category: 'appliances', role: 'stove', rarity: 'common', price: 150, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 3, speed: 1 }),
  item({ id: 21, key: 'retro_stove', name: 'Retro Stove', desc: 'A mint-green classic. Cooks 30% faster', category: 'appliances', role: 'stove', rarity: 'uncommon', price: 900, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 8, speed: 1.3, rank: 1 }),
  item({ id: 22, key: 'steel_stove', name: 'Steel Range', desc: 'Restaurant-grade steel. Cooks 70% faster', category: 'appliances', role: 'stove', rarity: 'rare', price: 7_500, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 18, speed: 1.7, rank: 3, skill: [1, 8] }),
  item({ id: 23, key: 'pro_stove', name: 'Pro Chef Range', desc: 'Six burners of fury. Cooks 2.3x faster', category: 'appliances', role: 'stove', rarity: 'epic', price: 55_000, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 40, speed: 2.3, rank: 6, skill: [1, 20] }),
  item({ id: 24, key: 'golden_stove', name: 'Golden Oven', desc: 'Legendary heat. Cooks 3.2x faster', category: 'appliances', role: 'stove', rarity: 'legendary', price: 400_000, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 90, speed: 3.2, rank: 10, skill: [1, 35] }),
  item({ id: 25, key: 'mini_fridge', name: 'Mini Fridge', desc: 'Stores 20 ingredients', category: 'appliances', role: 'fridge', rarity: 'common', price: 200, w: 2, d: 2, h: 2.4, solid: true, zone: 'interior', quality: 3, capacity: 20 }),
  item({ id: 26, key: 'fridge', name: 'Fridge', desc: 'A tall fridge. Stores 60 ingredients', category: 'appliances', role: 'fridge', rarity: 'uncommon', price: 1_500, w: 2, d: 2, h: 4, solid: true, zone: 'interior', quality: 8, capacity: 60, rank: 1 }),
  item({ id: 27, key: 'double_fridge', name: 'Double Fridge', desc: 'Two doors, lots of room. Stores 150', category: 'appliances', role: 'fridge', rarity: 'rare', price: 12_000, w: 3, d: 2, h: 4, solid: true, zone: 'interior', quality: 18, capacity: 150, rank: 4 }),
  item({ id: 28, key: 'freezer', name: 'Walk-in Freezer', desc: 'An enormous chiller. Stores 400', category: 'appliances', role: 'fridge', rarity: 'epic', price: 80_000, w: 4, d: 3, h: 4.4, solid: true, zone: 'interior', quality: 40, capacity: 400, rank: 7 }),
  item({ id: 29, key: 'basic_sink', name: 'Basic Sink', desc: 'Washes 3 dishes at a time', category: 'appliances', role: 'sink', rarity: 'common', price: 150, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 3, capacity: 3, speed: 1 }),
  item({ id: 30, key: 'double_sink', name: 'Double Sink', desc: 'Washes 6 dishes, 50% faster', category: 'appliances', role: 'sink', rarity: 'uncommon', price: 2_500, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 10, capacity: 6, speed: 1.5, rank: 2 }),
  item({ id: 31, key: 'dishwasher', name: 'Dishwasher', desc: 'Washes 12 dishes, 2.5x faster', category: 'appliances', role: 'sink', rarity: 'rare', price: 25_000, w: 3, d: 2, h: 2, solid: true, zone: 'interior', quality: 25, capacity: 12, speed: 2.5, rank: 5 }),
  item({ id: 32, key: 'order_stand', name: 'Order Stand', desc: 'Tickets and finished plates wait here', category: 'appliances', role: 'stand', rarity: 'common', price: 200, w: 4, d: 2, h: 1.9, solid: true, zone: 'interior', quality: 4, limit: 1 }),
  item({ id: 33, key: 'deluxe_stand', name: 'Deluxe Order Counter', desc: 'A shining pass. Customers tip 15% more', category: 'appliances', role: 'stand', rarity: 'rare', price: 18_000, w: 4, d: 2, h: 1.9, solid: true, zone: 'interior', quality: 22, limit: 1, tips: 0.15, rank: 4 }),
  item({ id: 34, key: 'register', name: 'Cash Register', desc: 'Customers pay here. Holds $2,000 of offline income', category: 'appliances', role: 'register', rarity: 'common', price: 100, w: 2, d: 2, h: 2, solid: true, zone: 'interior', quality: 2, capacity: 2_000, limit: 1 }),
  item({ id: 35, key: 'modern_register', name: 'Modern Register', desc: 'Holds $25,000 of offline income', category: 'appliances', role: 'register', rarity: 'rare', price: 10_000, w: 2, d: 2, h: 2, solid: true, zone: 'interior', quality: 15, capacity: 25_000, limit: 1, rank: 4 }),
  item({ id: 36, key: 'gold_register', name: 'Golden Register', desc: 'Holds $300,000 of offline income', category: 'appliances', role: 'register', rarity: 'legendary', price: 150_000, w: 2, d: 2, h: 2, solid: true, zone: 'interior', quality: 50, capacity: 300_000, limit: 1, rank: 8 }),

  // --------------------------------------------------------------- decor
  item({ id: 40, key: 'potted_plant', name: 'Potted Plant', desc: 'A splash of green', category: 'decor', role: 'decor', rarity: 'common', price: 80, w: 1, d: 1, h: 2, solid: true, zone: 'any', quality: 2 }),
  item({ id: 41, key: 'tall_fern', name: 'Tall Fern', desc: 'A leafy giant in a clay pot', category: 'decor', role: 'decor', rarity: 'uncommon', price: 350, w: 2, d: 2, h: 3.4, solid: true, zone: 'any', quality: 4 }),
  item({ id: 42, key: 'floor_lamp', name: 'Floor Lamp', desc: 'Warm light for cozy dinners', category: 'decor', role: 'decor', rarity: 'uncommon', price: 450, w: 1, d: 1, h: 4, solid: true, zone: 'interior', quality: 4 }),
  item({ id: 43, key: 'red_rug', name: 'Red Rug', desc: 'A soft rug to tie the room together', category: 'decor', role: 'rug', rarity: 'uncommon', price: 300, w: 5, d: 4, h: 0.1, solid: false, zone: 'interior', quality: 3 }),
  item({ id: 44, key: 'painting', name: 'Painting', desc: 'Fine art on an easel', category: 'decor', role: 'decor', rarity: 'rare', price: 1_200, w: 2, d: 1, h: 3.4, solid: true, zone: 'interior', quality: 8, rank: 2 }),
  item({ id: 45, key: 'bookshelf', name: 'Bookshelf', desc: 'Cookbooks, mostly', category: 'decor', role: 'decor', rarity: 'rare', price: 1_800, w: 3, d: 1, h: 4, solid: true, zone: 'interior', quality: 9, rank: 2 }),
  item({ id: 46, key: 'jukebox', name: 'Jukebox', desc: 'Plays the hits. Customers love it', category: 'decor', role: 'decor', rarity: 'epic', price: 6_500, w: 2, d: 2, h: 3.2, solid: true, zone: 'interior', quality: 16, rank: 4 }),
  item({ id: 47, key: 'aquarium', name: 'Aquarium', desc: 'Calm fish in a glowing tank', category: 'decor', role: 'decor', rarity: 'epic', price: 15_000, w: 3, d: 2, h: 3, solid: true, zone: 'interior', quality: 25, rank: 5 }),
  item({ id: 48, key: 'piano', name: 'Grand Piano', desc: 'Live music every night', category: 'decor', role: 'decor', rarity: 'legendary', price: 45_000, w: 4, d: 3, h: 2.6, solid: true, zone: 'interior', quality: 45, rank: 7 }),
  item({ id: 49, key: 'chef_statue', name: 'Golden Chef Statue', desc: 'A monument to great cooking', category: 'decor', role: 'decor', rarity: 'legendary', price: 200_000, w: 2, d: 2, h: 4.4, solid: true, zone: 'any', quality: 90, rank: 9 }),
  item({ id: 50, key: 'neon_sign', name: 'Neon OPEN Sign', desc: 'Glows pink and blue. Premium!', category: 'decor', role: 'decor', rarity: 'epic', price: 0, diamonds: 40, w: 2, d: 1, h: 3, solid: true, zone: 'any', quality: 20 }),
  item({ id: 51, key: 'flower_box', name: 'Flower Box', desc: 'Bright flowers for the front lawn', category: 'decor', role: 'decor', rarity: 'common', price: 120, w: 3, d: 1, h: 1, solid: true, zone: 'outdoor', quality: 2 }),
  item({ id: 52, key: 'park_bench', name: 'Park Bench', desc: 'A place to rest outside', category: 'decor', role: 'decor', rarity: 'uncommon', price: 350, w: 3, d: 2, h: 1.8, solid: true, zone: 'outdoor', quality: 3 }),
  item({ id: 53, key: 'street_lamp', name: 'Street Lamp', desc: 'Lights the way to your door', category: 'decor', role: 'decor', rarity: 'uncommon', price: 600, w: 1, d: 1, h: 5, solid: true, zone: 'outdoor', quality: 4 }),
  item({ id: 54, key: 'garden_fountain', name: 'Garden Fountain', desc: 'A sparkling fountain for your lawn', category: 'decor', role: 'decor', rarity: 'epic', price: 25_000, w: 4, d: 4, h: 2.6, solid: true, zone: 'outdoor', quality: 30, rank: 5 }),
  item({ id: 55, key: 'balloons', name: 'Balloon Bunch', desc: 'It is always somebody\'s birthday', category: 'decor', role: 'decor', rarity: 'common', price: 200, w: 1, d: 1, h: 5, solid: true, zone: 'any', quality: 2 }),

  // ------------------------------------------------------------- farming
  item({ id: 60, key: 'wheat_plot', name: 'Wheat Plot', desc: 'Grows 3 Wheat every 40s', category: 'farming', role: 'crop', rarity: 'common', price: 150, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 3, produces: 1, seconds: 40, yield: 3, rank: 1 }),
  item({ id: 61, key: 'tomato_plot', name: 'Tomato Plot', desc: 'Grows 3 Tomatoes every 50s', category: 'farming', role: 'crop', rarity: 'common', price: 300, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 3, produces: 2, seconds: 50, yield: 3, rank: 1 }),
  item({ id: 62, key: 'potato_plot', name: 'Potato Plot', desc: 'Grows 3 Potatoes every 60s', category: 'farming', role: 'crop', rarity: 'uncommon', price: 700, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 4, produces: 3, seconds: 60, yield: 3, rank: 1, skill: [3, 3] }),
  item({ id: 63, key: 'lettuce_plot', name: 'Lettuce Plot', desc: 'Grows 3 Lettuce every 60s', category: 'farming', role: 'crop', rarity: 'uncommon', price: 1_400, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 5, produces: 4, seconds: 60, yield: 3, rank: 2, skill: [3, 5] }),
  item({ id: 64, key: 'corn_plot', name: 'Corn Plot', desc: 'Grows 3 Corn every 75s', category: 'farming', role: 'crop', rarity: 'rare', price: 3_000, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 6, produces: 5, seconds: 75, yield: 3, rank: 3, skill: [3, 8] }),
  item({ id: 65, key: 'carrot_plot', name: 'Carrot Plot', desc: 'Grows 3 Carrots every 75s', category: 'farming', role: 'crop', rarity: 'rare', price: 5_000, w: 4, d: 4, h: 0.5, solid: false, zone: 'farm', quality: 7, produces: 6, seconds: 75, yield: 3, rank: 3, skill: [3, 10] }),
  item({ id: 66, key: 'sprinkler', name: 'Sprinkler', desc: 'Crops within 7 studs grow 30% faster', category: 'farming', role: 'sprinkler', rarity: 'rare', price: 2_500, w: 1, d: 1, h: 1.2, solid: true, zone: 'farm', quality: 6, speed: 1.3, rank: 2 }),
  item({ id: 67, key: 'scarecrow', name: 'Scarecrow', desc: 'Keeps the crows guessing', category: 'farming', role: 'decor', rarity: 'common', price: 250, w: 1, d: 1, h: 3.6, solid: true, zone: 'farm', quality: 2 }),

  // ------------------------------------------------------------ ranching
  item({ id: 70, key: 'chicken_coop', name: 'Chicken Coop', desc: 'Two hens lay 2 Eggs every 45s', category: 'ranching', role: 'animal', rarity: 'uncommon', price: 1_000, w: 5, d: 5, h: 2.4, solid: true, zone: 'ranch', quality: 6, produces: 7, seconds: 45, yield: 2, capacity: 6, rank: 2 }),
  item({ id: 71, key: 'cow_pen', name: 'Cow Pen', desc: 'A dairy cow: 2 Milk every 60s', category: 'ranching', role: 'animal', rarity: 'rare', price: 8_000, w: 6, d: 6, h: 1.4, solid: true, zone: 'ranch', quality: 12, produces: 8, seconds: 60, yield: 2, capacity: 6, rank: 3, skill: [4, 5] }),
  item({ id: 72, key: 'pig_pen', name: 'Pig Pen', desc: 'A happy pig: 2 Bacon every 75s', category: 'ranching', role: 'animal', rarity: 'epic', price: 22_000, w: 6, d: 6, h: 1.4, solid: true, zone: 'ranch', quality: 18, produces: 9, seconds: 75, yield: 2, capacity: 6, rank: 4, skill: [4, 10] }),
  item({ id: 73, key: 'feeder', name: 'Animal Feeder', desc: 'Animals within 9 studs produce 30% faster', category: 'ranching', role: 'feeder', rarity: 'rare', price: 3_500, w: 2, d: 2, h: 1.4, solid: true, zone: 'ranch', quality: 6, speed: 1.3, rank: 2 }),
  item({ id: 74, key: 'hay_bale', name: 'Hay Bale', desc: 'Rustic and a little itchy', category: 'ranching', role: 'decor', rarity: 'common', price: 150, w: 2, d: 1, h: 1.2, solid: true, zone: 'ranch', quality: 1 }),

  // ------------------------------------------------------------- fishing
  item({ id: 90, key: 'basic_rod', name: 'Basic Rod', desc: 'A trusty rod. Fish off the pier or at the park pond!', category: 'fishing', role: 'rod', rarity: 'common', price: 300, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 3, rank: 3 }),
  item({ id: 91, key: 'sturdy_rod', name: 'Sturdy Rod', desc: 'Faster bites and luckier catches', category: 'fishing', role: 'rod', rarity: 'uncommon', price: 3_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 8, rank: 3, skill: [5, 5] }),
  item({ id: 92, key: 'pro_rod', name: 'Pro Rod', desc: 'For serious anglers: rare fish love it', category: 'fishing', role: 'rod', rarity: 'rare', price: 25_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 18, rank: 5, skill: [5, 15] }),
  item({ id: 93, key: 'golden_rod', name: 'Golden Rod', desc: 'Legendary fish cannot resist it', category: 'fishing', role: 'rod', rarity: 'legendary', price: 250_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 45, rank: 8, skill: [5, 30] }),
  item({ id: 94, key: 'trophy_fish', name: 'Trophy Fish', desc: 'A prize catch, mounted for all to see', category: 'fishing', role: 'decor', rarity: 'rare', price: 2_000, w: 2, d: 1, h: 3, solid: true, zone: 'interior', quality: 10, rank: 3 }),
  item({ id: 95, key: 'anchor', name: 'Ship Anchor', desc: 'A seaside touch for your lawn', category: 'fishing', role: 'decor', rarity: 'rare', price: 4_000, w: 2, d: 2, h: 2.6, solid: true, zone: 'outdoor', quality: 12, rank: 3 }),

  // ----------------------------------------------------------- structure
  item({ id: 80, key: 'floor_oak', name: 'Oak Floor', desc: 'Warm oak floorboards', category: 'structure', role: 'floor', rarity: 'common', price: 0, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 0, colors: [0x9a5a32, 0x8a4e2a] }),
  item({ id: 81, key: 'floor_checker', name: 'Checkered Floor', desc: 'Black and white diner tiles', category: 'structure', role: 'floor', rarity: 'uncommon', price: 1_200, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 8, colors: [0xf4f4f4, 0x2a2a2e] }),
  item({ id: 82, key: 'floor_terracotta', name: 'Terracotta Floor', desc: 'Sunny tiles from the coast', category: 'structure', role: 'floor', rarity: 'rare', price: 6_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 16, colors: [0xd8784a, 0xc8683e], rank: 3 }),
  item({ id: 83, key: 'floor_marble', name: 'Marble Floor', desc: 'Polished marble for fine dining', category: 'structure', role: 'floor', rarity: 'epic', price: 40_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 35, colors: [0xf0eee8, 0xdcd8d0], rank: 6 }),
  item({ id: 84, key: 'wall_cream', name: 'Cream Walls', desc: 'Clean and simple', category: 'structure', role: 'wall', rarity: 'common', price: 0, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 0, colors: [0xf3e6d6, 0xffffff] }),
  item({ id: 85, key: 'wall_mint', name: 'Mint Walls', desc: 'Fresh and cheerful', category: 'structure', role: 'wall', rarity: 'uncommon', price: 900, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 6, colors: [0xbfe8d0, 0xffffff] }),
  item({ id: 86, key: 'wall_brick', name: 'Brick Walls', desc: 'Classic red brick bistro', category: 'structure', role: 'wall', rarity: 'rare', price: 4_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 14, colors: [0xb8553a, 0xf2e8da], rank: 2 }),
  item({ id: 87, key: 'wall_navy', name: 'Navy Walls', desc: 'Deep blue with gold trim', category: 'structure', role: 'wall', rarity: 'epic', price: 30_000, w: 0, d: 0, h: 0, solid: false, zone: 'none', quality: 30, colors: [0x2a3a6a, 0xf2c84a], rank: 6 }),
];

const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: number): ItemDef | undefined => ITEM_BY_ID.get(id);

export const STYLE_DEFAULT = { floor: 80, wall: 84 } as const;

/** Items that are placed in the world (everything but structure styles). */
export const placeable = (def: ItemDef): boolean => def.zone !== 'none';

/** Half extents of an item's footprint at a quarter-turn rotation. */
export const footprint = (def: ItemDef, rot: number): { hx: number; hz: number } =>
  (rot & 1) === 1 ? { hx: def.d / 2, hz: def.w / 2 } : { hx: def.w / 2, hz: def.d / 2 };

/** The unit direction an item's front faces at a rotation (rot 0 faces -Z). */
export const frontOf = (rot: number): { x: number; z: number } => {
  switch (rot & 3) {
    case 1:
      return { x: -1, z: 0 };
    case 2:
      return { x: 0, z: 1 };
    case 3:
      return { x: 1, z: 0 };
    default:
      return { x: 0, z: -1 };
  }
};

/** Placement snaps to a half-unit grid, so a 2-wide chair lines up flush with a 3-wide table. */
export const SNAP = 0.5;

export const snapCentre = (value: number): number => Math.round(value / SNAP) * SNAP;

/**
 * THE STARTER RESTAURANT: the kitchen along the back wall (stove, fridge,
 * sink, order stand, counters, the register by the door) and two tables with
 * chairs. Positions are plot-local, for the Cozy Diner (interior x -33..-3,
 * z 6..28). The tutorial's own table and chairs come in the backpack.
 */
export const STARTER_LAYOUT: readonly { kind: number; x: number; z: number; rot: number }[] = [
  { kind: 20, x: -26.5, z: 27, rot: 0 },
  { kind: 25, x: -23, z: 27, rot: 0 },
  { kind: 14, x: -21, z: 27, rot: 0 },
  { kind: 32, x: -17, z: 27, rot: 0 },
  { kind: 14, x: -13, z: 27, rot: 0 },
  { kind: 29, x: -9.5, z: 27, rot: 0 },
  { kind: 34, x: -8, z: 8, rot: 1 },
  { kind: 3, x: -27.5, z: 14, rot: 0 },
  { kind: 1, x: -30, z: 14, rot: 3 },
  { kind: 1, x: -25, z: 14, rot: 1 },
  { kind: 40, x: -32.5, z: 6.5, rot: 0 },
];

/** What a brand-new owner finds in their Items: the tutorial's table and two chairs. */
export const STARTER_INVENTORY: readonly { id: number; count: number }[] = [
  { id: 3, count: 1 },
  { id: 1, count: 2 },
];
