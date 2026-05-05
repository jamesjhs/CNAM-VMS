/**
 * SharePoint integration via Microsoft Graph API.
 *
 * Uses @azure/msal-node for app-only (client credentials) token acquisition
 * and the native fetch API for all Graph API calls.
 *
 * Credentials are read from system_settings (DB) with environment variable
 * fallbacks, following the same pattern as SMTP settings.
 */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { getDb } from '@/lib/db';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SharePointConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  siteUrl: string;
  driveName: string;
}

export interface SharePointItem {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  webUrl?: string;
}

function getDbSetting(key: string): string | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function getSharePointConfig(): SharePointConfig | null {
  const tenantId =
    getDbSetting('sharepoint.tenantId') ?? process.env.SHAREPOINT_TENANT_ID ?? '';
  const clientId =
    getDbSetting('sharepoint.clientId') ?? process.env.SHAREPOINT_CLIENT_ID ?? '';
  const clientSecret =
    getDbSetting('sharepoint.clientSecret') ?? process.env.SHAREPOINT_CLIENT_SECRET ?? '';
  const siteUrl =
    getDbSetting('sharepoint.siteUrl') ?? process.env.SHAREPOINT_SITE_URL ?? '';
  const driveName =
    getDbSetting('sharepoint.driveName') ?? process.env.SHAREPOINT_DRIVE_NAME ?? 'Documents';

  if (!tenantId || !clientId || !clientSecret || !siteUrl) return null;
  return { tenantId, clientId, clientSecret, siteUrl, driveName };
}

export function isSharePointConfigured(): boolean {
  return getSharePointConfig() !== null;
}

// ─── MSAL token acquisition ───────────────────────────────────────────────────

let ccaCache: { cca: ConfidentialClientApplication; fingerprint: string } | null = null;

function getCca(config: SharePointConfig): ConfidentialClientApplication {
  const fingerprint = `${config.tenantId}:${config.clientId}:${config.clientSecret}`;
  if (ccaCache?.fingerprint === fingerprint) return ccaCache.cca;

  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
  });
  ccaCache = { cca, fingerprint };
  return cca;
}

async function getAccessToken(config: SharePointConfig): Promise<string> {
  const cca = getCca(config);
  const result = await cca.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) throw new Error('Failed to acquire SharePoint access token');
  return result.accessToken;
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

