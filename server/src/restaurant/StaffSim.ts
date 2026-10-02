import {
  CARRY,
  DOOR,
  BUILDING,
  FARM,
  FARM_GATE_Z,
  MANAGER,
  PHASE,
  RANCH,
  RANCH_GATE_Z,
  SKILL,
  STAFF_WALK,
  STAFF_WORK,
  STAFF_XP_SHARE,
  STAGE,
  XP,
  findPath,
  levelOf,
  nearestFree,
  recipeById,
  staffById,
  staffSpeed,
  type Point,
  type StaffRole,
} from '@restaurant/shared';
import type { HiredRecord } from '../persistence/index.js';
import { StaffState, type ItemState } from '../rooms/state/RestaurantState.js';
import { fridgeCapacity, fridgeTotal } from './Chef.js';
import type { Floor } from './Floor.js';
import { Restaurant, freshId, type StaffRuntime, type StaffTask } from './Restaurant.js';
import type { RoomContext } from './RoomContext.js';

/** Seconds idle before wandering back to their post. */
const HOME_AFTER = 2.5;

/**
 * THE STAFF AT WORK. Each member picks the most useful job for their role,
 * CLAIMS what it is about (so two never chase the same customer), walks a
 * route the grid finds round the furniture, pauses to do the work, and checks
 * on arrival that the job still needs doing - the owner may have done it
 * themselves, or the customer may have left.
 */
export class StaffSim {
  constructor(
    private readonly ctx: RoomContext,
    private readonly floor: Floor,
  ) {}

  // -------------------------------------------------------------- roster

  roleOf(s: StaffRuntime): StaffRole {
    return staffById(s.state.member)?.role ?? 'waiter';
  }

  /** How fast a member is right now: their level, and any manager's boost. */
  speedOf(r: Restaurant, s: StaffRuntime): number {
    const def = staffById(s.state.member);
    if (!def) return 1;
    let boost = 1;
    if (def.role !== 'manager') {
      for (const other of r.staff.values()) {
        const m = staffById(other.state.member);
        if (m?.role === 'manager') boost = Math.max(boost, 1 + MANAGER.staffBoost * staffSpeed(m, other.state.level));
      }
    }
    return staffSpeed(def, s.state.level) * boost;
  }

  /** Put a hired member to work in the restaurant. */
  spawn(r: Restaurant, hired: number, record: HiredRecord, now: number): void {
    const state = new StaffState();
    state.id = freshId();
    state.member = record.member;
    state.level = record.level;
    const role = staffById(record.member)?.role ?? 'waiter';
    const home = this.home(r, role);
    const walk = Restaurant.standAt(home.x, home.z, now);
    Restaurant.publish(state, walk);
    state.face = Math.PI;
    r.staff.set(state.id, { state, hired, walk, task: null, workUntil: 0, idleSince: now });
    r.state.staff.set(String(state.id), state);
  }

  remove(r: Restaurant, s: StaffRuntime): void {
    this.drop(r, s);
    r.staff.delete(s.state.id);
    r.state.staff.delete(String(s.state.id));
  }

  /** Where each role waits between jobs. */
  home(r: Restaurant, role: StaffRole): Point {
    const near = (item: ItemState | undefined, fallback: Point): Point => (item ? this.floor.access(r, item) : fallback);
    const door = { x: DOOR.x + 2, z: BUILDING.frontZ + 3 };
    switch (role) {
      case 'waiter':
        return near(r.firstOf('stand'), door);
      case 'cook':
        return near(r.firstOf('stove'), door);
      case 'cleaner':
        return near(r.firstOf('sink'), door);
      case 'farmer':
        return nearestFree(r.nav, FARM.minX + 2, FARM_GATE_Z) ?? { x: FARM.minX + 2, z: FARM_GATE_Z };
      case 'rancher':
        return nearestFree(r.nav, RANCH.minX + 2, RANCH_GATE_Z) ?? { x: RANCH.minX + 2, z: RANCH_GATE_Z };
      case 'manager':
        return near(r.firstOf('register'), door);
    }
  }

  // ---------------------------------------------------------------- tick

  tick(r: Restaurant, now: number, delta: number): void {
    r.managerTimer -= delta;
    for (const s of [...r.staff.values()]) {
      if (s.task) {
        if (now < s.walk.arriveAt) continue;
        if (s.workUntil === 0) {
          // Arrived: do the work, which takes a moment.
          s.workUntil = now + (STAFF_WORK / this.speedOf(r, s)) * 1000;
          s.state.pose = 1;
          const at = Restaurant.positionOf(s.walk, now);
          s.state.face = at.yaw;
          continue;
        }
        if (now < s.workUntil) continue;
        s.workUntil = 0;
        s.state.pose = 0;
        this.step(r, s, now);
        continue;
      }
      if (!this.choose(r, s, now)) this.idle(r, s, now);
    }
  }

