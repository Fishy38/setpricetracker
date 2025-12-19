import fetch from "node-fetch";

export async function getAccessToken() {
  const {
    RAKUTEN_CLIENT_ID,
    RAKUTEN_CLIENT_SECRET,
    RAKUTEN_REFRESH_TOKEN,
    RAKUTEN_SID,
  } = process.env;

  const body = new URLSearchParams({
    refresh_token: RAKUTEN_REFRESH_TOKEN,
    scope: RAKUTEN_SID,
  });

  const auth = Buffer.from(`${RAKUTEN_CLIENT_ID}:${RAKUTEN_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://api.linksynergy.com/token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Failed to get token: ${res.statusText}`);
  }

  const json = await res.json();
  return json.access_token;
}