async function graphRequest<T>(
  config: SharePointConfig,
  method: string,
  path: string,
  body?: Buffer | Record<string, unknown>,
  contentType?: string,
): Promise<T> {
  const token = await getAccessToken(config);
  const url = `https://graph.microsoft.com/v1.0${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  if (body !== undefined) {
    headers['Content-Type'] = contentType ?? 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: (body instanceof Buffer
      ? (body as unknown as BodyInit)
      : body !== undefined
      ? JSON.stringify(body)
      : undefined) as BodyInit | null | undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `Graph API ${method} ${path} failed: ${response.status} ${errorText.slice(0, 300)}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ─── Site and drive ID resolution ─────────────────────────────────────────────

interface SiteDriveCache {
  siteId: string;
  driveId: string;
  fingerprint: string;
  expiresAt: number;
}
let siteCache: SiteDriveCache | null = null;

async function getSiteAndDriveId(
  config: SharePointConfig,
): Promise<{ siteId: string; driveId: string }> {
  const fingerprint = `${config.siteUrl}:${config.driveName}`;
  const now = Date.now();

  if (siteCache && siteCache.fingerprint === fingerprint && siteCache.expiresAt > now) {
    return { siteId: siteCache.siteId, driveId: siteCache.driveId };
  }

  // Resolve site ID from URL
  const url = new URL(config.siteUrl);
  const host = url.hostname;
  const sitePath = url.pathname.replace(/\/$/, '') || '/';

  const siteData = await graphRequest<{ id: string }>(
    config,
    'GET',
    `/sites/${host}:${sitePath}`,
  );
  const siteId = siteData.id;

  // Resolve drive by name
  const drivesData = await graphRequest<{ value: { id: string; name: string }[] }>(
    config,
    'GET',
    `/sites/${siteId}/drives`,
  );

  const drive =
    drivesData.value.find(
      (d) => d.name.toLowerCase() === config.driveName.toLowerCase(),
    ) ?? drivesData.value[0];

  if (!drive) throw new Error('No drives found in SharePoint site');

  siteCache = {
    siteId,
    driveId: drive.id,
    fingerprint,
    expiresAt: now + 3_600_000, // 1-hour cache
  };
  return { siteId, driveId: drive.id };
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Validate that a folder path used in Graph API URLs contains only safe characters.
 * Prevents SSRF via path traversal or URL manipulation in SharePoint paths.
 * Throws if the path is unsafe.
 */
function assertSafeFolderPath(folderPath: string): void {
  if (!folderPath) return;
  // Reject any remaining .. sequences or characters outside the allowlist
  if (/\.\./.test(folderPath) || /[^a-zA-Z0-9 \-_./]/.test(folderPath)) {
    throw new Error(`Unsafe SharePoint folder path: ${folderPath}`);
  }
}

// ─── Folder operations ────────────────────────────────────────────────────────

/**
 * Ensure a folder path exists in the drive, creating any missing segments.
 */
export async function ensureFolder(
  config: SharePointConfig,
  folderPath: string,
): Promise<void> {
  assertSafeFolderPath(folderPath);
  const { driveId } = await getSiteAndDriveId(config);
  const parts = folderPath.split('/').filter(Boolean);

  for (let i = 1; i <= parts.length; i++) {
    const partial = parts.slice(0, i).join('/');
    const parent = parts.slice(0, i - 1).join('/');
    const name = parts[i - 1];

    // Check if folder already exists
    try {
      await graphRequest<unknown>(config, 'GET', `/drives/${driveId}/root:/${partial}`);
      continue; // exists, move on
    } catch {
      // not found — fall through to create
    }

    // Create the folder
    const parentEndpoint = parent
      ? `/drives/${driveId}/root:/${parent}:/children`
      : `/drives/${driveId}/root/children`;

    try {
      await graphRequest<unknown>(config, 'POST', parentEndpoint, {
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
    } catch (err) {
      // 409 nameAlreadyExists means a concurrent create beat us — that's fine
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('409') && !msg.includes('nameAlreadyExists')) throw err;
    }
  }
}

/**
 * Ensure the three fixed top-level folders exist.
 */
export async function ensureTopLevelFolders(config: SharePointConfig): Promise<void> {
  await Promise.all([
    ensureFolder(config, 'Training'),
    ensureFolder(config, 'Policies'),
    ensureFolder(config, 'Teams'),
  ]);
}

// ─── File listing ─────────────────────────────────────────────────────────────

/**
 * List the items in a SharePoint folder path.
 * Pass an empty string or omit folderPath to list the drive root.
 */
export async function listFolder(
  config: SharePointConfig,
  folderPath: string,
): Promise<SharePointItem[]> {
  assertSafeFolderPath(folderPath);
  const { driveId } = await getSiteAndDriveId(config);
  const endpoint = folderPath
    ? `/drives/${driveId}/root:/${folderPath}:/children`
    : `/drives/${driveId}/root/children`;

  const data = await graphRequest<{ value: SharePointItem[] }>(config, 'GET', endpoint);
  return data.value ?? [];
}

// ─── File upload ──────────────────────────────────────────────────────────────

/**
 * Upload a file buffer to a specific folder path in SharePoint.
 * Uses the simple upload API (suitable for files ≤ 4 MB).
 */
export async function uploadFile(
  config: SharePointConfig,
  folderPath: string,
  filename: string,
  buffer: Buffer,
): Promise<SharePointItem> {
  assertSafeFolderPath(folderPath);
  const safeFilename = filename.replace(/[^a-zA-Z0-9._\- ]/g, '_');
  const { driveId } = await getSiteAndDriveId(config);
  const uploadPath = folderPath
    ? `/drives/${driveId}/root:/${folderPath}/${safeFilename}:/content`
    : `/drives/${driveId}/root:/${safeFilename}:/content`;

  return graphRequest<SharePointItem>(
    config,
    'PUT',
    uploadPath,
    buffer,
    'application/octet-stream',
  );
}

// ─── File download ────────────────────────────────────────────────────────────

/**
 * Download the raw bytes of a file by its item ID.
 * The returned Buffer can be streamed back to the client.
 */
export async function downloadItem(
  config: SharePointConfig,
  itemId: string,
): Promise<{ buffer: Buffer; filename: string; mimeType: string }> {
  const { driveId } = await getSiteAndDriveId(config);

  // Get item metadata first to obtain the download URL and name
  const item = await graphRequest<
    SharePointItem & {
      '@microsoft.graph.downloadUrl'?: string;
      file?: { mimeType: string };
    }
  >(config, 'GET', `/drives/${driveId}/items/${itemId}`);

  const downloadUrl = item['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) throw new Error('No download URL available for this item');

  const token = await getAccessToken(config);
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);

  const arrayBuffer = await res.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    filename: item.name,
    mimeType: item.file?.mimeType ?? 'application/octet-stream',
  };
}

// ─── Item deletion ────────────────────────────────────────────────────────────

export async function deleteItem(config: SharePointConfig, itemId: string): Promise<void> {
  const { driveId } = await getSiteAndDriveId(config);
  await graphRequest<void>(config, 'DELETE', `/drives/${driveId}/items/${itemId}`);
}

// ─── Team folder helpers ──────────────────────────────────────────────────────

/**
 * Convert a team name to a URL-safe folder slug.
 * Returns a non-empty string — if the name produces an empty slug, returns 'team'.
 */
export function slugifyTeamName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  return slug || 'team';
}

/**
 * Create the SharePoint folder for a team (Teams/<slug>) and return its path.
 * Ensures the parent Teams folder exists first.
 * @param teamId Optional team ID used as a suffix when the name slug is ambiguous.
 */
export async function createTeamFolder(
  config: SharePointConfig,
  teamName: string,
  teamId?: string,
): Promise<string> {
  let slug = slugifyTeamName(teamName);
  // Append a short ID suffix when provided, to prevent collisions between teams
  // whose names produce the same slug (e.g. "!!!" and "###" both become "team").
  if (teamId) slug = `${slug}-${teamId.slice(-6)}`;
  const folderPath = `Teams/${slug}`;
  await ensureFolder(config, 'Teams');
  await ensureFolder(config, folderPath);
  return folderPath;
}
