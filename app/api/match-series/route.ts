import { ApiError, isApiError, messageForCode } from "@/lib/errors";
import { getMatchSeries } from "@/lib/matchSeriesService";
import { assertCompareRateLimit } from "@/lib/rateLimit";

type ErrorBody = {
  error: {
    code: ApiError["code"];
    message: string;
    nicknames: string[];
  };
};

function errorResponse(error: ApiError): Response {
  const body: ErrorBody = {
    error: {
      code: error.code,
      message: messageForCode(error.code, error.nicknames),
      nicknames: error.nicknames,
    },
  };

  return Response.json(body, { status: error.httpStatus });
}

export async function GET(request: Request) {
  try {
    assertCompareRateLimit(request);

    const { searchParams } = new URL(request.url);
    const result = await getMatchSeries(
      searchParams.get("playerA"),
      searchParams.get("playerB"),
      searchParams.get("metric"),
    );

    return Response.json(result.body, {
      headers: {
        "x-match-series-cache": result.cacheStatus,
      },
    });
  } catch (error) {
    if (isApiError(error)) {
      return errorResponse(error);
    }

    return errorResponse(new ApiError("UPSTREAM_ERROR"));
  }
}
