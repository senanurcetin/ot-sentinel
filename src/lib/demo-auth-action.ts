import { headers } from 'next/headers';
import { demoRequestAuthorized, parseDemoAuthConfig } from '@/lib/demo-auth';

/**
 * Defense in depth: Next.js server actions are independently exposed POSTs.
 * Never rely on a proxy matcher alone for this auth check.
 */
export async function assertDemoServerActionAuthorized(): Promise<void> {
  const config = parseDemoAuthConfig(process.env.DEMO_BASIC_AUTH);
  if (config.mode === 'open') return;
  if (config.mode !== 'protected') throw new Error('Demo access configuration invalid.');
  let authorization: string | null;
  try {
    authorization = (await headers()).get('authorization');
  } catch {
    throw new Error('Demo authorization required.');
  }
  if (!(await demoRequestAuthorized(config, authorization))) {
    throw new Error('Demo authorization required.');
  }
}
