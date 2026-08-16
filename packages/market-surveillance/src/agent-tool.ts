import { isVerifiedActorContext, type VerifiedActorContext } from '../../identity/src/index.ts';

export class SubjectScopedSurveillanceTool {
  explain(actor: VerifiedActorContext): { readonly canExecute: false; readonly reason: string } {
    if (!isVerifiedActorContext(actor)) {
      return { canExecute: false, reason: 'unverified actor' };
    }
    return { canExecute: false, reason: 'AGENT_CANNOT_EXECUTE' };
  }
}
