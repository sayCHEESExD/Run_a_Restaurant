import {
  FISH,
  RARITIES,
  MAX_RANK,
  RANKS,
  RANK_UNLOCKS,
  SKILLS,
  TASKS,
  formatAmount,
  levelProgress,
  type SelfState,
} from '@restaurant/shared';
import type { ArtKey } from '../models/icons.js';
import type { IconFactory } from './IconFactory.js';
import { GameWindow, button, el, icon } from './Modal.js';

const SKILL_ART: readonly ArtKey[] = ['service', 'cooking', 'cleaning', 'farming', 'ranching', 'fishing'];

/**
 * SKILLS, with the reference's tabs: the five skills as cards (level, XP to
 * the next, a bar; Farming and Ranching locked until the restaurant ranks
 * up), the RANK page (the badge ladder, what the points are made of and
 * what each rank unlocks) and the MILESTONES list.
 */
export class SkillsWindow extends GameWindow {
  private self: SelfState | null = null;
  private rank = 0;
  private viewing = -1;

  constructor(container: HTMLElement, private readonly icons: IconFactory, private readonly claim: () => void, private readonly goFishing: () => void = () => undefined) {
    super(container, 'Skills', 'large', [
      { id: 'skills', label: 'Skills', art: icons.art('skills') },
      { id: 'rank', label: 'Rank', art: icons.art('rank') },
      { id: 'milestones', label: 'Milestones', art: icons.art('milestones') },
    ]);
  }

  setState(self: SelfState | null, rank: number): void {
    this.self = self;
    this.rank = rank;
    if (this.isOpen) this.refresh();
  }

  override select(id: string): void {
    this.viewing = -1;
    super.select(id);
  }

  override refresh(): void {
    if (this.tab === 'skills') this.drawSkills();
    else if (this.tab === 'rank') this.drawRank();
    else this.drawMilestones();
  }

  private drawSkills(): void {
    this.setTitle('Skills');
    const self = this.self;
    if (this.viewing >= 0) {
      const skill = SKILLS[this.viewing]!;
      const p = levelProgress(self?.xp[skill.index] ?? 0);
      const box = el('div', 'rr-dialog');
      const art = icon(this.icons.art(SKILL_ART[skill.index]!), '');
      art.style.width = 'calc(180 * var(--u))';
      box.append(el('div', 'rr-dialog__big rr-outline', skill.name), art, el('div', '', `Level ${p.level}  -  ${formatAmount(p.into)}/${formatAmount(p.span)} XP`), el('div', '', skill.perk));
      box.appendChild(el('div', 'rr-card__sub', skill.key === 'fishing' ? 'Cast with E at the end of the Fishing Pier (south beach) or by the park pond, and reel in when the bobber dips!' : 'Skills grow by doing the work yourself. Your staff earn you half the XP of what they do.'));
      if (skill.key === 'fishing') {
        box.appendChild(button('rr-btn rr-btn--blue', 'Go Fishing!', () => this.goFishing()));
        const caught = new Map((self?.fishIndex ?? []).map((f) => [f.id, f.count]));
        const best = self?.bestFish;
        if (best && best.weight > 0) box.appendChild(el('div', 'rr-outline-thin', `Biggest catch: ${FISH.find((f) => f.id === best.fish)?.name} ${best.weight.toFixed(2)} kg`));
        const grid = el('div', 'rr-grid');
        grid.style.width = '100%';
        for (const fish of FISH) {
          const n = caught.get(fish.id) ?? 0;
          const card = el('div', `rr-card${n ? '' : ' is-locked'}`);
          card.style.cursor = 'default';
          const rarity = el('div', 'rr-card__sub rr-outline-thin', RARITIES[fish.rarity].name);
          rarity.style.color = RARITIES[fish.rarity].color;
          card.append(icon(this.icons.fish(fish.id), 'rr-card__art'), el('div', 'rr-card__name rr-outline-thin', n ? fish.name : '???'), rarity, el('div', 'rr-card__sub', `${fish.water === 'sea' ? 'Pier' : 'Pond'} - caught ${n}`));
          grid.appendChild(card);
        }
        box.appendChild(grid);
      }
      const scroll = el('div', 'rr-scroll');
      scroll.appendChild(box);
      this.body.replaceChildren(
        button('rr-btn rr-btn--gray rr-btn--small', '< Back', () => {
          this.viewing = -1;
          this.refresh();
        }),
        scroll,
      );
      return;
    }
    const grid = el('div', 'rr-grid rr-grid--wide');
    for (const skill of SKILLS) {
      const locked = skill.rank > this.rank;
      const p = levelProgress(self?.xp[skill.index] ?? 0);
      const card = el('div', `rr-card rr-skill${locked ? ' is-locked' : ''}`);
      card.append(el('div', 'rr-skill__name rr-outline-thin', locked ? `\u{1f512} Locked` : skill.name), icon(this.icons.art(SKILL_ART[skill.index]!), 'rr-skill__art'));
      card.append(el('div', 'rr-skill__level rr-outline-thin', `Level ${p.level}`), el('div', 'rr-skill__xp', locked ? `Unlocks at ${RANKS[skill.rank]!.name}` : `${formatAmount(p.into)}/${formatAmount(p.span)} xp`));
      const bar = el('div', 'rr-bar');
      const fill = el('div', 'rr-bar__fill');
      fill.style.width = `${locked ? 0 : (p.into / p.span) * 100}%`;
      bar.appendChild(fill);
      card.appendChild(bar);
      if (!locked) {
        card.addEventListener('click', () => {
          this.viewing = skill.index;
          this.refresh();
        });
      }
      grid.appendChild(card);
    }
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(grid);
    this.body.replaceChildren(el('div', 'rr-hint', '☛ Tap Skill to View'), scroll);
  }

