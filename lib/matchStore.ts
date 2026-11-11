import { get, put } from "@vercel/blob";
import type { CollectedMatch } from "@/types/matches";

/**
 * Per-player match archive. One JSON document per player, kept in Vercel Blob.
 *
 * The Vercel filesystem is ephemeral, so nothing here ever touches disk: the
 * only implementations are Blob (production) and in-memory (tests).
 */

export const MATCH_DOCUMENT_VERSION = 1;

export type PlayerMatchDocument = {
  version: typeof MATCH_DOCUMENT_VERSION;
  player_id: string;
  updated_at: string;
  /** Newest first, unique by match_id. */
  matches: CollectedMatch[];
};

export type StoredDocument = {
  document: PlayerMatchDocument;
  /** Opaque version tag used for conditional writes. */
  etag: string;
};

export interface MatchStore {
  read(playerId: string): Promise<StoredDocument | null>;
  /**
   * Writes only if the stored version still has `etag` (or does not exist yet
   * when `etag` is null). Throws StoreConflictError otherwise.
   */
  write(
    playerId: string,
    document: PlayerMatchDocument,
    etag: string | null,
  ): Promise<void>;
}

export class StoreConflictError extends Error {
  constructor(playerId: string) {
    super(`Match document for ${playerId} changed while it was being updated`);
    this.name = "StoreConflictError";
  }
}

export function emptyDocument(playerId: string): PlayerMatchDocument {
  return {
    version: MATCH_DOCUMENT_VERSION,
    player_id: playerId,
    updated_at: new Date(0).toISOString(),
    matches: [],
  };
}

function finishedAtMs(match: CollectedMatch) {
  const ms = match.finished_at ? Date.parse(match.finished_at) : Number.NaN;
  return Number.isFinite(ms) ? ms : -Infinity;
}

/**
 * Adds new matches to stored ones. match_id is the key: a duplicate is
 * dropped and the stored copy wins, because it was collected earlier.
 */
export function mergeMatches(
  stored: readonly CollectedMatch[],
  incoming: readonly CollectedMatch[],
): CollectedMatch[] {
  const byId = new Map<string, CollectedMatch>();

  for (const match of [...stored, ...incoming]) {
    if (!byId.has(match.match_id)) {
      byId.set(match.match_id, match);
    }
  }

  return [...byId.values()].toSorted((a, b) => finishedAtMs(b) - finishedAtMs(a));
}

function blobPathname(playerId: string) {
  return `players/${encodeURIComponent(playerId)}.json`;
}

function isPreconditionFailure(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "BlobPreconditionFailedError" ||
      /already exists|precondition/i.test(error.message))
  );
}

function parseDocument(text: string, playerId: string): PlayerMatchDocument {
  const parsed = JSON.parse(text) as Partial<PlayerMatchDocument>;

  return {
    ...emptyDocument(playerId),
    ...parsed,
    matches: Array.isArray(parsed.matches) ? parsed.matches : [],
  };
}

export function blobMatchStore(): MatchStore {
  return {
    async read(playerId) {
      const result = await get(blobPathname(playerId), {
        access: "private",
        // Read-modify-write must see the latest version, not a CDN copy.
        useCache: false,
      });

      if (!result || result.statusCode !== 200) {
        return null;
      }

      const text = await new Response(result.stream).text();
      return {
        document: parseDocument(text, playerId),
        etag: result.blob.etag,
      };
    },

    async write(playerId, document, etag) {
      try {
        await put(blobPathname(playerId), JSON.stringify(document), {
          access: "private",
          contentType: "application/json",
          addRandomSuffix: false,
          cacheControlMaxAge: 60,
          ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
        });
      } catch (error) {
        if (isPreconditionFailure(error)) {
          throw new StoreConflictError(playerId);
        }

        throw error;
      }
    },
  };
}

export function memoryMatchStore(): MatchStore & {
  documents: Map<string, StoredDocument>;
} {
  const documents = new Map<string, StoredDocument>();
  let version = 0;

  return {
    documents,
    async read(playerId) {
      const stored = documents.get(playerId);
      return stored ? structuredClone(stored) : null;
    },
    async write(playerId, document, etag) {
      const current = documents.get(playerId);

      if ((current?.etag ?? null) !== etag) {
        throw new StoreConflictError(playerId);
      }

      version += 1;
      documents.set(playerId, {
        document: structuredClone(document),
        etag: `v${version}`,
      });
    },
  };
}

/**
 * Either a read-write token or a store id is enough. With BLOB_STORE_ID the
 * SDK authenticates via Vercel OIDC, whose token at runtime comes from the
 * request (x-vercel-oidc-token), not from process.env — so VERCEL_OIDC_TOKEN
 * must not be required here.
 */
export function blobConfigured(
  env: Partial<Record<string, string | undefined>> = process.env,
) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
}

let defaultStore: MatchStore | null | undefined;

/** Blob store, or null when Blob credentials are not configured. */
export function getDefaultMatchStore(): MatchStore | null {
  if (defaultStore === undefined) {
    defaultStore = blobConfigured() ? blobMatchStore() : null;

    if (!defaultStore) {
      console.warn(
        "[matchStore] Blob is not configured (no BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID): matches are collected but not saved.",
      );
    }
  }

  return defaultStore;
}

export function setDefaultMatchStoreForTests(store: MatchStore | null | undefined) {
  defaultStore = store;
}
