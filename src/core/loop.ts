/** Fixed-timestep game loop: deterministic sim ticks + per-frame render. */
export class Loop {
  private raf = 0;
  private last = 0;
  private acc = 0;

  constructor(
    private readonly fps: number,
    private readonly update: (stepMs: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      // Visibility policy: rAF is suspended while the tab is hidden, so the
      // first frame back sees a huge delta. We DISCARD background time rather
      // than catching up — the cubeman's timers (main.ts) are wall-clock
      // based and kept running anyway, so the world jumps forward cleanly
      // instead of replaying minutes of simulation at 8 ticks per frame.
      this.acc += Math.min(now - this.last, MAX_FRAME_MS);
      this.last = now;
      const step = 1000 / this.fps;
      let n = 0;
      while (this.acc >= step && n < 8) {
        this.update(step);
        this.acc -= step;
        n++;
      }
      // Belt & suspenders: if a backlog somehow survives the cap, drop it.
      if (this.acc >= step) this.acc = 0;
      this.render();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}

/** Max simulated time accepted per frame (~3 ticks at 30fps). */
const MAX_FRAME_MS = 100;
