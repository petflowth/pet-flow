/** Shared Google service account auth (Calendar + Sheets) */

export function googleServiceConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
  );
}

export async function getGoogleAuth(scopes: string[]) {
  const { google } = await import("googleapis");
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key,
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
