/**
 * Digital Asset Links, served at /.well-known/assetlinks.json (see the rewrite in next.config.ts).
 * Lets the Android app open this site full screen. Add Google Play's app-signing fingerprint here
 * once the app is uploaded to Play (Play Console > App integrity).
 */
const FINGERPRINTS = ["86:E0:1D:36:03:CC:07:05:CB:CA:9F:CB:63:25:A7:81:1A:D2:AA:C4:AE:74:AC:95:06:AC:F2:98:2E:3F:9B:50"];

export function GET() {
  return Response.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "app.vercel.botched", sha256_cert_fingerprints: FINGERPRINTS },
      },
    ],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