  private idle(r: Restaurant, s: StaffRuntime, now: number): void {
    if (s.idleSince === 0) s.idleSince = now;
    if (now - s.idleSince < HOME_AFTER * 1000) return;
    const home = this.home(r, this.roleOf(s));
    const here = Restaurant.positionOf(s.walk, now);
    if (Math.hypot(home.x - here.x, home.z - here.z) < 1.2) return;
    if (this.walkTo(r, s, home, now)) s.task = { kind: 'home' };
    s.idleSince = now;
  }

  /** Start walking somewhere. False when there is no way there. */
  private walkTo(r: Restaurant, s: StaffRuntime, target: Point, now: number): boolean {
    const from = Restaurant.positionOf(s.walk, now);
    const walk = Restaurant.route(findPath(r.nav, from, target), now, STAFF_WALK * this.speedOf(r, s));
    if (!walk) return false;
    s.walk = walk;
    s.workUntil = 0;
    s.state.pose = 0;
    Restaurant.publish(s.state, walk);
    return true;
  }

  private begin(r: Restaurant, s: StaffRuntime, task: StaffTask, target: Point, now: number, claims: string[]): boolean {
    for (const key of claims) {
      if (!r.claim(key)) {
        for (const k of claims) if (k !== key) r.release(k);
        return false;
      }
    }
    if (!this.walkTo(r, s, target, now)) {
      for (const key of claims) r.release(key);
      return false;
    }
    s.task = task;
    s.idleSince = 0;
    return true;
  }

  private finish(r: Restaurant, s: StaffRuntime): void {
    this.releaseTask(r, s.task);
    s.task = null;
    s.idleSince = 0;
  }

  private releaseTask(r: Restaurant, task: StaffTask | null): void {
    if (!task) return;
    switch (task.kind) {
      case 'seat':
      case 'order':
        r.release(`cust:${task.customer}`);
        break;
      case 'serve':
        r.release(`order:${task.order}`);
        break;
      case 'cook':
        r.release(`order:${task.order}`);
        r.release(`stove:${task.stove}`);
        break;
      case 'clean':
        r.release(`chair:${task.chair}`);
        break;
      case 'harvest':
      case 'collect':
        r.release(`item:${task.item}`);
        break;
      case 'cash':
        r.release('register');
        break;
      case 'home':
        break;
    }
  }

  /** Let go of whatever a member holds and has claimed (fired, or their job vanished). */
  drop(r: Restaurant, s: StaffRuntime): void {
    const task = s.task;
    if (task?.kind === 'cook' && task.step === 1) {
      const order = r.state.orders.get(String(task.order));
      if (order && order.stage === STAGE.ticket) order.stage = STAGE.posted;
    }
    if (task?.kind === 'serve' && task.step === 1) {
      const order = r.state.orders.get(String(task.order));
      if (order && order.stage === STAGE.plate) order.stage = STAGE.ready;
    }
    this.finish(r, s);
    this.carry(s, CARRY.none);
  }

  private carry(s: StaffRuntime, kind: number, recipe = 0): void {
    s.state.carry = kind;
    s.state.carryRecipe = recipe;
  }

  private xp(r: Restaurant, skill: number, amount: number): void {
    if (r.owner) this.ctx.xp(r.owner, skill, amount * STAFF_XP_SHARE);
  }

  // ------------------------------------------------------------- choosing

  private choose(r: Restaurant, s: StaffRuntime, now: number): boolean {
    switch (this.roleOf(s)) {
      case 'waiter':
        return this.chooseServe(r, s, now) || this.chooseOrder(r, s, now) || this.chooseSeat(r, s, now);
      case 'cook':
        return this.chooseCook(r, s, now);
      case 'cleaner':
        return this.chooseClean(r, s, now);
      case 'farmer':
        return this.chooseHarvest(r, s, now);
      case 'rancher':
        return this.chooseCollect(r, s, now);
      case 'manager':
        return this.chooseCash(r, s, now);
    }
  }

  private chooseServe(r: Restaurant, s: StaffRuntime, now: number): boolean {
    const stand = r.firstOf('stand');
    if (!stand) return false;
    const order = this.floor.oldest(r, STAGE.ready, true);
    if (!order) return false;
    const customer = r.customers.get(order.customer);
    if (!customer || customer.state.phase !== PHASE.waiting) return false;
    return this.begin(r, s, { kind: 'serve', order: order.id, customer: order.customer, step: 0 }, this.floor.access(r, stand), now, [`order:${order.id}`]);
  }

