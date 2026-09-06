import * as shared from '../content/professions/shared';
import type { Cubeman } from './cubeman';
import { STAMINA } from './stamina';
import { gameLog } from '../core/debug';
import type { LogDetails } from '../core/debug';

const VISIT_MIN_MS = 20_000;
const VISIT_MAX_MS = 40_000;
/** How often a social beat fires while together. */
const SOCIAL_MIN_MS = 5_000;
const SOCIAL_MAX_MS = 9_000;

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** The coordinated pair-behaviors a social beat can pick from. */
const SOCIAL_ANIMS = [shared.chat, shared.wave] as const;
/** Fraction of the 48-author-width living room where the host stands. */
const LEFT_SPOT = -8;
/** Fraction of the 48-author-width living room where the visitor stands. */
const RIGHT_SPOT = 8;
/** Odds a social beat is a shared ball play rather than a gesture. */
const BALL_CHANCE = 0.35;

/**
 * The coordinator for a single visit. Created the moment a visit is accepted
 * and torn down when it ends. It is the ONE place that owns "togetherness":
 * it swaps the host room from solo to social, dispatches shared social beats
 * to BOTH participants, seals both to the host's living room, and ends the
 * visit (duration up, or the visitor needs to go home to sleep).
 *
 * Deliberately NOT inside Cubeman: togetherness is shared state between two
 * characters, so no single cubeman should own it — this keeps Cubeman a lean
 * solo-life runtime and lets new social behaviors be new beats here.
 */
export class VisitSession {
  private static nextId = 0;
  readonly id = `visit-${++VisitSession.nextId}`;
  readonly host: Cubeman;
  readonly visitor: Cubeman;

  private socialAt: number;
  private visitUntil: number;
  private ended = false;
  private readonly startedAt: number;

  constructor(host: Cubeman, visitor: Cubeman, now: number) {
    this.host = host;
    this.visitor = visitor;
    this.startedAt = now;

    // Enter the together state: host pins both to ITS living room and both
    // lean on this session instead of their own solo autonomy.
    host.cube.currentSceneId = host.cube.hub().id;
    // Cancel any pending host movement (e.g. a walk to the bedroom) so the
    // host doesn't wander away the moment the visitor arrives.
    host.resetMovement();
    host.setInVisit(false);
    visitor.setInVisit(true);

    // Seat them at separate spots in the living room: host on the left, the
    // visitor on the right, so they read as two distinct characters.
    host.setPosition(LEFT_SPOT);
    visitor.setPosition(RIGHT_SPOT);

    this.socialAt = now + randRange(SOCIAL_MIN_MS, SOCIAL_MAX_MS);
    this.visitUntil = now + randRange(VISIT_MIN_MS, VISIT_MAX_MS);
    this.log('visit.started', { durationMs: Math.round(this.visitUntil - this.startedAt) });
  }

  get isEnded(): boolean {
    return this.ended;
  }

  debugState() {
    return {
      id: this.id,
      host: this.host.debugState(),
      visitor: this.visitor.debugState(),
      startedAtMs: Math.round(this.startedAt),
      endsAtMs: Math.round(this.visitUntil),
      remainingMs: Math.max(0, Math.round(this.visitUntil - performance.now())),
      nextSocialAtMs: Math.round(this.socialAt),
      ended: this.ended,
    };
  }

  private log(event: 'visit.started' | 'visit.closed', details: LogDetails = {}): void {
    if (gameLog.enabled) gameLog.record(event, {
      visitId: this.id,
      host: this.host.name,
      visitor: this.visitor.name,
      home: this.visitor.home.id,
      cube: this.visitor.cube.id,
      room: this.visitor.cube.currentSceneId,
      endsAtMs: Math.round(this.visitUntil),
      ...details,
    });
  }

  /** Advance the visit: fire social beats and judge end conditions. */
  tick(now: number): void {
    if (this.ended) return;

    // dispatch a shared social beat when both are free to play
    if (now >= this.socialAt) {
      this.socialAt = now + randRange(SOCIAL_MIN_MS, SOCIAL_MAX_MS);
      if (!this.host.isBusy && !this.visitor.isBusy) {
        if (Math.random() < BALL_CHANCE) {
          this.playSharedBall();
        } else {
          const anim = SOCIAL_ANIMS[Math.floor(Math.random() * SOCIAL_ANIMS.length)]!;
          this.host.playSocial(anim);
          this.visitor.playSocial(anim);
        }
      }
    }

    // end the visit: the allotted time is up, OR the visitor must go home to
    // sleep (tired at the host's house → goes home to its own bed)
    const visitorTired = this.visitor.energy < STAMINA.SLEEP_AT;
    if (now >= this.visitUntil || (visitorTired && !this.visitor.isBusy))
      this.end(visitorTired, now >= this.visitUntil ? 'timeout' : 'tired');
  }

  /** Coordinated ball play: the visitor kicks toward the host, the host kicks
   *  it back. The ball belongs to the cube, so it rolls between them. */
  private playSharedBall(): void {
    const ball = this.host.cube.ball;
    // visitor (right side) kicks left toward the host; host kicks right back
    ball.v = this.visitor.posX > this.host.posX ? -1.4 : 1.4;
    this.host.playSocial(shared.wave);
    this.visitor.playSocial(shared.wave);
  }

  /**
   * Tear the visit down: unseal, leave the together state, and send the
   * visitor home — sleeping if tired, otherwise just returning normally.
   */
  end(tired = false, reason: 'timeout' | 'tired' | 'manual' = 'manual'): void {
    if (this.ended) return;
    this.ended = true;
    this.host.clearInVisit();
    this.visitor.clearInVisit();
    if (tired) this.visitor.returnHomeToSleep();
    else this.visitor.beginReturnHome();
    this.log('visit.closed', {
      reason,
      returnToSleep: tired,
      returnedHome: this.visitor.cube === this.visitor.home,
      elapsedMs: Math.round(performance.now() - this.startedAt),
    });
  }
}