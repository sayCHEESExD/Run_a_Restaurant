import { PLOT_SLOTS, toWorld } from '@restaurant/shared';
import type { Game } from '../core/Game.js';

/**
 * DEV-ONLY PLAYTEST HELPERS on `window.__kit` (never in a production build):
 *
 *   __kit.dev({ cash: 5000 })      the dev server's cheats (cash, diamonds, xp, items, ingredients, tutorial, customer, tp)
 *   __kit.home(x, z)               teleport to a plot-local point of your own restaurant
 *   __kit.self()                   your private state
 *   __kit.restaurant()             your restaurant's replicated state
 *   __kit.step(n)                  run n frames by hand (a hidden tab throttles rAF)
 */
export const install = (game: Game): void => {
  const kit = {
    dev: (message: Record<string, unknown>) => game.debug.network.dev(message),
    self: () => game.debug.self,
    restaurant: () => {
      const slot = game.debug.network.player(game.debug.network.sessionId ?? '')?.slot ?? -1;
      return slot >= 0 ? game.debug.network.restaurant(slot) : null;
    },
    home: (x: number, z: number) => {
      const slot = game.debug.network.player(game.debug.network.sessionId ?? '')?.slot ?? -1;
      if (slot < 0) return;
      const at = toWorld(PLOT_SLOTS[slot]!, x, z);
      game.debug.network.dev({ tp: [at.x, at.z] });
    },
    step: (n = 1) => {
      for (let i = 0; i < n; i += 1) game.update(1 / 60, performance.now());
    },
  };
  (window as Window & { __kit?: typeof kit }).__kit = kit;
};
