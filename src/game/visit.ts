import * as shared from '../content/professions/shared';
import type { Cubeman } from './cubeman';
import { STAMINA } from './stamina';

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
  readonly host: Cubeman;
  readonly visitor: Cubeman;

  private socialAt: number;
  private visitUntil: number;
  private ended = false;

  constructor(host: Cubeman, visitor: Cubeman, now: number) {
    this.host = host;
    this.visitor = visitor;

    // Enter the together state: host pins both to ITS living room and both
    // lean on this session instead of their own solo autonomy.
    host.cube.currentSceneId = host.cube.hub().id;
    host.setInVisit(false);
    visitor.setInVisit(true);

    this.socialAt = now + randRange(SOCIAL_MIN_MS, SOCIAL_MAX_MS);
    this.visitUntil = now + randRange(VISIT_MIN_MS, VISIT_MAX_MS);
  }

  get isEnded(): boolean {
    return this.ended;
  }

  /** Advance the visit: fire social beats and judge end conditions. */
  tick(now: number): void {
    if (this.ended) return;

    // dispatch a shared social beat when both are free to play
    if (now >= this.socialAt) {
      this.socialAt = now + randRange(SOCIAL_MIN_MS, SOCIAL_MAX_MS);
      if (!this.host.isBusy && !this.visitor.isBusy) {
        const anim = SOCIAL_ANIMS[Math.floor(Math.random() * SOCIAL_ANIMS.length)]!;
        this.host.playSocial(anim);
        this.visitor.playSocial(anim);
      }
    }

    // end the visit: the allotted time is up, OR the visitor must go home to
    // sleep (tired at the host's house → goes home to its own bed)
    const visitorTired = this.visitor.energy < STAMINA.SLEEP_AT;
    if (now >= this.visitUntil || (visitorTired && !this.visitor.isBusy)) this.end(visitorTired);
  }

  /**
   * Tear the visit down: unseal, leave the together state, and send the
   * visitor home — sleeping if tired, otherwise just returning normally.
   */
  end(tired = false): void {
    if (this.ended) return;
    this.ended = true;
    this.host.clearInVisit();
    this.visitor.clearInVisit();
    if (tired) this.visitor.returnHomeToSleep();
    else this.visitor.beginReturnHome();
  }
}