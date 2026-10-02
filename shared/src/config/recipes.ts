import type { Rarity } from './rarity.js';

/**
 * INGREDIENTS AND RECIPES - the restaurant's whole menu.
 *
 * Recipes are the main source of Cash. Each consumes ingredients from the
 * fridges when a customer orders it (so an order can always be cooked), takes
 * a while on a stove, and pays its price (times the customer's rarity and the
 * tip). Rice needs nothing: the pantry always has rice. Everything else comes
 * from the farm (crops) or the ranch (animal products).
 */

export interface IngredientDef {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly source: 'farm' | 'ranch' | 'fishing';
  /** Model colour for icons and crates. */
  readonly color: number;
}

export const INGREDIENTS: readonly IngredientDef[] = [
  { id: 1, key: 'wheat', name: 'Wheat', source: 'farm', color: 0xf0c850 },
  { id: 2, key: 'tomato', name: 'Tomato', source: 'farm', color: 0xe8402e },
  { id: 3, key: 'potato', name: 'Potato', source: 'farm', color: 0xc8955a },
  { id: 4, key: 'lettuce', name: 'Lettuce', source: 'farm', color: 0x6ad04a },
  { id: 5, key: 'corn', name: 'Corn', source: 'farm', color: 0xf8d838 },
  { id: 6, key: 'carrot', name: 'Carrot', source: 'farm', color: 0xf27a1e },
  { id: 7, key: 'egg', name: 'Egg', source: 'ranch', color: 0xfaf4e4 },
  { id: 8, key: 'milk', name: 'Milk', source: 'ranch', color: 0xffffff },
  { id: 9, key: 'bacon', name: 'Bacon', source: 'ranch', color: 0xd86a5a },
  { id: 10, key: 'fish', name: 'Fish', source: 'fishing', color: 0x7aa8d8 },
];

const INGREDIENT_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export const ingredientById = (id: number): IngredientDef | undefined => INGREDIENT_BY_ID.get(id);

export interface RecipeDef {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly price: number;
  /** [ingredient id, count] pairs, consumed per dish. */
  readonly needs: readonly (readonly [number, number])[];
  /** Seconds on a basic stove. */
  readonly cook: number;
  /** Cooking level that unlocks it. */
  readonly level: number;
  readonly rarity: Rarity;
  readonly desc: string;
}

export const RECIPES: readonly RecipeDef[] = [
  { id: 1, key: 'rice', name: 'Rice', price: 10, needs: [], cook: 4, level: 1, rarity: 'common', desc: 'A warm bowl of fluffy rice.' },
  { id: 2, key: 'bread', name: 'Bread', price: 15, needs: [[1, 2]], cook: 5, level: 1, rarity: 'common', desc: 'A fresh loaf, still warm.' },
  { id: 3, key: 'soup', name: 'Tomato Soup', price: 18, needs: [[2, 2]], cook: 6, level: 2, rarity: 'common', desc: 'Rich, red and comforting.' },
  { id: 4, key: 'potato', name: 'Baked Potato', price: 21, needs: [[3, 2]], cook: 6, level: 3, rarity: 'common', desc: 'Crispy skin, fluffy middle.' },
  { id: 5, key: 'salad', name: 'Garden Salad', price: 28, needs: [[4, 2], [2, 1]], cook: 5, level: 5, rarity: 'uncommon', desc: 'Crunchy greens from your own farm.' },
  { id: 6, key: 'corn', name: 'Corn on the Cob', price: 32, needs: [[5, 2]], cook: 7, level: 7, rarity: 'uncommon', desc: 'Buttery and golden.' },
  { id: 7, key: 'carrots', name: 'Roasted Carrots', price: 35, needs: [[6, 2]], cook: 7, level: 9, rarity: 'uncommon', desc: 'Sweet, roasted and glazed.' },
  { id: 8, key: 'fries', name: 'Fries', price: 37, needs: [[3, 3]], cook: 8, level: 10, rarity: 'uncommon', desc: 'Hot, salty and crispy.' },
  { id: 9, key: 'bruschetta', name: 'Bruschetta', price: 38, needs: [[1, 1], [2, 2]], cook: 8, level: 12, rarity: 'rare', desc: 'Toasted bread piled with tomato.' },
  { id: 10, key: 'egg', name: 'Fried Egg', price: 52, needs: [[7, 2]], cook: 8, level: 14, rarity: 'rare', desc: 'Sunny side up!' },
  { id: 17, key: 'fishchips', name: 'Fish & Chips', price: 62, needs: [[10, 1], [3, 2]], cook: 9, level: 15, rarity: 'rare', desc: 'Golden battered fish with chunky chips.' },
  { id: 11, key: 'pancakes', name: 'Pancakes', price: 70, needs: [[1, 2], [7, 1], [8, 1]], cook: 10, level: 17, rarity: 'rare', desc: 'A fluffy stack with syrup.' },
  { id: 18, key: 'grilledfish', name: 'Grilled Fish', price: 80, needs: [[10, 2]], cook: 10, level: 19, rarity: 'rare', desc: 'Fresh off the pier and onto the grill.' },
  { id: 12, key: 'mac', name: 'Mac & Cheese', price: 90, needs: [[1, 2], [8, 2]], cook: 11, level: 20, rarity: 'epic', desc: 'Creamy, cheesy, perfect.' },
  { id: 13, key: 'baconeggs', name: 'Bacon & Eggs', price: 110, needs: [[9, 2], [7, 2]], cook: 12, level: 24, rarity: 'epic', desc: 'The breakfast of champions.' },
  { id: 19, key: 'sushi', name: 'Sushi Roll', price: 125, needs: [[10, 2], [4, 1]], cook: 12, level: 26, rarity: 'epic', desc: 'Rolled with care, sliced with flair.' },
  { id: 14, key: 'pizza', name: 'Pizza', price: 150, needs: [[1, 3], [2, 2], [8, 2]], cook: 14, level: 28, rarity: 'epic', desc: 'Stone-baked with bubbling cheese.' },
  { id: 15, key: 'burger', name: 'Deluxe Burger', price: 180, needs: [[1, 2], [9, 2], [4, 1], [2, 1]], cook: 15, level: 32, rarity: 'legendary', desc: 'Stacked high with everything.' },
  { id: 20, key: 'platter', name: 'Seafood Platter', price: 260, needs: [[10, 3], [6, 1], [5, 1]], cook: 18, level: 36, rarity: 'legendary', desc: 'The catch of the day, all of it.' },
  { id: 16, key: 'feast', name: "Chef's Feast", price: 400, needs: [[9, 2], [3, 2], [5, 2], [8, 2], [6, 2]], cook: 22, level: 40, rarity: 'legendary', desc: 'A table-filling masterpiece.' },
];

const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
export const recipeById = (id: number): RecipeDef | undefined => RECIPE_BY_ID.get(id);

/** The tutorial's first order. */
export const STARTER_RECIPE = 1;

/** True when the stocks hold enough for one dish. */
export const canAfford = (recipe: RecipeDef, stock: (id: number) => number): boolean => recipe.needs.every(([id, n]) => stock(id) >= n);

/** What is missing for one dish, as text: "Tomato x2, Lettuce x1", or ''. */
export const missingText = (recipe: RecipeDef, stock: (id: number) => number): string =>
  recipe.needs
    .filter(([id, n]) => stock(id) < n)
    .map(([id, n]) => `${ingredientById(id)?.name ?? '?'} x${n - stock(id)}`)
    .join(', ');
