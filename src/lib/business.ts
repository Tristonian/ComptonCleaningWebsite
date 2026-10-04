/** Business facts that are not wording. Wording lives in `<Ed>` nodes; these are values code uses. */

export const PHONE_DISPLAY = '07756 355758';
export const PHONE_TEL = 'tel:+447756355758';
export const PHONE_SMS = 'sms:+447756355758';

/** Sam's Google Business Profile "leave a review" link (public). */
export const REVIEW_URL = 'https://g.page/r/CTjrcltzLlOVEBM/review';

/** Sam's public address: customers write to it and he replies as it (Gmail "send as"). */
export const EMAIL_FROM = 'hello@comptoncleaning.co.uk';

/**
 * Sender for website notifications. Deliberately NOT hello@: Sam's Gmail treats mail from his own
 * send-as address, to himself, as if he had sent it, and it can fail to reach his inbox.
 */
export const NOTIFY_FROM = 'enquiry@comptoncleaning.co.uk';

/** Money is integer pence everywhere; formatted to £ only for display. */
export const FIRST_CLEAN_PENCE = 3000;

export function formatPence(pence: number): string {
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}
