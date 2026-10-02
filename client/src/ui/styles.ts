import { injectHudStyles } from './hudStyles.js';

/**
 * THE RUN A RESTAURANT LOOK, one stylesheet, injected once.
 *
 * It follows the reference screenshots: windows with a bright blue header
 * patterned with soft diamonds, a big white title with a dark-blue rim, a
 * square red-orange close button, and a cream body holding rounded cards;
 * white pill rails of round icon buttons beside windows and down the left of
 * the screen; chunky outlined white type for money; the task card with its
 * green Rewards button; dark rounded "[E] Take Order" prompts; white order
 * bubbles and progress cards over customers and stoves.
 *
 * Sizes are multiples of `--u` (one pixel of a 1920x1080 layout, defined in
 * hudStyles) with pixel floors multiplied by `--f`, so the same HUD fits a
 * monitor and a phone held sideways.
 *
 * NO BACKTICKS IN THE CSS: it is a template literal.
 */
let injected = false;

export const injectStyles = (): void => {
  if (injected) return;
  injected = true;
  injectHudStyles();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
};

const CSS = `
:root {
  --rr-font: "Fredoka", "Grandstander", "Baloo 2", "Nunito", system-ui, sans-serif;
  --rr-ink: #1c2a3e;
  --rr-blue: #3aa2f6;
  --rr-blue-dark: #1f6fc8;
  --rr-cream: #fff6ea;
  --rr-card: #f6ecdf;
  --rr-card-line: #e6d6c2;
  --rr-brown: #7a6250;
  --rr-green: #5fd83a;
  --rr-green-dark: #3a9e22;
  --rr-red: #ff5a3c;
  --rr-red-dark: #c8361f;
  --rr-gray: #c8ccd2;
}
.rr-font { font-family: var(--rr-font); font-weight: 700; letter-spacing: 0.01em; }
.rr-outline {
  color: #fff;
  text-shadow:
    2px 0 0 var(--rr-ink), -2px 0 0 var(--rr-ink), 0 2px 0 var(--rr-ink), 0 -2px 0 var(--rr-ink),
    2px 2px 0 var(--rr-ink), -2px 2px 0 var(--rr-ink), 2px -2px 0 var(--rr-ink), -2px -2px 0 var(--rr-ink),
    0 3px 5px rgba(0, 0, 0, 0.3);
}
.rr-outline-thin {
  color: #fff;
  text-shadow: 1px 0 0 var(--rr-ink), -1px 0 0 var(--rr-ink), 0 1px 0 var(--rr-ink), 0 -1px 0 var(--rr-ink), 0 2px 2px rgba(0, 0, 0, 0.25);
}
.rr-hud { position: fixed; inset: 0; pointer-events: none; z-index: 20; user-select: none; font-family: var(--rr-font); }
.rr-hud > * { pointer-events: auto; }
.rr-hud [hidden], .rr-world [hidden], .rr-shade[hidden], .rr-build[hidden], .rr-tut [hidden], .rr-tut[hidden] { display: none !important; }
.rr-hud button, .rr-shade button, .rr-build button { font-family: var(--rr-font); cursor: pointer; }
.rr-icon { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }

/* ------------------------------------------------------------------ rails */
.rr-rail {
  position: fixed;
  left: max(calc(10px * var(--f)), calc(22 * var(--u)), env(safe-area-inset-left, 0px));
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: calc(8 * var(--u));
  padding: calc(12 * var(--u)) calc(8 * var(--u));
  background: rgba(255, 255, 255, 0.92);
  border-radius: calc(60 * var(--u));
  box-shadow: 0 calc(6 * var(--u)) calc(14 * var(--u)) rgba(0, 0, 0, 0.18), inset 0 0 0 calc(3 * var(--u)) #e8e2da;
}
.rr-rail__btn {
  position: relative;
  width: calc(96 * var(--u));
  height: calc(96 * var(--u));
  min-width: calc(44px * var(--f));
  min-height: calc(44px * var(--f));
  border-radius: 50%;
  border: calc(3 * var(--u)) solid #ffffff;
  background: radial-gradient(circle at 50% 35%, #f2f0ec, #d8d2ca);
  box-shadow: 0 calc(3 * var(--u)) 0 #c2b8aa;
  padding: 0;
  display: grid;
  place-items: center;
  transition: transform 90ms ease;
}
.rr-rail__btn:hover { transform: scale(1.06); }
.rr-rail__btn:active { transform: scale(0.95); }
.rr-rail__btn.is-active { background: radial-gradient(circle at 50% 35%, #5ab8ff, #2f8ad8); box-shadow: 0 calc(3 * var(--u)) 0 #1f5ea0; }
.rr-rail__art { width: 74%; height: 74%; margin-top: -12%; }
.rr-rail__label {
  position: absolute;
  bottom: calc(2 * var(--u));
  left: 50%;
  transform: translateX(-50%);
  font-size: max(calc(10px * var(--f)), calc(17 * var(--u)));
  white-space: nowrap;
  line-height: 1;
}
.rr-rail__badge {
  position: absolute;
  top: calc(-4 * var(--u));
  right: calc(-4 * var(--u));
  width: calc(30 * var(--u));
  height: calc(30 * var(--u));
  min-width: 16px;
  min-height: 16px;
  border-radius: 50%;
  background: #ff3a3a;
  border: calc(3 * var(--u)) solid #fff;
  color: #fff;
  font-size: max(10px, calc(18 * var(--u)));
  display: grid;
  place-items: center;
  font-weight: 800;
}
.rr-rail__badge:empty { display: none; }

/* ------------------------------------------------------------ money corner */
.rr-money {
  position: fixed;
  left: max(calc(12px * var(--f)), calc(22 * var(--u)), env(safe-area-inset-left, 0px));
  bottom: max(calc(10px * var(--f)), calc(18 * var(--u)), env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(4 * var(--u));
  pointer-events: none;
}
.rr-money__row { display: flex; align-items: center; gap: calc(8 * var(--u)); }
.rr-money__icon { width: calc(64 * var(--u)); height: calc(64 * var(--u)); min-width: 26px; min-height: 26px; }
.rr-money__cash { font-size: max(calc(22px * var(--f)), calc(58 * var(--u))); line-height: 1; }
.rr-money__gems { font-size: max(calc(15px * var(--f)), calc(34 * var(--u))); line-height: 1; color: #bfe6ff; }
.rr-money__gems-icon { width: calc(40 * var(--u)); height: calc(40 * var(--u)); min-width: 18px; min-height: 18px; }
.rr-money--pop .rr-money__cash { animation: rr-pop 480ms ease-out; }
@keyframes rr-pop { 0% { transform: scale(1); } 35% { transform: scale(1.22); } 100% { transform: scale(1); } }
.rr-rankchip {
  display: flex;
  align-items: center;
  gap: calc(6 * var(--u));
  padding: calc(4 * var(--u)) calc(14 * var(--u)) calc(4 * var(--u)) calc(6 * var(--u));
  border-radius: 999px;
  background: rgba(20, 28, 44, 0.55);
  font-size: max(calc(12px * var(--f)), calc(24 * var(--u)));
  pointer-events: auto;
  cursor: pointer;
}
.rr-rankchip__badge { width: calc(36 * var(--u)); height: calc(36 * var(--u)); min-width: 16px; min-height: 16px; border-radius: 50%; border: 2px solid #fff; }
.rr-rankchip__stars { color: #ffd23a; }

/* ------------------------------------------------------------ items button */
.rr-items {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(calc(10px * var(--f)), calc(18 * var(--u)), env(safe-area-inset-bottom, 0px));
  width: calc(96 * var(--u));
  height: calc(96 * var(--u));
  min-width: 46px;
  min-height: 46px;
  border-radius: calc(10 * var(--u));
  background: linear-gradient(#7fb87a, #5a9a56);
  border: calc(3 * var(--u)) solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 calc(4 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.25);
  padding: 0;
  display: grid;
  place-items: center;
}
.rr-items.is-active { background: linear-gradient(#5ab8ff, #2f8ad8); }
.rr-items__art { width: 78%; height: 78%; }
.rr-items__key { position: absolute; left: calc(-6 * var(--u)); top: calc(-14 * var(--u)); font-size: max(11px, calc(22 * var(--u))); }
.rr-items__label { position: absolute; right: calc(4 * var(--u)); bottom: calc(2 * var(--u)); font-size: max(10px, calc(19 * var(--u))); }
body.aoe-touch-mode .rr-items__key { display: none; }

.rr-carry {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(max(calc(10px * var(--f)), calc(18 * var(--u))) + max(46px, calc(96 * var(--u))) + calc(12 * var(--u)));
  display: flex;
  align-items: center;
  gap: calc(8 * var(--u));
  padding: calc(6 * var(--u)) calc(16 * var(--u)) calc(6 * var(--u)) calc(8 * var(--u));
  background: rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  box-shadow: 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.2);
  color: var(--rr-brown);
  font-size: max(calc(12px * var(--f)), calc(24 * var(--u)));
  pointer-events: none;
}
.rr-carry__icon { width: calc(44 * var(--u)); height: calc(44 * var(--u)); min-width: 20px; min-height: 20px; }

/* --------------------------------------------------------------- task card */
.rr-task {
  position: fixed;
  right: max(calc(10px * var(--f)), calc(18 * var(--u)), env(safe-area-inset-right, 0px));
  top: 38%;
  width: calc(300 * var(--u));
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: calc(8 * var(--u));
}
.rr-task__card {
  background: rgba(255, 255, 255, 0.96);
  border-radius: calc(12 * var(--u));
  padding: calc(8 * var(--u)) calc(12 * var(--u));
  box-shadow: 0 calc(3 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.18);
  color: #fff;
}
.rr-task__line { display: flex; justify-content: space-between; align-items: center; gap: calc(8 * var(--u)); font-size: max(calc(11px * var(--f)), calc(22 * var(--u))); }
.rr-task__text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rr-task__count { color: #ffd23a; flex: none; }
.rr-task__bar { margin-top: calc(6 * var(--u)); height: calc(8 * var(--u)); min-height: 4px; border-radius: 999px; background: #e6e2dc; overflow: hidden; }
.rr-task__fill { height: 100%; background: linear-gradient(90deg, #ffd23a, #ffb02a); border-radius: inherit; width: 0; transition: width 300ms ease; }
.rr-task__rewards {
  height: calc(62 * var(--u));
  min-height: 30px;
  border-radius: calc(10 * var(--u));
  border: calc(3 * var(--u)) solid rgba(255, 255, 255, 0.9);
  background: linear-gradient(#7ae84a, #4ec42e);
  box-shadow: 0 calc(4 * var(--u)) 0 #2f8a1e;
  font-size: max(calc(15px * var(--f)), calc(34 * var(--u)));
  color: #fff;
}
.rr-task__rewards.is-ready { animation: rr-pulse 1s ease-in-out infinite; }
@keyframes rr-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

/* ------------------------------------------------------- top-right chips */
.rr-corner {
  position: fixed;
  right: max(calc(10px * var(--f)), calc(16 * var(--u)), env(safe-area-inset-right, 0px));
  top: max(calc(8px * var(--f)), calc(12 * var(--u)), env(safe-area-inset-top, 0px));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: calc(6 * var(--u));
  pointer-events: none;
}
.rr-version { font-size: max(10px, calc(18 * var(--u))); color: rgba(255, 255, 255, 0.85); text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4); }
.rr-boost { padding: calc(4 * var(--u)) calc(12 * var(--u)); border-radius: 999px; background: rgba(20, 28, 44, 0.6); font-size: max(11px, calc(21 * var(--u))); }

/* ------------------------------------------------------------- toasts */
.rr-toasts {
  position: fixed;
  top: max(calc(56px * var(--f)), calc(110 * var(--u)));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(6 * var(--u));
  pointer-events: none;
  width: min(90vw, calc(900 * var(--u)));
}
.rr-toast {
  padding: calc(6 * var(--u)) calc(18 * var(--u));
  border-radius: 999px;
  font-size: max(calc(13px * var(--f)), calc(28 * var(--u)));
  background: rgba(20, 28, 44, 0.55);
  animation: rr-toast 3.2s ease forwards;
  text-align: center;
}
.rr-toast--good { color: #9dff7a; }
.rr-toast--bad { color: #ff8a7a; }
.rr-toast--gold { color: #ffe066; }
.rr-toast--info { color: #ffffff; }
@keyframes rr-toast { 0% { opacity: 0; transform: translateY(-8px); } 8% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; } }

.rr-visiting {
  position: fixed;
  top: max(calc(10px * var(--f)), calc(18 * var(--u)), env(safe-area-inset-top, 0px));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: calc(12 * var(--u));
  padding: calc(6 * var(--u)) calc(8 * var(--u)) calc(6 * var(--u)) calc(8 * var(--u));
  background: rgba(255, 255, 255, 0.95);
  border-radius: 999px;
  box-shadow: 0 calc(4 * var(--u)) calc(10 * var(--u)) rgba(0, 0, 0, 0.2);
  color: var(--rr-brown);
}
.rr-visiting__face { width: calc(54 * var(--u)); height: calc(54 * var(--u)); min-width: 26px; min-height: 26px; border-radius: 50%; background: #dfe8f2 center / cover; border: 2px solid #fff; box-shadow: 0 0 0 2px #c8d2de; }
.rr-visiting__name { font-size: max(calc(13px * var(--f)), calc(26 * var(--u))); color: #2a3a4e; }
.rr-visiting__meta { font-size: max(calc(10px * var(--f)), calc(19 * var(--u))); }
.rr-visiting__like {
  padding: calc(8 * var(--u)) calc(18 * var(--u));
  border-radius: 999px;
  border: none;
  color: #fff;
  font-size: max(calc(12px * var(--f)), calc(22 * var(--u)));
  background: linear-gradient(#ff7aa8, #e8487a);
  box-shadow: 0 calc(3 * var(--u)) 0 #b02a5a;
}
.rr-visiting__like.is-done { background: #c8ccd2; box-shadow: none; }

/* --------------------------------------------------------------- windows */
.rr-shade {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(10, 20, 30, 0.12);
  font-family: var(--rr-font);
}
.rr-wrap { display: flex; align-items: center; gap: calc(12 * var(--u)); max-width: 98vw; max-height: 96vh; }
.rr-siderail {
  display: flex;
  flex-direction: column;
  gap: calc(10 * var(--u));
  padding: calc(14 * var(--u)) calc(8 * var(--u));
  background: rgba(255, 255, 255, 0.96);
  border-radius: calc(60 * var(--u));
  box-shadow: 0 calc(6 * var(--u)) calc(14 * var(--u)) rgba(0, 0, 0, 0.18);
  align-self: center;
}
.rr-window {
  width: calc(1060 * var(--u));
  max-width: 92vw;
  height: calc(760 * var(--u));
  max-height: 92vh;
  min-height: 280px;
  min-width: 420px;
  display: flex;
  flex-direction: column;
  background: #ebe2d6;
  border-radius: calc(34 * var(--u));
  padding: calc(14 * var(--u));
  box-shadow: 0 calc(16 * var(--u)) calc(40 * var(--u)) rgba(0, 0, 0, 0.3), inset 0 calc(-6 * var(--u)) 0 #d8cbbb;
}
.rr-window--small { width: calc(700 * var(--u)); height: auto; min-height: 0; }
.rr-window--small .rr-window__title { font-size: max(calc(17px * var(--f)), calc(42 * var(--u))); }
.rr-window--medium { width: calc(860 * var(--u)); height: calc(640 * var(--u)); }
.rr-window__head {
  position: relative;
  flex: none;
  height: calc(96 * var(--u));
  min-height: 46px;
  border-radius: calc(26 * var(--u)) calc(26 * var(--u)) 0 0;
  background-color: #3aa2f6;
  background-image:
    radial-gradient(circle at 25% 50%, rgba(255, 255, 255, 0.14) 0 18%, transparent 19%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.09) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.09) 75%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.09) 25%, transparent 25%, transparent 75%, rgba(255, 255, 255, 0.09) 75%),
    linear-gradient(#4cb2ff, #2f94ec);
  background-size: calc(30 * var(--u)) calc(30 * var(--u)), calc(30 * var(--u)) calc(30 * var(--u)), calc(30 * var(--u)) calc(30 * var(--u)), 100% 100%;
  background-position: 0 0, 0 0, calc(15 * var(--u)) calc(15 * var(--u)), 0 0;
  display: flex;
  align-items: center;
  padding: 0 calc(110 * var(--u)) 0 calc(28 * var(--u));
}
.rr-window__title {
  font-size: max(calc(20px * var(--f)), calc(52 * var(--u)));
  line-height: 1;
  color: #fff;
  text-shadow:
    3px 0 0 #134a86, -3px 0 0 #134a86, 0 3px 0 #134a86, 0 -3px 0 #134a86,
    3px 3px 0 #134a86, -3px 3px 0 #134a86, 3px -3px 0 #134a86, -3px -3px 0 #134a86, 0 5px 4px rgba(0, 0, 0, 0.25);
  white-space: nowrap;
}
.rr-x {
  position: absolute;
  right: calc(16 * var(--u));
  top: 50%;
  transform: translateY(-50%);
  width: calc(76 * var(--u));
  height: calc(76 * var(--u));
  min-width: 36px;
  min-height: 36px;
  border-radius: calc(14 * var(--u));
  border: calc(4 * var(--u)) solid #ffd2c4;
  background: linear-gradient(#ff7a52, #f24a2a);
  box-shadow: 0 calc(4 * var(--u)) 0 #b8301a, 0 0 0 calc(2 * var(--u)) #c8361f;
  color: #fff;
  font-size: max(calc(18px * var(--f)), calc(40 * var(--u)));
  line-height: 1;
  padding: 0;
}
.rr-x:active { transform: translateY(-46%) scale(0.95); }
.rr-window__body {
  flex: 1;
  min-height: 0;
  background: var(--rr-cream);
  border-radius: calc(30 * var(--u)) calc(30 * var(--u)) calc(26 * var(--u)) calc(26 * var(--u));
  margin-top: calc(-26 * var(--u));
  position: relative;
  padding: calc(22 * var(--u)) calc(26 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(12 * var(--u));
  color: var(--rr-brown);
  overflow: hidden;
}
.rr-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding-right: calc(8 * var(--u)); }
.rr-scroll::-webkit-scrollbar { width: calc(10 * var(--u)); }
.rr-scroll::-webkit-scrollbar-thumb { background: #cfc4b6; border-radius: 999px; }
.rr-section { font-size: max(calc(12px * var(--f)), calc(26 * var(--u))); color: #9a8a7a; margin: calc(10 * var(--u)) 0 calc(6 * var(--u)); border-bottom: 2px dashed #e6dace; padding-bottom: calc(4 * var(--u)); }
.rr-hint { display: flex; align-items: center; gap: calc(10 * var(--u)); font-size: max(calc(12px * var(--f)), calc(30 * var(--u))); color: #8a7462; }
.rr-hint__arrow { width: calc(30 * var(--u)); height: calc(30 * var(--u)); }
.rr-row { display: flex; align-items: center; gap: calc(12 * var(--u)); flex-wrap: wrap; }
.rr-spacer { flex: 1; }
.rr-search {
  flex: 1;
  min-width: 120px;
  height: calc(54 * var(--u));
  min-height: 28px;
  border-radius: calc(8 * var(--u));
  border: 2px solid #dccdbb;
  background: #efe7dc;
  padding: 0 calc(16 * var(--u));
  font-family: var(--rr-font);
  font-size: max(calc(12px * var(--f)), calc(24 * var(--u)));
  color: #6a5444;
}
.rr-window__body > .rr-search { flex: none; width: 100%; }
.rr-filter {
  height: calc(52 * var(--u));
  min-height: 26px;
  padding: 0 calc(22 * var(--u));
  border-radius: calc(8 * var(--u));
  border: 2px dashed #dccdbb;
  background: #f2ebe2;
  color: #b8a896;
  font-size: max(calc(11px * var(--f)), calc(22 * var(--u)));
}
.rr-filter.is-on { background: #5ab8ff; color: #fff; border: 2px solid #2f8ad8; }

/* ------------------------------------------------------------------ cards */
.rr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(calc(150 * var(--u)), 1fr)); gap: calc(12 * var(--u)); }
.rr-grid--wide { grid-template-columns: repeat(auto-fill, minmax(calc(270 * var(--u)), 1fr)); }
.rr-card {
  position: relative;
  background: #f6efe6;
  border: 2px solid #e6dace;
  border-radius: calc(14 * var(--u));
  padding: calc(8 * var(--u));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(4 * var(--u));
  cursor: pointer;
  color: var(--rr-brown);
  text-align: center;
  min-width: 0;
}
.rr-card:hover { border-color: #5ab8ff; }
.rr-card.is-selected { background: #8ccfff; border-color: #2f8ad8; }
.rr-card.is-locked { background: #ddd4ca; border-style: dashed; cursor: default; }
.rr-card.is-locked .rr-card__art { filter: grayscale(1) brightness(0.55) opacity(0.6); }
.rr-card__name { font-size: max(calc(11px * var(--f)), calc(22 * var(--u))); line-height: 1.1; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rr-card__price { font-size: max(calc(11px * var(--f)), calc(24 * var(--u))); color: #3fb82a; }
.rr-card__price--gem { color: #2f9ae8; }
.rr-card__art { width: 70%; aspect-ratio: 1; }
.rr-card__sub { font-size: max(calc(9px * var(--f)), calc(17 * var(--u))); color: #9a8a7a; }
.rr-card__lock {
  position: absolute;
  top: calc(6 * var(--u));
  left: calc(8 * var(--u));
  font-size: max(calc(10px * var(--f)), calc(19 * var(--u)));
}
.rr-card__req { font-size: max(calc(9px * var(--f)), calc(18 * var(--u))); color: #7a6a5a; line-height: 1.2; }
.rr-card__badge {
  position: absolute;
  top: calc(6 * var(--u));
  right: calc(6 * var(--u));
  padding: 0 calc(8 * var(--u));
  border-radius: 999px;
  font-size: max(9px, calc(16 * var(--u)));
  background: #5ad86a;
  color: #fff;
}
.rr-needs { width: 100%; border: 2px dashed #dccdbb; border-radius: calc(8 * var(--u)); padding: calc(4 * var(--u)); font-size: max(9px, calc(16 * var(--u))); color: #9a8a7a; }
.rr-needs__row { display: flex; justify-content: center; gap: calc(4 * var(--u)); flex-wrap: wrap; }
.rr-needs__item { position: relative; width: calc(40 * var(--u)); height: calc(40 * var(--u)); min-width: 18px; min-height: 18px; border-radius: 50%; background: #e4dbd0; }
.rr-needs__item span { position: absolute; right: -4px; bottom: -4px; font-size: max(9px, calc(15 * var(--u))); }
.rr-needs__item.is-short { box-shadow: 0 0 0 2px #ff6a5a; }

.rr-btn {
  border: calc(3 * var(--u)) solid rgba(255, 255, 255, 0.9);
  border-radius: calc(10 * var(--u));
  padding: calc(6 * var(--u)) calc(18 * var(--u));
  min-height: 28px;
  font-size: max(calc(12px * var(--f)), calc(26 * var(--u)));
  color: #fff;
  background: linear-gradient(#7ae84a, #4ec42e);
  box-shadow: 0 calc(4 * var(--u)) 0 #2f8a1e;
}
.rr-btn:active { transform: translateY(2px); box-shadow: 0 calc(2 * var(--u)) 0 #2f8a1e; }
.rr-btn--gray { background: linear-gradient(#d8dce2, #b8bec8); box-shadow: 0 calc(4 * var(--u)) 0 #8a909a; }
.rr-btn--blue { background: linear-gradient(#5ab8ff, #2f8ad8); box-shadow: 0 calc(4 * var(--u)) 0 #1f5ea0; }
.rr-btn--red { background: linear-gradient(#ff7a52, #f24a2a); box-shadow: 0 calc(4 * var(--u)) 0 #b8301a; }
.rr-btn--gold { background: linear-gradient(#ffd23a, #f5a81a); box-shadow: 0 calc(4 * var(--u)) 0 #b0700a; }
.rr-btn--small { font-size: max(calc(10px * var(--f)), calc(20 * var(--u))); padding: calc(4 * var(--u)) calc(12 * var(--u)); }
.rr-window__body > .rr-btn--small { align-self: flex-start; }
.rr-btn[disabled] { opacity: 0.55; cursor: default; }

/* --------------------------------------------------------- shop specifics */
.rr-shop { display: flex; gap: calc(16 * var(--u)); flex: 1; min-height: 0; }
.rr-shop__list { flex: 1.6; min-width: 0; display: flex; flex-direction: column; gap: calc(10 * var(--u)); }
.rr-shop__detail {
  flex: 1;
  min-width: 0;
  background: #f6efe6;
  border: 2px solid #e6dace;
  border-radius: calc(16 * var(--u));
  padding: calc(18 * var(--u));
  display: flex;
  flex-direction: column;
  gap: calc(10 * var(--u));
}
.rr-shop__rarity { font-size: max(calc(14px * var(--f)), calc(34 * var(--u))); }
.rr-shop__name { font-size: max(calc(12px * var(--f)), calc(28 * var(--u))); color: #9a8a7a; }
.rr-shop__desc { font-size: max(calc(11px * var(--f)), calc(22 * var(--u))); color: #9a8a7a; font-style: italic; }
.rr-shop__thumb { width: calc(110 * var(--u)); height: calc(110 * var(--u)); min-width: 50px; min-height: 50px; border-radius: calc(12 * var(--u)); background: #ebe2d6; border: 2px solid #e2d6c8; padding: 4px; float: right; }
.rr-shop__stat { display: flex; justify-content: space-between; font-size: max(calc(12px * var(--f)), calc(26 * var(--u))); }
.rr-shop__buy { margin-top: auto; height: calc(70 * var(--u)); min-height: 34px; font-size: max(calc(15px * var(--f)), calc(34 * var(--u))); }
.rr-shop__foot { display: flex; align-items: center; justify-content: flex-end; gap: calc(14 * var(--u)); font-size: max(calc(14px * var(--f)), calc(34 * var(--u))); }

/* --------------------------------------------------------- list rows (boards) */
.rr-list { display: flex; flex-direction: column; gap: calc(10 * var(--u)); }
.rr-entry {
  display: flex;
  align-items: center;
  gap: calc(16 * var(--u));
  padding: calc(10 * var(--u)) calc(18 * var(--u));
  border-radius: calc(12 * var(--u));
  background: #f4efe9;
  border: calc(3 * var(--u)) solid #c8c0b8;
  color: #4a3e34;
}
.rr-entry--1 { background: #fff1cc; border-color: #ecd7a0; }
.rr-entry--2 { background: #f2eeea; border-color: #c8c4c0; }
.rr-entry--3 { background: #fde8d8; border-color: #ecc4a8; }
.rr-entry--me { border-color: #5ab8ff; }
.rr-entry__place { font-size: max(calc(16px * var(--f)), calc(40 * var(--u))); width: calc(70 * var(--u)); text-align: center; }
.rr-entry__face { width: calc(76 * var(--u)); height: calc(76 * var(--u)); min-width: 30px; min-height: 30px; border-radius: calc(10 * var(--u)); background: #dfe8f2 center / cover; flex: none; }
.rr-entry__name { font-size: max(calc(13px * var(--f)), calc(30 * var(--u))); color: #3a9ae8; }
.rr-entry__meta { font-size: max(calc(10px * var(--f)), calc(20 * var(--u))); color: #8a7a6a; }
.rr-entry__value { margin-left: auto; font-size: max(calc(14px * var(--f)), calc(32 * var(--u))); color: #3a3a3a; white-space: nowrap; }
.rr-tabs { display: flex; gap: calc(10 * var(--u)); align-items: center; border-bottom: 2px solid #e6dace; padding-bottom: calc(6 * var(--u)); }
.rr-tab { border: none; background: none; font-size: max(calc(12px * var(--f)), calc(26 * var(--u))); color: #9a8a7a; padding: calc(6 * var(--u)) calc(14 * var(--u)); border-radius: calc(10 * var(--u)); }
.rr-tab.is-on { color: #3a9ae8; background: #e8f4ff; }

/* --------------------------------------------------------------- skill cards */
.rr-skill { align-items: stretch; text-align: left; padding: calc(14 * var(--u)) calc(16 * var(--u)); min-height: calc(200 * var(--u)); }
.rr-skill__name { font-size: max(calc(13px * var(--f)), calc(30 * var(--u))); }
.rr-skill__art { position: absolute; right: calc(8 * var(--u)); top: 18%; width: 46%; height: 62%; }
.rr-skill__level { margin-top: auto; font-size: max(calc(13px * var(--f)), calc(30 * var(--u))); color: #ffd23a; }
.rr-skill__xp { font-size: max(calc(10px * var(--f)), calc(20 * var(--u))); color: #9a8a7a; }
.rr-bar { height: calc(14 * var(--u)); min-height: 6px; border-radius: 999px; background: #fff; border: 2px solid #e2d6c8; overflow: hidden; }
.rr-bar__fill { height: 100%; background: linear-gradient(#ffe066, #ffc21a); width: 0; }
.rr-bar--green .rr-bar__fill { background: linear-gradient(#7ae84a, #4ec42e); }
.rr-skill.is-locked .rr-skill__art { filter: grayscale(1) opacity(0.4); }

/* --------------------------------------------------------------- dialogs */
.rr-dialog { font-size: max(calc(13px * var(--f)), calc(30 * var(--u))); color: var(--rr-brown); text-align: center; display: flex; flex-direction: column; gap: calc(14 * var(--u)); align-items: center; }
.rr-dialog__big { font-size: max(calc(18px * var(--f)), calc(48 * var(--u))); color: #3fb82a; }
.rr-dialog__buttons { display: flex; gap: calc(14 * var(--u)); justify-content: center; flex-wrap: wrap; }

/* ----------------------------------------------------------------- build bar */
.rr-build {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: max(calc(10px * var(--f)), calc(18 * var(--u)), env(safe-area-inset-bottom, 0px));
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(8 * var(--u));
  font-family: var(--rr-font);
  width: min(96vw, calc(1300 * var(--u)));
}
.rr-build__tools { display: flex; gap: calc(10 * var(--u)); flex-wrap: wrap; justify-content: center; }
.rr-build__strip {
  display: flex;
  gap: calc(8 * var(--u));
  padding: calc(10 * var(--u));
  background: rgba(255, 255, 255, 0.95);
  border-radius: calc(16 * var(--u));
  box-shadow: 0 calc(6 * var(--u)) calc(14 * var(--u)) rgba(0, 0, 0, 0.2);
  overflow-x: auto;
  max-width: 100%;
}
.rr-build__slot {
  position: relative;
  flex: none;
  width: calc(104 * var(--u));
  height: calc(104 * var(--u));
  min-width: 52px;
  min-height: 52px;
  border-radius: calc(12 * var(--u));
  border: 2px solid #e6dace;
  background: #f6efe6;
  padding: calc(6 * var(--u));
}
.rr-build__slot.is-selected { background: #8ccfff; border-color: #2f8ad8; }
.rr-build__count { position: absolute; right: calc(4 * var(--u)); bottom: calc(2 * var(--u)); font-size: max(10px, calc(20 * var(--u))); }
.rr-build__hint { font-size: max(calc(12px * var(--f)), calc(26 * var(--u))); padding: calc(4 * var(--u)) calc(16 * var(--u)); border-radius: 999px; background: rgba(20, 28, 44, 0.6); }
.rr-build__empty { padding: calc(10 * var(--u)) calc(20 * var(--u)); color: #8a7a6a; font-size: max(12px, calc(24 * var(--u))); }

/* -------------------------------------------------------- world overlay */
.rr-world { position: fixed; inset: 0; pointer-events: none; z-index: 15; font-family: var(--rr-font); }
.rr-prompts { position: absolute; display: flex; flex-direction: column; gap: calc(6 * var(--u)); transform: translate(-50%, -100%); pointer-events: auto; }
.rr-prompt {
  display: flex;
  align-items: center;
  gap: calc(10 * var(--u));
  padding: calc(6 * var(--u)) calc(16 * var(--u)) calc(6 * var(--u)) calc(6 * var(--u));
  background: rgba(24, 24, 28, 0.78);
  border-radius: calc(10 * var(--u));
  color: #fff;
  font-size: max(calc(13px * var(--f)), calc(26 * var(--u)));
  cursor: pointer;
  white-space: nowrap;
}
.rr-prompt__key {
  width: calc(46 * var(--u));
  height: calc(46 * var(--u));
  min-width: 24px;
  min-height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 2px solid rgba(255, 255, 255, 0.85);
  font-size: max(11px, calc(20 * var(--u)));
}
.rr-prompt__key span { width: 62%; height: 62%; border: 2px solid #fff; border-radius: 4px; display: grid; place-items: center; }
.rr-prompt__object { display: block; font-size: 0.72em; color: #d8d8d8; }
.rr-label { position: absolute; transform: translate(-50%, -100%); pointer-events: none; text-align: center; }
.rr-bubble {
  display: flex;
  align-items: center;
  gap: calc(4 * var(--u));
  padding: calc(6 * var(--u)) calc(10 * var(--u));
  background: rgba(255, 255, 255, 0.96);
  border-radius: calc(14 * var(--u));
  border: calc(3 * var(--u)) solid #fff;
  box-shadow: 0 calc(4 * var(--u)) calc(8 * var(--u)) rgba(0, 0, 0, 0.2);
  position: relative;
}
.rr-bubble::after { content: ''; position: absolute; left: 50%; bottom: calc(-12 * var(--u)); transform: translateX(-50%); border: calc(10 * var(--u)) solid transparent; border-top-color: #fff; }
.rr-bubble__icon { width: calc(66 * var(--u)); height: calc(66 * var(--u)); min-width: 30px; min-height: 30px; }
.rr-bubble__col { display: flex; flex-direction: column; align-items: flex-start; }
.rr-bubble__price { font-size: max(calc(11px * var(--f)), calc(22 * var(--u))); color: #3fb82a; }
.rr-bubble__timer { font-size: max(calc(9px * var(--f)), calc(17 * var(--u))); color: #9a8a7a; }
.rr-bubble__bar { width: calc(150 * var(--u)); min-width: 64px; }
.rr-progress { min-width: calc(220 * var(--u)); flex-direction: column; align-items: stretch; padding: calc(8 * var(--u)) calc(12 * var(--u)); }
.rr-progress__top { display: flex; align-items: center; justify-content: space-between; gap: calc(8 * var(--u)); font-size: max(10px, calc(19 * var(--u))); color: #9a8a7a; }
.rr-collect { text-align: center; }
.rr-collect__label { font-size: max(calc(11px * var(--f)), calc(24 * var(--u))); }
.rr-collect__amount { font-size: max(calc(18px * var(--f)), calc(46 * var(--u))); color: #6aef3a; }
.rr-collect__arrow { width: 0; height: 0; margin: 0 auto; border: calc(14 * var(--u)) solid transparent; border-top-color: #3fb82a; }
.rr-tag { padding: calc(4 * var(--u)) calc(12 * var(--u)); border-radius: calc(10 * var(--u)); background: rgba(255, 255, 255, 0.95); color: var(--rr-brown); font-size: max(10px, calc(20 * var(--u))); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2); }
.rr-tag b { color: #3fb82a; }
.rr-ready { font-size: max(calc(12px * var(--f)), calc(26 * var(--u))); color: #9dff7a; }
.rr-popup { position: absolute; transform: translate(-50%, -50%); font-size: max(calc(16px * var(--f)), calc(40 * var(--u))); animation: rr-rise 1.2s ease-out forwards; pointer-events: none; white-space: nowrap; }
@keyframes rr-rise { 0% { opacity: 0; transform: translate(-50%, -30%) scale(0.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.1); } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1); } }

/* --------------------------------------------------------------- tutorial */
.rr-tut { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: var(--rr-font); }
.rr-tut__speech {
  position: absolute;
  max-width: min(70vw, calc(900 * var(--u)));
  transform: translate(-50%, -100%);
  padding: calc(16 * var(--u)) calc(30 * var(--u));
  background: rgba(220, 210, 200, 0.55);
  border: calc(4 * var(--u)) solid rgba(255, 255, 255, 0.6);
  border-radius: calc(30 * var(--u));
  font-size: max(calc(18px * var(--f)), calc(54 * var(--u)));
  line-height: 1.1;
  text-align: center;
  backdrop-filter: blur(2px);
}
.rr-tut__speech::after { content: ''; position: absolute; left: 50%; bottom: calc(-26 * var(--u)); transform: translateX(-50%); border: calc(18 * var(--u)) solid transparent; border-top-color: rgba(220, 210, 200, 0.75); }
.rr-tut__line {
  position: absolute;
  left: 50%;
  top: max(calc(56px * var(--f)), calc(120 * var(--u)));
  transform: translateX(-50%);
  font-size: max(calc(15px * var(--f)), calc(38 * var(--u)));
  text-align: center;
  max-width: 80vw;
}
.rr-skip {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(max(calc(10px * var(--f)), calc(18 * var(--u))) + max(46px, calc(96 * var(--u))) + calc(80 * var(--u)));
  padding: calc(14 * var(--u)) calc(56 * var(--u));
  border-radius: calc(14 * var(--u));
  border: calc(3 * var(--u)) solid rgba(255, 255, 255, 0.4);
  background: linear-gradient(#ff7a52, #f25a3a);
  box-shadow: 0 calc(5 * var(--u)) 0 #b8301a;
  font-size: max(calc(14px * var(--f)), calc(34 * var(--u)));
  pointer-events: auto;
  font-family: var(--rr-font);
  cursor: pointer;
  z-index: 31;
}
.rr-tut__pointer { position: absolute; width: calc(120 * var(--u)); height: calc(80 * var(--u)); animation: rr-nudge 0.8s ease-in-out infinite; }
@keyframes rr-nudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(calc(14 * var(--u))); } }

/* ---------------------------------------------------------------- touch */
body.aoe-touch-mode .rr-task { top: 26%; width: calc(260 * var(--u)); }
/* Touch: the stick owns the bottom-left corner, so the rail rides high and the money sits beside it. */
body.aoe-touch-mode .rr-rail { top: max(6px, env(safe-area-inset-top, 0px)); transform: none; gap: 4px; padding: 6px 5px; }
body.aoe-touch-mode .rr-rail__btn { width: 42px; height: 42px; min-width: 42px; min-height: 42px; }
body.aoe-touch-mode .rr-rail__label { font-size: 9px; }
body.aoe-touch-mode .rr-money { top: max(6px, env(safe-area-inset-top, 0px)); bottom: auto; left: calc(max(10px, env(safe-area-inset-left, 0px)) + 64px); flex-direction: row-reverse; align-items: center; gap: 12px; }
body.aoe-touch-mode .rr-money__cash { font-size: 22px; }
body.aoe-touch-mode .rr-visiting { top: 52px; }
body.aoe-touch-mode .rr-toasts { top: 96px; }
body.aoe-touch-mode .rr-build { bottom: calc(max(46px, calc(96 * var(--u))) + 20px); }
@media (max-height: 520px) {
  .rr-window { max-height: 96vh; }
  .rr-task { top: 30%; }
}
`;
