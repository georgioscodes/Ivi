import { z } from 'zod';

import type { FoodCreateRequest } from '@/api/types';

/**
 * Mirrors the bean validation on `FoodCreateRequest` and `FoodPortionRequest`, in Greek.
 *
 * Keep the limits in step with the Java records: name 200, portion label 80, portion weight above
 * zero, every nutrient non-negative, category one of the five.
 */
const portionSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Η ονομασία μερίδας είναι υποχρεωτική')
    .max(80, 'Η ονομασία δεν μπορεί να ξεπερνά τους 80 χαρακτήρες'),
  grams: z
    .number({ message: 'Απαιτείται βάρος' })
    .gt(0, 'Το βάρος πρέπει να είναι μεγαλύτερο από μηδέν'),
  isDefault: z.boolean(),
});

const nonNegative = (label: string) =>
  z.number({ message: `Απαιτείται τιμή για ${label}` }).min(0, `${label}: δεν μπορεί να είναι αρνητικό`);

export const foodSchema = z.object({
  nameEl: z
    .string()
    .trim()
    .min(1, 'Η ελληνική ονομασία είναι υποχρεωτική')
    .max(200, 'Η ονομασία δεν μπορεί να ξεπερνά τους 200 χαρακτήρες'),
  nameEn: z.string().max(200, 'Η ονομασία δεν μπορεί να ξεπερνά τους 200 χαρακτήρες').optional(),
  category: z.enum(['FRESH', 'CARBOHYDRATE', 'PROTEIN', 'FAT', 'COMPOSITE'], {
    message: 'Επιλέξτε κατηγορία',
  }),
  energyKcal: nonNegative('Ενέργεια'),
  proteinG: nonNegative('Πρωτεΐνη'),
  carbohydrateG: nonNegative('Υδατάνθρακες'),
  fatG: nonNegative('Λίπος'),
  portions: z
    .array(portionSchema)
    // Not a server rule, but a data-quality one the server has no way to state: two portions
    // both marked default leave the plan builder picking arbitrarily between them.
    .refine(
      (portions) => portions.filter((portion) => portion.isDefault).length <= 1,
      'Μόνο μία μερίδα μπορεί να είναι προεπιλεγμένη',
    ),
});

export type FoodForm = z.infer<typeof foodSchema>;

export function toRequest(form: FoodForm): FoodCreateRequest {
  return {
    nameEl: form.nameEl.trim(),
    nameEn: form.nameEn?.trim() || undefined,
    category: form.category,
    energyKcal: form.energyKcal,
    proteinG: form.proteinG,
    carbohydrateG: form.carbohydrateG,
    fatG: form.fatG,
    // Omitted rather than sent empty: on an override, an empty list would be taken as "no
    // portions", and the server copies the catalogue food's portions only when none are supplied.
    portions: form.portions.length > 0 ? form.portions : undefined,
  };
}
