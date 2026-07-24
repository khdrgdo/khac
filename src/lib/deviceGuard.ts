// Device Guard is disabled as per product decision

export function getOrCreateDeviceId(): string {
  return "dev_disabled";
}

export function checkDeviceAccountConflict(
  currentUserId?: string,
  currentEmail?: string,
): { isBlocked: boolean; boundEmail?: string } {
  return { isBlocked: false };
}

export function isSignupAllowedOnDevice(): { allowed: boolean; existingEmail?: string } {
  return { allowed: true };
}

export function bindAccountToDevice(userId: string, email?: string) {
  // no-op
}

export function clearDeviceBinding() {
  // no-op
}