  private chooseOrder(r: Restaurant, s: StaffRuntime, now: number): boolean {
    for (const c of r.customers.values()) {
      if (c.state.phase !== PHASE.ready || r.claims.has(`cust:${c.state.id}`)) continue;
      const chair = r.item(c.state.seat);
      if (!chair) continue;
      const spot = this.beside(r, chair);
      if (this.begin(r, s, { kind: 'order', customer: c.state.id }, spot, now, [`cust:${c.state.id}`])) return true;
    }
    return false;
  }

  private chooseSeat(r: Restaurant, s: StaffRuntime, now: number): boolean {
    if (r.freeSeats().length === 0) return false;
    const front = this.floor.queue(r).find((c) => !r.claims.has(`cust:${c.state.id}`));
    if (!front) return false;
    const spot = nearestFree(r.nav, DOOR.x + 1.6, BUILDING.frontZ + 3.2) ?? { x: DOOR.x, z: BUILDING.frontZ + 3 };
    return this.begin(r, s, { kind: 'seat', customer: front.state.id }, spot, now, [`cust:${front.state.id}`]);
  }

  private chooseCook(r: Restaurant, s: StaffRuntime, now: number): boolean {
    const stand = r.firstOf('stand');
    if (!stand) return false;
    const order = this.floor.oldest(r, STAGE.posted, true);
    if (!order) return false;
    const stove = r.itemsOf('stove').find((st) => st.c === 0 && !r.claims.has(`stove:${st.id}`));
    if (!stove) return false;
    return this.begin(r, s, { kind: 'cook', order: order.id, stove: stove.id, step: 0 }, this.floor.access(r, stand), now, [`order:${order.id}`, `stove:${stove.id}`]);
  }

  private chooseClean(r: Restaurant, s: StaffRuntime, now: number): boolean {
    const sink = this.bestSink(r);
    if (!sink) return false;
    for (const chair of r.itemsOf('chair')) {
      if (chair.b === 0 || r.claims.has(`chair:${chair.id}`)) continue;
      if (this.begin(r, s, { kind: 'clean', chair: chair.id, sink: sink.id, step: 0 }, this.beside(r, chair), now, [`chair:${chair.id}`])) return true;
    }
    return false;
  }

  private chooseHarvest(r: Restaurant, s: StaffRuntime, now: number): boolean {
    const owner = r.owner;
    if (!owner || fridgeTotal(owner) >= fridgeCapacity(owner)) return false;
    for (const crop of r.itemsOf('crop')) {
      if (now < crop.a || r.claims.has(`item:${crop.id}`)) continue;
      if (this.begin(r, s, { kind: 'harvest', item: crop.id }, this.beside(r, crop), now, [`item:${crop.id}`])) return true;
    }
    return false;
  }

  private chooseCollect(r: Restaurant, s: StaffRuntime, now: number): boolean {
    const owner = r.owner;
    if (!owner || fridgeTotal(owner) >= fridgeCapacity(owner)) return false;
    for (const pen of r.itemsOf('animal')) {
      if (pen.b <= 0 || r.claims.has(`item:${pen.id}`)) continue;
      if (this.begin(r, s, { kind: 'collect', item: pen.id }, this.beside(r, pen), now, [`item:${pen.id}`])) return true;
    }
    return false;
  }

  private chooseCash(r: Restaurant, s: StaffRuntime, now: number): boolean {
    if (r.managerTimer > 0 || r.state.register < 1) return false;
    const register = r.firstOf('register');
    if (!register) return false;
    r.managerTimer = MANAGER.collectEvery;
    return this.begin(r, s, { kind: 'cash' }, this.floor.access(r, register), now, ['register']);
  }

  /** A free spot next to an item (a chair's side, a crop bed's edge). */
  private beside(r: Restaurant, item: ItemState): Point {
    return this.floor.access(r, item);
  }

  private bestSink(r: Restaurant): ItemState | undefined {
    let best: ItemState | undefined;
    for (const sink of r.itemsOf('sink')) if (this.floor.sinkRoom(sink) > 0 && (!best || this.floor.sinkRoom(sink) > this.floor.sinkRoom(best))) best = sink;
    return best;
  }

  // ---------------------------------------------------------------- steps

