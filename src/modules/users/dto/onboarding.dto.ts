import { z } from "zod";

export const OnboardingStateSchema = z.object({
  completed_steps: z.array(z.string().min(1).max(64)).max(50).default([]),
  dismissed: z.boolean().default(false),
  dismissed_modal: z.boolean().default(false),
  completed_at: z.string().datetime().nullable().default(null),
  version: z.number().int().nonnegative().default(1),
});
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

export const UpdateOnboardingSchema = z
  .object({
    completed_steps: z.array(z.string().min(1).max(64)).max(50).optional(),
    dismissed: z.boolean().optional(),
    dismissed_modal: z.boolean().optional(),
    completed_at: z.string().datetime().nullable().optional(),
    version: z.number().int().nonnegative().optional(),
    /** When true, completely resets the onboarding state. */
    reset: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nenhuma alteração informada",
  });
export type UpdateOnboardingDTO = z.infer<typeof UpdateOnboardingSchema>;

export const DEFAULT_ONBOARDING: OnboardingState = {
  completed_steps: [],
  dismissed: false,
  dismissed_modal: false,
  completed_at: null,
  version: 2,
};