/**
 * Headless smoke test for the cubicmen debug directive Cubeman.goToRoom() /
 * console `cubemanDebug.goToRoom(name, room)`. Loads the game modules through
 * Vite (like social-sim.mjs) with stubbed browser globals and a fake 30fps
 * clock, then verifies: bad-room rejection, arrival by id from the living room,
 * arrival by scene NAME, and returning-home-then-go from a mid-visit cube.
 *
 * Usage: node scripts/goto-room-sim.mjs
 */
import { createServer } from 'vite';

const noop = () => {};
const ctxStub = new Proxy({}, { get: () => noop });
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: () => ctxStub, style: {} }),
};
let clock = 0;
performance.now = () => clock;

const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
});

const load = (path) => server.ssrLoadModule(path);
try {
  const { Cubeman } = await load('/src/game/cubeman');
  const { Shelf } = await load('/src/game/shelf');
  const { Cube } = await load('/src/game/cube');
  const { professions } = await load('/src/content/professions');

  const cubemen = [];
  const shelf = new Shelf([null, null, null, null], cubemen, 2);
  const home = new Cube('home', professions.stickman);
  const friend = new Cube('friend', professions.dancer);
  const sticko = new Cubeman({
    name: 'Sticko', profession: home.prof, home, shelf,
    onVisitArrived: () => {},
  });
  cubemen.push(sticko);
  shelf.slots[0] = home;
  shelf.slots[1] = friend; // adjacent, so a "visit" can walk home in one hop

  const cubes = [home, friend];
  const tickUntil = (pred, max = 4000) => {
    for (let i = 0; i < max && !pred(); i++) {
      clock += 1000 / 30;
      for (const c of cubemen) c.tick();
      for (const cube of cubes) cube.tick();
    }
    return pred();
  };

  const results = [];
  const check = (label, ok) => {
    results.push({ label, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  };

  // 1. unknown room is rejected with a helpful message
  check('unknown room rejected', sticko.goToRoom('garage').includes('no room'));

  // 2. from the living room, go to the bathroom by id
  sticko.setPosition(10);
  sticko.resetMovement();
  check('directive accepted (bathroom)', sticko.goToRoom('bathroom').includes('Sent'));
  check('arrives in bathroom', tickUntil(() => home.currentSceneId === 'bathroom'));

  // 3. back to the hub by scene NAME (case-insensitive)
  check('arrives in living room (by name)',
    sticko.goToRoom('Living Room').includes('Sent') &&
    tickUntil(() => home.currentSceneId === 'living'));

  // 4. from a mid-visit cube elsewhere, return home THEN walk to the bedroom
  sticko.cube = friend;
  friend.currentSceneId = friend.hub().id;
  check('directive accepted from visit (bedroom)',
    sticko.goToRoom('bedroom').includes('Sent'));
  check('returns home and arrives in bedroom',
    tickUntil(() => home.currentSceneId === 'bedroom' && sticko.cube === home));

  // 5. the directive settles the cubeman back to idle, not busy
  check('settles to idle after arriving',
    tickUntil(() => !sticko.isBusy) && sticko.cube === home);

  // 6. longer bath + stamina-regen data (bath/shower restore energy)
  const bathAction = sticko.prof.actions.find((a) => a.id === 'bath');
  const showerAction = sticko.prof.actions.find((a) => a.id === 'shower');
  check('longer bath (soak >= 80 frames)', (bathAction?.anim.dur ?? 0) >= 80);
  check('shower restores stamina', typeof showerAction?.regen === 'number' && showerAction.regen > 0);
  check('bath restores stamina', typeof bathAction?.regen === 'number' && bathAction.regen > 0);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`goto-room-sim FAILED (${failed.length})`);
    process.exitCode = 1;
  } else {
    console.log(`goto-room-sim PASSED (${results.length})`);
  }
} finally {
  await server.close();
}