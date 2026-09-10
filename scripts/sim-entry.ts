import { Cubeman } from '../src/game/cubeman';
import { Shelf } from '../src/game/shelf';
import { Cube } from '../src/game/cube';
import { professions } from '../src/content/professions';

/**
 * Headless social invariant simulation — LINE layout: slot 0 / slot 1 /
 * slot 3, so the two outer cubes are NOT adjacent and every outer-to-outer
 * visit is a MULTI-HOP trip through the middle cube's living room.
 *
 * A minimal VisitSession emulation seals host + visitor on arrival and ends
 * the visit after 2–6s of simulated time, then sends the visitor home.
 */
export function createWorld() {
  const cubemen: Cubeman[] = [];
  const shelf = new Shelf([null, null, null, null], cubemen, 2);
  const cubes = [
    new Cube('cube-0', professions.stickman),
    new Cube('cube-1', professions.stickman),
    new Cube('cube-2', professions.dancer),
  ];
  const names = ['Sam', 'Dorian', 'Flip'];
  let session: { host: Cubeman; visitor: Cubeman } | null = null;
  let sessionEndsAt = 0;
  const stats = { visits: 0, multiHop: 0, violations: 0 };

  const cm = cubes.map((c, i) => new Cubeman({
    name: names[i], profession: c.prof, home: c, shelf,
    onVisitArrived: (v) => {
      const hops = shelf.pathTo(v.home, v.cube)?.length ?? 0;
      if (hops > 1) stats.multiHop++;
      const host = cm.find((h) => h.home === v.cube && h !== v);
      if (!host || host.cube !== host.home || (session && session.host === host)) return;
      host.resetMovement(); host.setInVisit(false); v.setInVisit(true);
      session = { host, visitor: v };
      sessionEndsAt = performance.now() + 2000 + Math.random() * 4000;
    },
  }));
  cubemen.push(...cm);
  shelf.slots[0] = cubes[0]; shelf.slots[1] = cubes[1]; shelf.slots[3] = cubes[2];

  return {
    tick(): void {
      for (const c of cm) c.tick();
      for (const cube of cubes) cube.tick();
      if (session && performance.now() >= sessionEndsAt) {
        session.host.clearInVisit();
        session.visitor.clearInVisit();
        session.visitor.beginReturnHome();
        stats.visits++;
        session = null;
      }
      // INVARIANT: an in-session visitor's host is home (not away/traveling)
      for (const v of cm) {
        if (!v.isVisitor) continue;
        const host = cm.find((h) => h.home === v.cube && h !== v);
        if (host && host.cube !== host.home) stats.violations++;
      }
    },
    result() {
      return {
        ...stats,
        stranded: cm.filter((c) => c.cube !== c.home).map((c) => `${c.name}@${c.cube.id}`),
        routes: {
          outer0to2: shelf.pathTo(cubes[0], cubes[2])?.length ?? null,
          adjacent0to1: shelf.pathTo(cubes[0], cubes[1])?.length ?? null,
        },
      };
    },
  };
}
