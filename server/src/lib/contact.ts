export const CONTACT_TOPICS = [
  { value: 'order', label: 'Order or delivery' },
  { value: 'returns', label: 'Returns and refunds' },
  { value: 'product', label: 'Product question' },
  { value: 'account', label: 'Account help' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Something else' },
] as const;

export const CONTACT_MESSAGE_MIN = 10;
export const CONTACT_MESSAGE_MAX = 1000;

export interface ContactInput {
  topic: string;
  message: string;
}

export type ContactResult = { ok: true; input: ContactInput } | { ok: false; fieldErrors: Record<string, string> };

export function validateContact(raw: unknown): ContactResult {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const fieldErrors: Record<string, string> = {};

  const topic = typeof body.topic === 'string' ? body.topic : '';
  if (topic === '') fieldErrors.topic = 'Choose a topic.';
  else if (!CONTACT_TOPICS.some((t) => t.value === topic)) fieldErrors.topic = 'Choose one of the listed topics.';

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message === '') fieldErrors.message = 'Message is required.';
  else if (message.length < CONTACT_MESSAGE_MIN) fieldErrors.message = `Message must be at least ${CONTACT_MESSAGE_MIN} characters.`;
  else if (message.length > CONTACT_MESSAGE_MAX) fieldErrors.message = `Message must be at most ${CONTACT_MESSAGE_MAX} characters.`;

  if (body.consent !== true) fieldErrors.consent = 'You must agree to us storing your message so we can reply.';

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, input: { topic, message } };
}
