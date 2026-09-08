/**
 * Headless social invariant simulation runner.
 * Loads the game modules through Vite (no build step) with stubbed browser
 * globals and a fake 30fps clock, then runs the world for a while and
 * reports invariant violations. Exits non-zero when invariants are broken.
 *
 * Usage: node scripts/social-sim.mjs [ticks]
 */
import { createServer } from 'vite';

// --- browser global stubs (must exist before game modules load) -------------
const noop = () => {};
const ctxStub = new Proxy({}, { get: () => noop });
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: () => ctxStub, style: {} }),
};

// --- fake 30fps clock --------------------------------------------------------
let clock = 0;
performance.now = () => clock;

const ticks = Number(process.argv[2] ?? 150000);
const server = await createServer({
  logLevel: 'error',
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true },
});
try {
  const mod = await server.ssrLoadModule('/scripts/sim-entry.ts');
  const world = mod.createWorld();
  for (let t = 0; t < ticks; t++) {
    clock += 1000 / 30;
    world.tick();
  }
  const r = world.result();
  console.log(`social-sim: ${ticks} ticks simulated`);
  console.log(`  visits completed : ${r.visits}`);
  console.log(`  multi-hop visits : ${r.multiHop}`);
  console.log(`  route lengths    : outer0->outer2 = ${r.routes.outer0to2} hops, outer0->middle = ${r.routes.adjacent0to1} hop`);
  console.log(`  invariant breaks : ${r.violations}`);
  console.log(`  stranded at end  : ${r.stranded.length === 0 ? 'none' : r.stranded.join(', ')}`);
  if (r.violations > 0 || r.stranded.length > 0 || r.multiHop === 0) {
    console.error('social-sim FAILED');
    process.exitCode = 1;
  } else {
    console.log('social-sim PASSED');
  }
} finally {
  await server.close();
}
