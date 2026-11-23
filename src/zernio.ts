/**
 * Zernio integration for Cik Alya.
 *
 * Wraps the official @zernio/node SDK with the helpers this project needs:
 * listing connected accounts, uploading media, and creating / scheduling posts.
 *
 * The API key is read from ZERNIO_API_KEY. Never hardcode it.
 */
import { Zernio } from "@zernio/node";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

export type Platform =
  | "tiktok" | "instagram" | "facebook" | "youtube" | "linkedin" | "twitter"
  | "threads" | "pinterest" | "bluesky" | "googlebusiness" | "telegram"
  | "snapchat" | "reddit" | "whatsapp" | "discord" | "slack";

export interface ConnectedAccount {
  id: string;
  platform: string;
  username?: string;
  displayName?: string;
  isActive?: boolean;
}

export interface MediaItem {
  type?: "image" | "video" | "gif" | "document";
  url: string;
}

export interface PostInput {
  content?: string;
  /** Platform names ("instagram") or explicit account ids. Defaults to every active account. */
  targets?: string[];
  /** ISO 8601 time. Omit (and leave publishNow false) to save a draft. */
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  /** Local file paths or public https URLs. Local files are uploaded first. */
  media?: string[];
  title?: string;
  hashtags?: string[];
  tags?: string[];
}

let client: Zernio | undefined;

export function getClient(): Zernio {
  if (!client) {
    if (!process.env.ZERNIO_API_KEY) {
      throw new Error(
        "ZERNIO_API_KEY is not set. Copy .env.example to .env and add your key.",
      );
    }
    client = new Zernio();
  }
  return client;
}

/** Read-only: lists the social accounts connected in the Zernio dashboard. */
export async function listAccounts(): Promise<ConnectedAccount[]> {
  const { data } = await getClient().accounts.listAccounts();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accounts = ((data as any)?.accounts ?? []) as any[];
  return accounts.map((a) => ({
    id: a._id,
    platform: a.platform,
    username: a.username,
    displayName: a.displayName,
    isActive: a.isActive,
  }));
}

/** Resolves platform names / account ids into Zernio `platforms` entries. */
export function resolveTargets(
  targets: string[] | undefined,
  accounts: ConnectedAccount[],
): { platform: string; accountId: string }[] {
  const active = accounts.filter((a) => a.isActive !== false);
  if (!targets || targets.length === 0) {
    if (active.length === 0) throw new Error("No connected accounts. Connect one at https://zernio.com.");
    return active.map((a) => ({ platform: a.platform, accountId: a.id }));
  }
  return targets.flatMap((t) => {
    const key = t.trim().toLowerCase();
    const byId = accounts.find((a) => a.id === t.trim());
    if (byId) return [{ platform: byId.platform, accountId: byId.id }];
    const matches = active.filter(
      (a) => a.platform === key || a.username?.toLowerCase() === key.replace(/^@/, ""),
    );
    if (matches.length === 0) {
      throw new Error(`No connected account matches "${t}". Run \`npm run zernio -- accounts\` to see options.`);
    }
    return matches.map((a) => ({ platform: a.platform, accountId: a.id }));
  });
}

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4",
  ".mov": "video/quicktime", ".m4v": "video/x-m4v", ".webm": "video/webm",
  ".mpeg": "video/mpeg", ".avi": "video/x-msvideo", ".pdf": "application/pdf",
};

function mediaType(contentType: string): MediaItem["type"] {
  if (contentType === "image/gif") return "gif";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "document";
}

/**
 * Uploads a local file via a presigned URL (up to 5 GB) and returns a media item
 * whose public URL can be attached to posts.
 */
export async function uploadMedia(filePath: string): Promise<MediaItem> {
  const contentType = MIME[extname(filePath).toLowerCase()];
  if (!contentType) throw new Error(`Unsupported media type: ${filePath}`);
  const { size } = await stat(filePath);

  const { data } = await getClient().media.getMediaPresignedUrl({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: { filename: basename(filePath), contentType: contentType as any, size },
  });
  if (!data?.uploadUrl || !data.publicUrl) throw new Error("Zernio did not return an upload URL.");

  const res = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await readFile(filePath),
  });
  if (!res.ok) throw new Error(`Media upload failed (${res.status}): ${await res.text()}`);

  return { type: mediaType(contentType), url: data.publicUrl };
}

/** Turns local paths into uploaded media; passes https URLs through unchanged. */
export async function prepareMedia(media: string[] | undefined): Promise<MediaItem[]> {
  const items: MediaItem[] = [];
  for (const m of media ?? []) {
    items.push(/^https?:\/\//i.test(m) ? { url: m } : await uploadMedia(m));
  }
  return items;
}

/**
 * Creates a post. With neither `scheduledFor` nor `publishNow` it is saved as a
 * draft, so nothing goes live by accident.
 */
export async function createPost(input: PostInput, accounts?: ConnectedAccount[]) {
  const platforms = resolveTargets(input.targets, accounts ?? (await listAccounts()));
  const mediaItems = await prepareMedia(input.media);
  const isDraft = !input.scheduledFor && !input.publishNow;

  const { data } = await getClient().posts.createPost({
    body: {
      content: input.content,
      title: input.title,
      hashtags: input.hashtags,
      tags: input.tags,
      timezone: input.timezone,
      scheduledFor: input.scheduledFor,
      publishNow: input.publishNow,
      isDraft,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      platforms: platforms as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mediaItems: mediaItems.length ? (mediaItems as any) : undefined,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const post = (data as any)?.post;
  return { id: post?._id as string, status: post?.status as string, platforms, isDraft };
}
