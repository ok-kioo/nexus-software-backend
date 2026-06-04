import type { UserRepository } from "../domain/user.repository";
import {
  DEFAULT_ONBOARDING,
  OnboardingStateSchema,
  type OnboardingState,
  type UpdateOnboardingDTO,
} from "../dto/onboarding.dto";
import { getOnboardingCase } from "./get-onboarding.case";

export async function updateOnboardingCase(
  repo: UserRepository,
  userId: string,
  patch: UpdateOnboardingDTO,
): Promise<OnboardingState> {
  if (patch.reset) {
    await repo.updateOnboarding(userId, DEFAULT_ONBOARDING);
    return DEFAULT_ONBOARDING;
  }
  const current = await getOnboardingCase(repo, userId);
  const merged: OnboardingState = {
    ...current,
    ...(patch.completed_steps !== undefined ? { completed_steps: Array.from(new Set(patch.completed_steps)) } : {}),
    ...(patch.dismissed !== undefined ? { dismissed: patch.dismissed } : {}),
    ...(patch.dismissed_modal !== undefined ? { dismissed_modal: patch.dismissed_modal } : {}),
    ...(patch.completed_at !== undefined ? { completed_at: patch.completed_at } : {}),
    ...(patch.version !== undefined ? { version: patch.version } : {}),
  };
  const parsed = OnboardingStateSchema.parse(merged);
  await repo.updateOnboarding(userId, parsed);
  return parsed;
}