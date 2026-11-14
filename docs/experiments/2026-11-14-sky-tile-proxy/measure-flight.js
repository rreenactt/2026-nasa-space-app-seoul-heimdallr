// Measures how long the sky takes to sharpen after a search fly-to. Paste into the browser console.
//
// 1. Open the sky screen (direct: `/`, through the proxy: `/?hipsProxy=1` with the experiment code applied).
// 2. Type a coordinate you have never visited into the search box (e.g. `275.0 -20.0`), but do not press Enter.
// 3. Run `startFlightMeasure()` in the console, then press Enter in the search box.
// 4. After about 15 seconds, run `readFlightMeasure()`.
//
// The highest order requested is the final one; its last arrival is when the view became sharp.

window.startFlightMeasure = () => {
  performance.setResourceTimingBufferSize(5000);
  performance.clearResourceTimings();
  window.__flightMark = performance.now();
};

window.readFlightMeasure = () => {
  const mark = window.__flightMark;
  const tiles = performance.getEntriesByType("resource").filter((entry) => entry.name.includes("Norder"));
  const byOrder = {};
  for (const entry of tiles) {
    const order = Number(entry.name.match(/Norder(\d+)/)[1]);
    const stats = (byOrder[order] ??= { tiles: 0, lastArrivalMs: 0 });
    stats.tiles += 1;
    stats.lastArrivalMs = Math.max(stats.lastArrivalMs, Math.round(entry.responseEnd - mark));
  }
  const finalOrder = Math.max(...Object.keys(byOrder).map(Number));
  return {
    host: tiles[0] && new URL(tiles[0].name).host,
    requests: tiles.length,
    finalOrder,
    sharpAtMs: byOrder[finalOrder].lastArrivalMs,
    byOrder,
  };
};
