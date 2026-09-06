import type { Overlay } from '../content/professions';
import type { Skeleton } from './skeleton';

/**
 * Renders a skeleton to a coarse 48×48 pixel grid with a hard on/off
 * threshold, mimicking the segment-style LCD of the original toy.
 */
export class LCD {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private off: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;

  private readonly on = '#1a241c';
  private readonly offColor = '#a9bda4';
  /** Supersampling factor for smooth pixel coverage. */
  private readonly ss = 4;
  /** Cubeman body scale relative to the 48×48 authoring space. */
  static readonly BODY_SCALE = 0.72;
  /** Rendered half-thickness of limbs in *screen* pixels (author-space
   *  stroke width 2.6 is divided by body scale, so it stays constant on
   *  screen — game logic uses this for on-screen bounds). */
  static readonly LIMB_RADIUS = 2.6 / 2;
  /** Head radius in author-space units (scaled by BODY_SCALE on screen). */
  static readonly HEAD_RADIUS = 3.1;
  private readonly bodyScale = LCD.BODY_SCALE;
  /** Screen row the ground sits on (floor = bottom rim of the screen). */
  static readonly GROUND_Y = 46;
  /** Authoring-space Y where a standing pose's feet are. */
  static readonly AUTHOR_FEET_Y = 40;

  constructor(
    screen: HTMLCanvasElement,
    public readonly px = 48,
    public readonly scale = 7,
  ) {
    this.canvas = screen;
    this.canvas.width = px * scale;
    this.canvas.height = px * scale;
    this.ctx = screen.getContext('2d')!;

    this.off = document.createElement('canvas');
    this.off.width = px * this.ss;
    this.off.height = px * this.ss;
    this.octx = this.off.getContext('2d', { willReadFrequently: true })!;
  }

  /**
   * Draw a single skeleton. Optional overlays are called with a context
   * already transformed into 48×48 LCD space, before thresholding:
   * `behind` (ambience) draws first, then the skeleton, then `front`
   * (effects like "Z z z").
   */
  draw(
    s: Skeleton,
    frame: number,
    opts: { behind?: Overlay; front?: Overlay } = {},
  ): void {
    this.drawBatch(frame, {
      behind: opts.behind,
      sprites: [{ skeleton: s, front: opts.front }],
    });
  }

  /**
   * Compose SEVERAL skeletons over ONE shared backdrop — the shared-room
   * case, where a resident and a visitor both stand in the same 48×48
   * display. Each sprite may carry its own front overlay.
   */
  drawBatch(
    frame: number,
    opts: { behind?: Overlay; sprites: Array<{ skeleton: Skeleton; front?: Overlay }> },
  ): void {
    const { octx, px, ss } = this;
    const size = px * ss;

    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, size, size);
    octx.setTransform(ss, 0, 0, ss, 0, 0);
    octx.strokeStyle = '#000';
    octx.fillStyle = '#000';
    octx.lineWidth = 2.6;
    octx.lineJoin = 'round';
    octx.lineCap = 'round';

    const line = (a: [number, number], b: [number, number]) => {
      octx.beginPath();
      octx.moveTo(a[0], a[1]);
      octx.lineTo(b[0], b[1]);
      octx.stroke();
    };
    const skeleton = (s: Skeleton) => {
      // torso
      line(s.neck, s.hip);
      // legs
      line(s.hip, s.kL); line(s.kL, s.fL);
      line(s.hip, s.kR); line(s.kR, s.fR);
      // arms
      line(s.neck, s.eL); line(s.eL, s.hL);
      line(s.neck, s.eR); line(s.eR, s.hR);
      // head
      octx.beginPath();
      octx.arc(s.head[0], s.head[1], 3.1, 0, Math.PI * 2);
      octx.fill();
    };

    if (opts.behind) opts.behind(octx, frame);

    // Body scale: the cubeman is drawn smaller than the authoring space
    // (like the original toy, ~half the screen height), pivoted at the
    // ground so feet stay planted on the ambience floor. Every sprite is
    // drawn in this same transform so they overlap on one screen.
    const bs = this.bodyScale;
    octx.setTransform(
      ss * bs, 0, 0, ss * bs,
      ss * 24 * (1 - bs), // x pivot: 24 (center)
      ss * (LCD.GROUND_Y - LCD.AUTHOR_FEET_Y * bs), // author feet land on ground
    );
    octx.lineWidth = 2.6 / bs; // keep limb thickness in screen units
    for (const sprite of opts.sprites) skeleton(sprite.skeleton);

    // front overlays live in full LCD space (post body-scale reset)
    octx.setTransform(ss, 0, 0, ss, 0, 0);
    for (const sprite of opts.sprites) if (sprite.front) sprite.front(octx, frame);

    // downsample ss×ss blocks (area average), then threshold to LCD segments.
    // Averaging instead of point-sampling gives smooth pixel coverage:
    // limbs fade in/out over a frame or two instead of popping.
    const img = octx.getImageData(0, 0, size, size).data;
    const { ctx, scale } = this;
    ctx.fillStyle = this.offColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = this.on;

    const block = ss * ss;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        let sum = 0;
        for (let dy = 0; dy < ss; dy++) {
          const row = ((y * ss + dy) * size + x * ss) * 4;
          for (let dx = 0; dx < ss; dx++) sum += img[row + dx * 4];
        }
        // white = 255; on if the block is dark enough (~25% coverage)
        if (sum / block < 190) {
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }
}
