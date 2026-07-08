import { getGoogleCredentials, isGoogleConfigured } from "./google-config";

export { isGoogleConfigured };

export async function getGoogleAuth(scopes: string[]) {
  const creds = await getGoogleCredentials();
  if (!creds) throw new Error("google_not_configured");

  const { google } = await import("googleapis");
  return new google.auth.JWT({
    email: creds.serviceAccountEmail,
    key: creds.privateKey,
    scopes,
  });
}

export async function getSheetsApi() {
  const auth = await getGoogleAuth([
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
  const { google } = await import("googleapis");
  return google.sheets({ version: "v4", auth });
}

export async function googleServiceConfigured() {
  return isGoogleConfigured();
}
