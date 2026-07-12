export type ApiErrorCode =
  | "PLAYER_NOT_FOUND"
  | "NO_STATS"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INVALID_NICKNAME"
  | "SAME_PLAYER";

const DEFAULT_STATUS_BY_CODE = {
  PLAYER_NOT_FOUND: 404,
  NO_STATS: 200,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  INVALID_NICKNAME: 400,
  SAME_PLAYER: 400,
} satisfies Record<ApiErrorCode, number>;

export class ApiError extends Error {
  code: ApiErrorCode;
  nicknames: string[];
  httpStatus: number;

  constructor(
    code: ApiErrorCode,
    options?: {
      httpStatus?: number;
      nicknames?: string[];
    },
  ) {
    super(messageForCode(code, options?.nicknames));
    this.name = "ApiError";
    this.code = code;
    this.nicknames = options?.nicknames ?? [];
    this.httpStatus = options?.httpStatus ?? DEFAULT_STATUS_BY_CODE[code];
  }
}

export function messageForCode(code: ApiErrorCode, nicknames: string[] = []) {
  switch (code) {
    case "PLAYER_NOT_FOUND":
      if (nicknames.length === 1) {
        return `Player not found: ${nicknames[0]}`;
      }
      if (nicknames.length > 1) {
        return `Players not found: ${nicknames.join(", ")}`;
      }
      return "Player not found.";
    case "NO_STATS":
      return nicknames.length === 1
        ? `Player has no CS2 statistics: ${nicknames[0]}`
        : "Player has no CS2 statistics.";
    case "RATE_LIMITED":
      return "FACEIT API rate limit reached. Please try again later.";
    case "UPSTREAM_ERROR":
      return "FACEIT API is unavailable. Please try again later.";
    case "INVALID_NICKNAME":
      return "Invalid nickname. Use 1-30 characters: letters, digits, dash, underscore, or dot.";
    case "SAME_PLAYER":
      return "Choose two different players.";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
