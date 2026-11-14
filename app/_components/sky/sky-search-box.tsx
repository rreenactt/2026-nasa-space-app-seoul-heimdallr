"use client";

import { SearchIcon } from "lucide-react";
import { useId, useState } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { EquatorialCoordinates } from "./sky-coordinates";
import { parseSkySearch } from "./sky-search";
import { TEST_TARGETS, type TestTarget } from "./test-targets";

type SkySearchBoxProps = {
  onTarget: (target: TestTarget) => void;
  onPoint: (point: EquatorialCoordinates) => void;
};

/** Jump to a test target by name or to coordinates; both open the analysis panel there. */
export function SkySearchBox({ onTarget, onPoint }: SkySearchBoxProps) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listId = useId();
  const errorId = useId();

  return (
    <form
      role="search"
      className="dark absolute top-4 left-4 w-96 text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        const result = parseSkySearch(query);
        if (result.kind === "error") {
          setError(result.message);
          return;
        }
        setError(null);
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
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.blur();
          }}
          list={listId}
          placeholder="Test target or RA Dec (e.g. 17 57 48.5 +04 41 36)"
          aria-label="Search the sky by test target name or coordinates"
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
          {error}
        </p>
      )}
    </form>
  );
}
