"use client";

import { SearchIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useT } from "@/app/_i18n/i18n-provider";
import type { MessageKey } from "@/app/_i18n/message-keys";
import { apiGet } from "@/lib/ky";
import { useCandidateUpdates } from "./candidates-context";
import type { CandidateLookup } from "./review-queue";
import { angularDistance, type EquatorialCoordinates } from "./sky-coordinates";
import { parseSkySearch, type SkyName } from "./sky-search";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

type SkySearchBoxProps = {
  onTarget: (target: TestTarget) => void;
  onPoint: (point: EquatorialCoordinates) => void;
};

/** A name the database had no candidate for, or could not be asked about: the user chooses to go to its position. */
type NameNote = { point: EquatorialCoordinates; text: MessageKey; failed: boolean };

/** A candidate name is truncated from its position, so the candidate can sit up to about 1.5″ away (as the server). */
const NAME_RADIUS_DEG = 3 / 3600;

/**
 * Jump to a test target, a candidate or a 2MASS name, or to coordinates; each opens the analysis panel there (Figma
 * "I · Search open · states"). Names are looked up in the database on every search, so a candidate added or removed
 * since the page loaded is found or not, and the page's candidate list is brought in line with the answer.
 */
export function SkySearchBox({ onTarget, onPoint }: SkySearchBoxProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [looking, setLooking] = useState(false);
  const [note, setNote] = useState<NameNote | null>(null);
  const lookup = useRef(0);
  const { remember, forget } = useCandidateUpdates();
  const listId = useId();
  const errorId = useId();

  const lookUp = async (name: SkyName) => {
    const id = ++lookup.current;
    setLooking(true);
    try {
      const result = await apiGet<CandidateLookup>("/api/candidates/lookup", { name: name.designation });
      if (id !== lookup.current) return;
      if (result.candidate) {
        remember(result.candidate);
        onPoint({ ra: result.candidate.ra, dec: result.candidate.dec });
        return;
      }
      // The database has no candidate under this name: drop any this page still shows for it.
      forget((candidate) =>
        name.twoMass
          ? candidate.tmassDesignation === `2MASS ${name.designation}`
          : angularDistance(candidate, name.point) <= NAME_RADIUS_DEG,
      );
      setNote({
        point: result.point,
        failed: false,
        text: name.twoMass
          ? "search.noCandidate2Mass"
          : "search.noCandidate",
      });
    } catch {
      if (id !== lookup.current) return;
      setNote({ point: name.point, failed: true, text: "search.lookupFailed" });
    } finally {
      if (id === lookup.current) setLooking(false);
    }
  };

  return (
    <form
      role="search"
      className="dark w-96 text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        const result = parseSkySearch(query);
        setNote(null);
        if (result.kind === "error") {
          setError(result.message);
          return;
        }
        setError(null);
        if (result.kind === "name") {
          void lookUp(result.name);
          return;
        }
        if (result.kind === "target") onTarget(result.target);
        else onPoint(result.point);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <InputGroup className="bg-black/70 backdrop-blur-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
            setNote(null);
            // A new query cancels an answer still on its way.
            lookup.current += 1;
            setLooking(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
          list={listId}
          placeholder={t("search.placeholder")}
          aria-label={t("search.inputLabel")}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </InputGroup>
      <datalist id={listId}>
        {TEST_TARGETS.map((target) => (
          <option key={target.id} value={target.name} />
        ))}
      </datalist>
      {error && (
        <p id={errorId} role="alert" className="mt-2 rounded-md bg-black/70 px-3 py-2 text-xs text-amber-200">
          {t(error)}
        </p>
      )}
      {looking && (
        <p role="status" className="mt-2 rounded-md bg-black/70 px-3 py-2 text-xs text-ash">
          {t("search.looking")}
        </p>
      )}
      {note && (
        <div role="status" className="mt-2 grid gap-1.5 rounded-md bg-black/70 px-3 py-2 text-xs">
          <p className={note.failed ? "text-amber-200" : "text-ash"}>{t(note.text)}</p>
          <button
            type="button"
            className="justify-self-start font-medium text-paper hover:underline"
            onClick={() => onPoint(note.point)}
          >
            {t("search.goToPosition")}
          </button>
        </div>
      )}
    </form>
  );
}
