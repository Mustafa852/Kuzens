export function avatarUrlFor(profileId: string, avatarKey?: string | null) {
  if (!avatarKey) return null;
  const version = avatarKey.split("/").pop() || "avatar";
  return `/api/avatar?profile=${encodeURIComponent(profileId)}&v=${encodeURIComponent(version)}`;
}

export function publicProfile<T extends { id: string; avatarKey?: string | null }>(
  profile: T,
) {
  const { avatarKey, ...safeProfile } = profile;
  return {
    ...safeProfile,
    avatarUrl: avatarUrlFor(profile.id, avatarKey),
  };
}
