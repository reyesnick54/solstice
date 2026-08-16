import {
  FORBIDDEN_VALIDATOR_CONTROLLERS,
  PERMITTED_VALIDATOR_CONTROLLERS,
  type ValidatorResult,
  validatorErr,
  validatorOk,
} from './types.ts';

export const VALIDATOR_CONTROL_ACTIONS = [
  'CONTROL_VALIDATOR_KEY',
  'CAST_VOTE',
  'SCHEDULE_ACTIVATION',
  'ALTER_VOTING_POWER',
  'ROTATE_VALIDATOR_KEY',
  'JAIL_VALIDATOR',
  'RESTORE_VALIDATOR',
  'CHANGE_VALIDATOR_SET',
] as const;
export type ValidatorControlAction = (typeof VALIDATOR_CONTROL_ACTIONS)[number];

export function assertPermittedValidatorController(
  controllerKind: string,
  action: ValidatorControlAction,
): ValidatorResult<true> {
  if ((FORBIDDEN_VALIDATOR_CONTROLLERS as readonly string[]).includes(controllerKind)) {
    return validatorErr(
      'FORBIDDEN_CONTROLLER',
      `${controllerKind} cannot ${action}; AI may analyze validator health but cannot control, vote, activate, rotate, jail, or alter membership`,
    );
  }
  if (!(PERMITTED_VALIDATOR_CONTROLLERS as readonly string[]).includes(controllerKind)) {
    return validatorErr(
      'FORBIDDEN_CONTROLLER',
      `${controllerKind} is not a permitted validator controller`,
    );
  }
  return validatorOk(true);
}
