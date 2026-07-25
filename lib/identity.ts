export type RequestIdentity = {
  email: string;
  displayName: string;
  tag: string;
  isPrivateFallback: boolean;
};

export function getRequestIdentity(request: Request): RequestIdentity {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  const authenticatedEmail = request.headers.get("oai-authenticated-user-email");
  const email = authenticatedEmail?.trim().toLocaleLowerCase("en-US") || "owner@private.kuzens";
  let displayName = authenticatedEmail?.split("@")[0] || "Savaş";

  if (encodedName && encoding === "percent-encoded-utf-8") {
    try {
      displayName = decodeURIComponent(encodedName);
    } catch {
      // The authenticated email-derived name remains a safe fallback.
    }
  }

  return {
    email,
    displayName,
    tag: `@${email.split("@")[0]}`,
    isPrivateFallback: !authenticatedEmail,
  };
}
