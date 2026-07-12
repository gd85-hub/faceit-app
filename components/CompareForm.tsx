type CompareFormProps = {
  playerA?: string;
  playerB?: string;
  message?: string;
  fieldErrors?: {
    playerA?: string;
    playerB?: string;
  };
};

function inputClass(hasError: boolean) {
  const base =
    "mt-2 w-full rounded-lg border bg-[var(--surface)] px-3 py-2 text-[var(--text)] placeholder:text-[var(--text-faint)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]";

  return hasError
    ? `${base} border-2 border-red-500`
    : `${base} border-[var(--border)]`;
}

export function CompareForm({
  playerA = "",
  playerB = "",
  message,
  fieldErrors = {},
}: CompareFormProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[480px] flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)]">
          FACEIT CS2 compare
        </h1>
        <p className="mt-3 text-sm text-[var(--text-dim)]">
          Compare CS2 stats for any two FACEIT players.
        </p>
      </div>

      {message ? (
        <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]">
          {message}
        </p>
      ) : null}

      <form action="/compare" method="get" className="space-y-5">
        <div>
          <label
            htmlFor="playerA"
            className="text-sm font-medium text-[var(--text)]"
          >
            First nickname
          </label>
          <input
            id="playerA"
            name="playerA"
            defaultValue={playerA}
            placeholder="First nickname"
            className={inputClass(Boolean(fieldErrors.playerA))}
          />
          {fieldErrors.playerA ? (
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              {fieldErrors.playerA}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="playerB"
            className="text-sm font-medium text-[var(--text)]"
          >
            Compare with
          </label>
          <input
            id="playerB"
            name="playerB"
            defaultValue={playerB}
            placeholder="Player to compare with"
            className={inputClass(Boolean(fieldErrors.playerB))}
          />
          {fieldErrors.playerB ? (
            <p className="mt-2 text-sm text-[var(--text-dim)]">
              {fieldErrors.playerB}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 font-medium text-[var(--text)] transition-colors hover:border-[var(--text-faint)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--text)]"
        >
          Compare
        </button>
      </form>
    </section>
  );
}