  /** The member arrived and has done the work's moment: carry it out. */
  private step(r: Restaurant, s: StaffRuntime, now: number): void {
    const task = s.task;
    if (!task) return;
    switch (task.kind) {
      case 'home':
        this.finish(r, s);
        s.state.face = Math.PI;
        return;
      case 'seat': {
        const c = r.customers.get(task.customer);
        if (c && !this.floor.seat(r, c, now)) this.xp(r, SKILL.service, XP.seat);
        this.finish(r, s);
        return;
      }
      case 'order': {
        const c = r.customers.get(task.customer);
        if (c && c.state.phase === PHASE.ready && !this.floor.order(r, c, now)) this.xp(r, SKILL.service, XP.order);
        this.finish(r, s);
        return;
      }
      case 'serve': {
        const order = r.state.orders.get(String(task.order));
        if (task.step === 0) {
          const c = r.customers.get(task.customer);
          const chair = c ? r.item(c.state.seat) : undefined;
          if (!order || order.stage !== STAGE.ready || !c || c.state.phase !== PHASE.waiting || !chair) {
            this.finish(r, s);
            return;
          }
          order.stage = STAGE.plate;
          this.carry(s, CARRY.plate, order.recipe);
          task.step = 1;
          if (!this.walkTo(r, s, this.beside(r, chair), now)) this.drop(r, s);
          return;
        }
        const c = r.customers.get(task.customer);
        if (order && c && c.state.phase === PHASE.waiting && order.customer === c.state.id) {
          this.floor.serve(r, c, order, now);
          this.xp(r, SKILL.service, XP.serve);
        }
        this.carry(s, CARRY.none);
        this.finish(r, s);
        return;
      }
      case 'cook': {
        const order = r.state.orders.get(String(task.order));
        if (task.step === 0) {
          if (!order || order.stage !== STAGE.posted) {
            this.finish(r, s);
            return;
          }
          order.stage = STAGE.ticket;
          this.carry(s, CARRY.ticket, order.recipe);
          task.step = 1;
          const stove = r.item(task.stove);
          if (!stove || !this.walkTo(r, s, this.floor.access(r, stove), now)) this.drop(r, s);
          return;
        }
        let stove = r.item(task.stove);
        if (stove && stove.c !== 0) stove = r.itemsOf('stove').find((st) => st.c === 0);
        if (!order || order.stage !== STAGE.ticket) {
          this.carry(s, CARRY.none);
          this.finish(r, s);
          return;
        }
        if (!stove) {
          this.drop(r, s);
          return;
        }
        const level = r.owner ? levelOf(r.owner.profile.xp[SKILL.cooking] ?? 0) : 1;
        this.floor.startCooking(r, order, stove, now, level);
        if (r.owner) r.owner.profile.counters.cooked += 1;
        this.xp(r, SKILL.cooking, XP.cook + Math.floor((recipeById(order.recipe)?.price ?? 0) / 5));
        this.carry(s, CARRY.none);
        this.finish(r, s);
        return;
      }
      case 'clean': {
        if (task.step === 0) {
          const chair = r.item(task.chair);
          if (!chair || chair.b === 0) {
            this.finish(r, s);
            return;
          }
          chair.b = 0;
          this.carry(s, CARRY.dish);
          this.xp(r, SKILL.cleaning, XP.pickup);
          task.step = 1;
          let sink = r.item(task.sink);
          if (!sink || this.floor.sinkRoom(sink) <= 0) sink = this.bestSink(r);
          if (!sink) {
            this.drop(r, s);
            return;
          }
          task.sink = sink.id;
          if (!this.walkTo(r, s, this.floor.access(r, sink), now)) this.drop(r, s);
          return;
        }
        let sink = r.item(task.sink);
        if (!sink || this.floor.sinkRoom(sink) <= 0) sink = this.bestSink(r);
        if (sink) this.floor.loadSink(r, sink, now);
        this.carry(s, CARRY.none);
        this.finish(r, s);
        return;
      }
      case 'harvest': {
        const crop = r.item(task.item);
        if (crop) {
          const got = this.floor.harvest(r, crop, now);
          if (typeof got === 'number') this.xp(r, SKILL.farming, XP.harvest);
        }
        this.finish(r, s);
        return;
      }
      case 'collect': {
        const pen = r.item(task.item);
        if (pen) {
          const got = this.floor.collect(r, pen);
          if (typeof got === 'number') this.xp(r, SKILL.ranching, XP.collect);
        }
        this.finish(r, s);
        return;
      }
      case 'cash':
        this.floor.collectRegister(r);
        this.finish(r, s);
        return;
    }
  }

  /** Something placed under a member's feet or a vanished target: re-plan everyone. */
  replanAll(r: Restaurant): void {
    for (const s of r.staff.values()) if (s.task?.kind === 'home') this.finish(r, s);
  }

  /** Item ids the staff are using (so they cannot be picked up mid-job). */
  busyItem(r: Restaurant, id: number): boolean {
    for (const s of r.staff.values()) {
      const t = s.task;
      if (!t) continue;
      if ((t.kind === 'cook' && t.stove === id) || (t.kind === 'clean' && (t.chair === id || t.sink === id)) || ((t.kind === 'harvest' || t.kind === 'collect') && t.item === id)) return true;
    }
    return false;
  }
}
