import { FIRST_CLEAN_PENCE, PHONE_DISPLAY, formatPence } from '@/lib/business';

/**
 * Starting points for a reply to an enquiry. Sam edits the text before sending; nothing goes out
 * unseen. `{name}` becomes the customer's first name. No insurance or cover claims (CLAUDE.md).
 * Later these become editable in the admin (see the template emails idea in NEXT_STEPS).
 */
export interface ReplyTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

const SIGN_OFF = `Kind regards,\nSam\nCompton Cleaning Services\n${PHONE_DISPLAY}`;

export const REPLY_TEMPLATES: readonly ReplyTemplate[] = [
  {
    id: 'thanks',
    label: 'Thanks for getting in touch',
    subject: 'Your enquiry to Compton Cleaning Services',
    body: `Hi {name},\n\nThanks for getting in touch with Compton Cleaning Services. I'll be in touch shortly to talk through what you need.\n\n${SIGN_OFF}`,
  },
  {
    id: 'quote',
    label: 'Price and next steps',
    subject: 'Your quote from Compton Cleaning Services',
    body: `Hi {name},\n\nThanks for your enquiry. A first clean for a typical terraced or semi-detached home is around ${formatPence(FIRST_CLEAN_PENCE)}; the exact price depends on the size of the house, where you are and how soon you need us. Regular cleans are cheaper.\n\nIf that sounds good, let me know a day that suits you and I'll get you booked in.\n\n${SIGN_OFF}`,
  },
  {
    id: 'more-info',
    label: 'Need a bit more information',
    subject: 'A quick question about your enquiry',
    body: `Hi {name},\n\nThanks for your enquiry. To give you an accurate price, could you tell me roughly how many windows there are, and whether I can reach them all from the outside (side gates, conservatory, anything I should know about)?\n\n${SIGN_OFF}`,
  },
  {
    id: 'booked',
    label: 'You are booked in',
    subject: 'You are booked in with Compton Cleaning Services',
    body: `Hi {name},\n\nGood news, you are booked in. I'll let you know the day before I'm on my way. If anything changes, just reply to this email or call or text me.\n\n${SIGN_OFF}`,
  },
];

/** "Jo Bloggs" -> "Jo". Falls back to "there" so a template never says "Hi ,". */
export function firstName(full: string): string {
  const first = full.trim().split(/\s+/)[0] ?? '';
  return first || 'there';
}

export function fillTemplate(text: string, customerName: string): string {
  return text.replaceAll('{name}', firstName(customerName));
}

export function findTemplate(id: string): ReplyTemplate | undefined {
  return REPLY_TEMPLATES.find((t) => t.id === id);
}
