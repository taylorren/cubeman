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
      this.acc += now - this.last;
      this.last = now;
      const step = 1000 / this.fps;
      let n = 0;
      while (this.acc >= step && n < 8) {
        this.update(step);
        this.acc -= step;
        n++;
      }
      this.render();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
