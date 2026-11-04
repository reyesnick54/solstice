import type { SpeakerRole } from './types.ts';

const CEO_PATTERNS = [
  /\bchief executive\b/i,
  /\bceo\b/i,
  /\bpresident and chief executive\b/i,
];
const CFO_PATTERNS = [/\bchief financial\b/i, /\bcfo\b/i];
const COO_PATTERNS = [/\bchief operating\b/i, /\bcoo\b/i];
const EXEC_PATTERNS = [
  /\bchief\b/i,
  /\bexecutive vice president\b/i,
  /\bevp\b/i,
  /\bsvp\b/i,
  /\bvice president\b/i,
  /\bvp\b/i,
  /\bdirector\b/i,
  /\bcontroller\b/i,
];
const ANALYST_PATTERNS = [
  /\banalyst\b/i,
  /\bresearch\b/i,
  /\bgoldman\b/i,
  /\bmorgan stanley\b/i,
  /\bjpmorgan\b/i,
  /\bbarclays\b/i,
  /\bubs\b/i,
  /\bciti\b/i,
  /\bbank of america\b/i,
];

export function inferSpeakerRole(speakerLabel: string, segmentKind: string): SpeakerRole {
  const label = speakerLabel.trim();
  if (segmentKind === 'ANALYST_QUESTION') {
    return 'ANALYST';
  }
  if (segmentKind === 'OPERATOR') {
    return 'UNKNOWN';
  }
  if (CEO_PATTERNS.some((re) => re.test(label))) {
    return 'CEO';
  }
  if (CFO_PATTERNS.some((re) => re.test(label))) {
    return 'CFO';
  }
  if (COO_PATTERNS.some((re) => re.test(label))) {
    return 'COO';
  }
  if (ANALYST_PATTERNS.some((re) => re.test(label))) {
    return 'ANALYST';
  }
  if (EXEC_PATTERNS.some((re) => re.test(label))) {
    return 'OTHER_EXECUTIVE';
  }
  return 'UNKNOWN';
}
