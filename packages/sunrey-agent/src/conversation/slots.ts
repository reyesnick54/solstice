import type { ConversationIntent } from './taxonomy.ts';
import type { SlotName, SlotQuestion, SlotValue } from './types.ts';

const REQUIRED_SLOTS: Readonly<Record<ConversationIntent, readonly SlotName[]>> = {
  INFORMATION_REQUEST: [],
  FINANCIAL_ANALYSIS: [],
  PAYMENT_REQUEST: ['recipient', 'amount', 'currency', 'sourceAccount'],
  FX_REQUEST: ['amount', 'sourceCurrency', 'destinationCurrency', 'sourceAccount'],
  GROWTH_REQUEST: [],
  INVESTMENT_REQUEST: ['amount', 'currency', 'sourceAccount'],
  EXCHANGE_REQUEST: ['amount', 'currency', 'asset', 'sourceAccount'],
  WITHDRAWAL_REQUEST: ['amount', 'currency', 'destination', 'sourceAccount'],
  CARD_MANAGEMENT: ['card'],
  GOAL_MANAGEMENT: ['goal'],
  DATA_PERMISSION_REQUEST: [],
  SUPPORT_REQUEST: [],
  PROPOSAL_MODIFICATION: ['amount'],
};

const QUESTIONS: Readonly<Record<SlotName, string>> = {
  recipient: 'Which recipient should receive this payment?',
  amount: 'What amount should I use? I will not guess a financial amount.',
  currency: 'Which currency should I use?',
  sourceAccount: 'Which source account should fund this?',
  destinationAccount: 'Which destination account should receive this?',
  destinationCurrency: 'Which currency should I convert into?',
  sourceCurrency: 'Which currency should I convert from?',
  asset: 'Which asset should this action use?',
  destination: 'Which destination should I use?',
  goal: 'Which goal should this refer to?',
  card: 'Which card should I manage?',
};

const CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  sar: 'SAR',
  riyal: 'SAR',
  riyals: 'SAR',
  usd: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  '$': 'USD',
};

export function requiredSlotsFor(intent: ConversationIntent): readonly SlotName[] {
  return REQUIRED_SLOTS[intent];
}

export function missingSlotQuestions(
  intent: ConversationIntent,
  slots: Readonly<Record<string, SlotValue>>,
): readonly SlotQuestion[] {
  return requiredSlotsFor(intent)
    .filter((slot) => !slots[slot])
    .map((slot) => Object.freeze({ slot, prompt: QUESTIONS[slot], reason: 'REQUIRED' as const }));
}

export function extractSlotsFromText(text: string): Readonly<Record<string, SlotValue>> {
  const slots: Record<string, SlotValue> = {};
  const amount = extractAmount(text);
  if (amount) {
    slots.amount = slot('amount', amount.raw, null, amount.raw);
  }
  const currency = extractCurrency(text);
  if (currency) {
    slots.currency = slot('currency', currency, null, currency);
    if (!slots.sourceCurrency) {
      slots.sourceCurrency = slot('sourceCurrency', currency, null, currency);
    }
  }
  const destinationCurrency = extractDestinationCurrency(text);
  if (destinationCurrency) {
    slots.destinationCurrency = slot('destinationCurrency', destinationCurrency, null, destinationCurrency);
  }
  const asset = extractAsset(text);
  if (asset) {
    slots.asset = slot('asset', asset, null, asset);
  }
  const recipient = extractRecipient(text);
  if (recipient) {
    slots.recipient = slot('recipient', recipient, null, recipient);
  }
  const sourceHint = extractSourceHint(text);
  if (sourceHint) {
    slots.sourceAccount = slot('sourceAccount', sourceHint, null, sourceHint);
  }
  return Object.freeze(slots);
}

export function mergeSlots(
  current: Readonly<Record<string, SlotValue>>,
  incoming: Readonly<Record<string, SlotValue>>,
): Readonly<Record<string, SlotValue>> {
  return Object.freeze({ ...current, ...incoming });
}

export function parseAmountToMinorUnits(raw: string): string | null {
  const cleaned = raw.replace(/[$,]/g, '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const [whole = '0', fraction = ''] = cleaned.split('.');
  const frac = (fraction + '00').slice(0, 2);
  try {
    return (BigInt(whole) * 100n + BigInt(frac)).toString();
  } catch {
    return null;
  }
}

function extractAmount(text: string): { readonly raw: string } | null {
  const match = text.match(/(?:\$|USD\s*)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/);
  if (!match?.[1]) {
    return null;
  }
  return { raw: match[0]!.replace(/[^\d.,]/g, match[1]) };
}

function extractCurrency(text: string): string | null {
  if (/\$|usd|dollar/i.test(text)) {
    return 'USD';
  }
  const match = text.match(/\b(SAR|USD|EUR|GBP|riyals?)\b/i);
  if (!match?.[1]) {
    return null;
  }
  return CURRENCY_ALIASES[match[1].toLowerCase()] ?? match[1].toUpperCase();
}

function extractDestinationCurrency(text: string): string | null {
  const match = text.match(/\bto\s+(riyals?|sar|usd|dollars?)\b/i);
  if (!match?.[1]) {
    return null;
  }
  return CURRENCY_ALIASES[match[1].toLowerCase()] ?? match[1].toUpperCase();
}

function extractAsset(text: string): string | null {
  if (/sunrey coin/i.test(text)) {
    return 'SUNREY_COIN';
  }
  if (/moonrey/i.test(text)) {
    return 'MOONREY_COIN';
  }
  return null;
}

function extractRecipient(text: string): string | null {
  const match = text.match(/\b(?:send|pay|transfer)\s+([A-Za-z]{2,})\b/i);
  if (!match?.[1]) {
    return null;
  }
  const name = match[1];
  if (/^(some|the|my|a|an|to)$/i.test(name)) {
    return null;
  }
  return name[0]!.toUpperCase() + name.slice(1);
}

function extractSourceHint(text: string): string | null {
  if (/my savings/i.test(text)) {
    return 'my savings';
  }
  if (/my usd account/i.test(text)) {
    return 'my USD account';
  }
  if (/my moonrey holdings/i.test(text)) {
    return 'my MoonRey holdings';
  }
  return null;
}

function slot(name: SlotName, raw: string, resolvedId: string | null, displayLabel: string): SlotValue {
  return Object.freeze({
    name,
    raw,
    resolvedId,
    displayLabel,
    uncertainty: 'FACT',
    guessed: false,
  });
}
