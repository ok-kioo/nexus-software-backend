import type { UserRepository } from "../domain/user.repository";
import { DEFAULT_ONBOARDING, OnboardingStateSchema, type OnboardingState } from "../dto/onboarding.dto";

export async function getOnboardingCase(repo: UserRepository, userId: string): Promise<OnboardingState> {
  const raw = await repo.getOnboarding(userId);
  if (!raw || typeof raw !== "object") return DEFAULT_ONBOARDING;
  const parsed = OnboardingStateSchema.safeParse({ ...DEFAULT_ONBOARDING, ...raw });
  return parsed.success ? parsed.data : DEFAULT_ONBOARDING;
}