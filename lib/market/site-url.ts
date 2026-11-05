export function getPublicSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) return new URL(configuredUrl);

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return new URL(vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`);
  }

  return new URL('http://localhost:3000');
}
