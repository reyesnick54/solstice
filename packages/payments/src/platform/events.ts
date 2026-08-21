/**
 * Consumer-facing payment event names mapped onto canonical PascalCase
 * domain events. Domain remains the authority.
 */

export const CONSUMER_PAYMENT_EVENTS = [
  'payment.created',
  'payment.authorized',
  'payment.submitted',
  'payment.settled',
  'payment.failed',
  'payment.returned',
  'payment.reversed',
] as const;
export type ConsumerPaymentEvent = (typeof CONSUMER_PAYMENT_EVENTS)[number];

export const CONSUMER_TO_DOMAIN_PAYMENT_EVENT: Readonly<Record<ConsumerPaymentEvent, string>> = {
  'payment.created': 'PaymentInitiated',
  'payment.authorized': 'PaymentInitiated',
  'payment.submitted': 'PaymentSubmitted',
  'payment.settled': 'PaymentSettled',
  'payment.failed': 'PaymentFailed',
  'payment.returned': 'PaymentReturned',
  'payment.reversed': 'ReversalPosted',
};

export function consumerEventForDomain(eventType: string): ConsumerPaymentEvent | null {
  switch (eventType) {
    case 'PaymentInitiated':
      return 'payment.created';
    case 'PaymentSubmitted':
      return 'payment.submitted';
    case 'PaymentSettled':
      return 'payment.settled';
    case 'PaymentFailed':
      return 'payment.failed';
    case 'PaymentReturned':
      return 'payment.returned';
    case 'ReversalPosted':
      return 'payment.reversed';
    default:
      return null;
  }
}