  private drawRank(): void {
    this.setTitle('Restaurant Rank');
    const b = this.self?.rank;
    const scroll = el('div', 'rr-scroll');
    const current = RANKS[this.rank]!;
    const next = RANKS[Math.min(MAX_RANK, this.rank + 1)]!;
    const box = el('div', 'rr-dialog');
    const name = el('div', 'rr-dialog__big rr-outline', current.name);
    name.style.color = current.color;
    box.appendChild(name);
    if (b) {
      box.appendChild(el('div', '', `${formatAmount(b.total)} rank points${this.rank < MAX_RANK ? ` - ${formatAmount(Math.max(0, next.points - b.total))} more for ${next.name}` : ''}`));
      const bar = el('div', 'rr-bar rr-bar--green');
      bar.style.width = '80%';
      const fill = el('div', 'rr-bar__fill');
      const span = Math.max(1, next.points - current.points);
      fill.style.width = `${this.rank >= MAX_RANK ? 100 : Math.min(100, ((b.total - current.points) / span) * 100)}%`;
      bar.appendChild(fill);
      box.appendChild(bar);
      const parts = el('div', 'rr-grid');
      parts.style.width = '100%';
      for (const [label, value] of [['Furniture & decor', b.items], ['Skill levels', b.skills], ['Customers served', b.served], ['Restaurant size', b.size]] as const) {
        const card = el('div', 'rr-card');
        card.style.cursor = 'default';
        card.append(el('div', 'rr-card__sub', label), el('div', 'rr-card__name rr-outline-thin', `+${formatAmount(value)}`));
        parts.appendChild(card);
      }
      box.appendChild(parts);
    }
    scroll.appendChild(box);
    scroll.appendChild(el('div', 'rr-section', 'Ranks'));
    const list = el('div', 'rr-list');
    for (const rank of RANKS) {
      const row = el('div', `rr-entry${rank.index === this.rank ? ' rr-entry--me' : ''}`);
      const badge = el('div', 'rr-entry__face');
      badge.style.background = `radial-gradient(circle at 40% 35%, ${rank.color}, ${rank.dark})`;
      badge.style.borderRadius = '50%';
      const words = el('div', '');
      const title = el('div', 'rr-entry__name', rank.name);
      title.style.color = rank.dark;
      words.append(title, el('div', 'rr-entry__meta', RANK_UNLOCKS[rank.index] ? `Unlocks: ${RANK_UNLOCKS[rank.index]}` : rank.index === 0 ? 'Where every restaurant begins' : 'More and rarer customers'));
      row.append(badge, words, el('div', 'rr-entry__value', rank.index <= this.rank ? '✔' : `${formatAmount(rank.points)} pts`));
      list.appendChild(row);
    }
    scroll.appendChild(list);
    this.body.replaceChildren(scroll);
  }

  private drawMilestones(): void {
    this.setTitle('Milestones');
    const self = this.self;
    const at = self?.task ?? 0;
    const list = el('div', 'rr-list');
    TASKS.forEach((task, i) => {
      const value = self?.stats[task.stat] ?? 0;
      const done = i < at;
      const current = i === at;
      const row = el('div', `rr-entry${current ? ' rr-entry--me' : ''}`);
      if (done) row.style.opacity = '0.55';
      const words = el('div', '');
      words.style.flex = '1';
      words.append(el('div', 'rr-entry__name', task.text), el('div', 'rr-entry__meta', [task.cash ? `$${formatAmount(task.cash)}` : '', task.diamonds ? `◆ ${task.diamonds}` : ''].filter(Boolean).join(' + ')));
      if (current) {
        const bar = el('div', 'rr-bar');
        const fill = el('div', 'rr-bar__fill');
        fill.style.width = `${Math.min(100, (value / task.target) * 100)}%`;
        bar.appendChild(fill);
        words.appendChild(bar);
      }
      row.appendChild(words);
      if (done) row.appendChild(el('div', 'rr-entry__value', '✔'));
      else if (current) row.appendChild(button(`rr-btn ${value >= task.target ? '' : 'rr-btn--gray'}`, value >= task.target ? 'Claim!' : `${formatAmount(Math.min(value, task.target))}/${formatAmount(task.target)}`, () => this.claim()));
      else row.appendChild(el('div', 'rr-entry__value', '\u{1f512}'));
      list.appendChild(row);
    });
    const scroll = el('div', 'rr-scroll');
    scroll.appendChild(list);
    this.body.replaceChildren(scroll);
    requestAnimationFrame(() => {
      const current = list.children[at] as HTMLElement | undefined;
      if (current) scroll.scrollTop = current.offsetTop - 40;
    });
  }
}
