import { env } from "@/lib/env";

export type VerifiedLineIdentity = {
  lineUid: string;
  name?: string;
  picture?: string;
};

export const verifyLineIdentity = async ({
  idToken,
  accessToken,
}: {
  idToken?: string;
  accessToken?: string;
}): Promise<VerifiedLineIdentity> => {
  if (idToken) {
    const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: env.lineClientId(),
      }),
      cache: "no-store",
    });

    if (!verifyRes.ok) {
      throw new Error("Failed to verify LINE id token");
    }

    const data = (await verifyRes.json()) as {
      sub?: string;
      name?: string;
      picture?: string;
    };

    if (!data.sub) {
      throw new Error("LINE id token verification did not return sub");
    }

    return {
      lineUid: data.sub,
      name: data.name,
      picture: data.picture,
    };
  }

  if (accessToken) {
    const profileRes = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!profileRes.ok) {
      throw new Error("Failed to fetch LINE profile");
    }

    const data = (await profileRes.json()) as {
      userId?: string;
      displayName?: string;
      pictureUrl?: string;
    };

    if (!data.userId) {
      throw new Error("LINE profile response did not return userId");
    }

    return {
      lineUid: data.userId,
      name: data.displayName,
      picture: data.pictureUrl,
    };
  }

  throw new Error("Either idToken or accessToken is required");
};
