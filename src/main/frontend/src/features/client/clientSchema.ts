import { z } from 'zod';

import type { ClientCreateRequest, IsoDate } from '@/api/types';

/**
 * Mirrors the bean validation on {@code ClientCreateRequest}, in Greek.
 *
 * The server's messages are English, so a rule left only there reaches a practitioner in the
 * wrong language. Mirroring is bounded on purpose: shape, length and "is it in the past" — the
 * things a browser can decide alone. Nothing here is a business rule, and nothing here is
 * trusted; the server validates the same fields again and its answer is the one that counts.
 *
 * Keep the limits in step with the Java record. They are duplicated, and duplication drifts.
 */
export const clientSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Το ονοματεπώνυμο είναι υποχρεωτικό')
    .max(160, 'Το ονοματεπώνυμο δεν μπορεί να ξεπερνά τους 160 χαρακτήρες'),

  // Optional throughout: a client seen once for a consultation may have given nothing but a name.
  email: z
    .union([z.literal(''), z.string().email('Μη έγκυρη διεύθυνση email').max(254)])
    .optional(),

  phone: z.string().max(40, 'Το τηλέφωνο δεν μπορεί να ξεπερνά τους 40 χαρακτήρες').optional(),

  dateOfBirth: z
    .union([
      z.literal(''),
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Μη έγκυρη ημερομηνία')
        .refine((value) => new Date(value) < new Date(), 'Η ημερομηνία πρέπει να είναι στο παρελθόν'),
    ])
    .optional(),

  goal: z.string().max(500, 'Ο στόχος δεν μπορεί να ξεπερνά τους 500 χαρακτήρες').optional(),

  // No server-side limit, so none here. A first-consultation note runs long.
  notes: z.string().optional(),
});

export type ClientForm = z.infer<typeof clientSchema>;

/**
 * An untouched optional field is an empty string in the DOM and should reach the server as
 * absent, not as `""`. The difference is visible: an empty string sets the column to empty,
 * where omitting it leaves whatever was there.
 */
export function toRequest(form: ClientForm): ClientCreateRequest {
  const blankToUndefined = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

  return {
    fullName: form.fullName.trim(),
    email: blankToUndefined(form.email),
    phone: blankToUndefined(form.phone),
    dateOfBirth: blankToUndefined(form.dateOfBirth) as IsoDate | undefined,
    goal: blankToUndefined(form.goal),
    notes: blankToUndefined(form.notes),
  };
}
