/**
 * HELIOS Native OSS Assimilation — NATIVE15 foreign runtime retirement taxonomies.
 * Historical upstream references are legal metadata only; not runtime pins.
 */

export const HELIOS_NATIVE_ASSIMILATION_SCHEMA = 'sunrey.helios.native-assimilation.v1' as const;

export const HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED =
  'HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_QUALIFIED' as const;

export const HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED =
  'HELIOS_FOREIGN_RUNTIME_INDEPENDENCE_BLOCKED' as const;

export const NATIVE_ASSIMILATION_WORK_PACKAGE_IDS = Object.freeze([
  'NATIVE01',
  'NATIVE02',
  'NATIVE03',
  'NATIVE04',
  'NATIVE05',
  'NATIVE06',
  'NATIVE07',
  'NATIVE08',
  'NATIVE09',
  'NATIVE10',
  'NATIVE11',
  'NATIVE12',
  'NATIVE13',
  'NATIVE14',
  'NATIVE15',
] as const);

export type NativeAssimilationWorkPackageId = (typeof NATIVE_ASSIMILATION_WORK_PACKAGE_IDS)[number];

export type NativeParityQualificationStatus = 'QUALIFIED' | 'BLOCKED' | 'NOT_APPLICABLE';

export type UpstreamAssimilationProjectId =
  | 'bytex'
  | 'openchart'
  | 'tradingagents'
  | 'seris'
  | 'polymarket-prediction-bot';

export const FORBIDDEN_FOREIGN_RUNTIME_LABELS = Object.freeze([
  '.NET BYTEX runtime',
  'Python TradingAgents runtime',
  'Python Polymarket runtime',
  'Seris application runtime',
  'OpenChart application runtime',
] as const);
