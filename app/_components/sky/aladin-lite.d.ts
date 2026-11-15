// aladin-lite ships no type declarations. These cover only what this app uses, checked against the
// aladin-lite 3.8.2 source (Aladin.AVAILABLE_CALLBACKS, the callback arguments it passes, and the methods below).
declare module "aladin-lite" {
  export type AladinOptions = {
    survey?: string;
    target?: string;
    fov?: number;
    cooFrame?: "ICRS" | "ICRSd" | "GAL";
    /** TAN is the perspective view from the sphere's center; Aladin Lite allows it up to 150°. */
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
    /** Keeps celestial north at the top while dragging (off by default: a drag can roll the view). */
    lockNorthUp?: boolean;
    /** Coordinate grid; its spacing follows the field of view. */
    gridOptions?: {
      enabled?: boolean;
      color?: string;
      opacity?: number;
      thickness?: number;
      showLabels?: boolean;
      labelSize?: number;
    };
  };

  /** RA/Dec are null when the pointer is outside the projection. */
  export type MouseMoveEvent = { ra: number | null; dec: number | null; x: number; y: number };
  export type ClickEvent = { ra: number; dec: number; x: number; y: number; isDragging: boolean };

  export type CatalogOptions = {
    name?: string;
    shape?: "square" | "circle" | "plus" | "cross" | "rhomb" | "triangle";
    sourceSize?: number;
    color?: string;
    displayLabel?: boolean;
    /** Key of the source data shown as the label; displayLabel needs it. */
    labelColumn?: string;
    labelColor?: string;
    labelFont?: string;
  };

  export type Source = { ra: number; dec: number; data: Record<string, unknown> };
  export type Catalog = { addSources(sources: Source | Source[]): void; show(): void; hide(): void };

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
    setFoVRange(min: number, max: number): void;
    /** Moves the center over `seconds`, then calls `complete`. */
    animateToRaDec(ra: number, dec: number, seconds?: number, complete?: () => void): void;
    /** Zooms to a field of view over `seconds`, then calls `complete`. */
    zoomToFoV(fov: number, seconds?: number, complete?: () => void): void;
    addCatalog(catalog: Catalog): void;
    /** Merges into the coordinate grid options; `enabled` shows or hides the grid. */
    setCooGrid(options: { enabled?: boolean }): void;
    /** Screen position [x, y] in CSS pixels, or undefined/null when the point is outside the view. */
    world2pix(ra: number, dec: number): [number, number] | null | undefined;
    pix2world(x: number, y: number): [number, number] | null | undefined;
    /**
     * The sky as drawn (WebGL canvas plus Aladin's own catalog canvas, not our overlay canvases) as a data URL, resized
     * to `width` × `height` device pixels. `logo: false` leaves out the Aladin logo.
     */
    getViewDataURL(options?: { format?: string; width?: number; height?: number; logo?: boolean }): Promise<string>;
  };

  const A: {
    /** Resolves once the WebAssembly core is ready; rejects without WebGL2. */
    init: Promise<void>;
    aladin(container: HTMLElement | string, options?: AladinOptions): Aladin;
    catalog(options?: CatalogOptions): Catalog;
    source(ra: number, dec: number, data?: Record<string, unknown>): Source;
  };
  export default A;
}
