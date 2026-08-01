export function avatarUrlFor(profileId: string, avatarKey?: string | null) {
  if (!avatarKey) return null;
  const version = avatarKey.split("/").pop() || "avatar";
  return `/api/avatar?profile=${encodeURIComponent(profileId)}&v=${encodeURIComponent(version)}`;
}

export function bannerUrlFor(profileId: string, bannerKey?: string | null) {
  if (!bannerKey) return null;
  const version = bannerKey.split("/").pop() || "banner";
  return `/api/avatar?profile=${encodeURIComponent(profileId)}&kind=banner&v=${encodeURIComponent(version)}`;
}

export function publicProfile<T extends { id: string; avatarKey?: string | null; bannerKey?: string | null }>(
  profile: T,
) {
  const { avatarKey, bannerKey, ...safeProfile } = profile;
  return {
    ...safeProfile,
    avatarUrl: avatarUrlFor(profile.id, avatarKey),
    bannerUrl: bannerUrlFor(profile.id, bannerKey),
  };
}
