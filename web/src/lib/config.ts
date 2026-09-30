// Inlined at build time by Next.js; CI sets these for each deploy.
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  commitSha: process.env.NEXT_PUBLIC_COMMIT_SHA ?? '',
  runUrl: process.env.NEXT_PUBLIC_RUN_URL ?? '',
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? '',
};

export const TENANT_ID = 'harbor-auto';
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';
