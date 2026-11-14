// aladin-lite ships no type declarations. These cover only what this app uses, checked against the
// aladin-lite 3.8.2 source (Aladin.AVAILABLE_CALLBACKS and the callback arguments it passes).
declare module "aladin-lite" {
  export type AladinOptions = {
    survey?: string;
    target?: string;
    fov?: number;
    cooFrame?: "ICRS" | "ICRSd" | "GAL";
    projection?: "SIN" | "TAN" | "AIT" | "MOL" | "MER" | "STG" | "ZEA";
    backgroundColor?: string;
    /** Sends anonymous usage statistics to CDS when true (the library default). */
    log?: boolean;
    showReticle?: boolean;
    showZoomControl?: boolean;
    showLayersControl?: boolean;
    showFullscreenControl?: boolean;
    showProjectionControl?: boolean;
    showFrame?: boolean;
    showFov?: boolean;
    showCooLocation?: boolean;
    showStatusBar?: boolean;
    showContextMenu?: boolean;
    showCooGridControl?: boolean;
    showSettingsControl?: boolean;
    showShareControl?: boolean;
    showSimbadPointerControl?: boolean;
    inertia?: boolean;
  };

  /** RA/Dec are null when the pointer is outside the projection. */
  export type MouseMoveEvent = { ra: number | null; dec: number | null; x: number; y: number };
  export type ClickEvent = { ra: number; dec: number; x: number; y: number; isDragging: boolean };

  export type Aladin = {
    on(event: "mouseMove", callback: (event: MouseMoveEvent) => void): void;
    on(event: "click", callback: (event: ClickEvent) => void): void;
    /** Receives the new horizontal field of view in degrees. */
    on(event: "zoomChanged", callback: (fov: number) => void): void;
    /** ICRS [ra, dec] of the view center, in degrees. */
    getRaDec(): [number, number];
    /** [horizontal, vertical] field of view in degrees. */
    getFov(): [number, number];
    gotoRaDec(ra: number, dec: number): void;
    setFoV(fov: number): void;
  };

  const A: {
    /** Resolves once the WebAssembly core is ready; rejects without WebGL2. */
    init: Promise<void>;
    aladin(container: HTMLElement | string, options?: AladinOptions): Aladin;
  };
  export default A;
}
