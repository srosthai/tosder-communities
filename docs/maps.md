# Maps

The map layer uses Leaflet with OpenStreetMap tiles for development. The map is
**not loaded on page load**: a lightweight facade renders the destination count
and an "Open map" button. Leaflet, marker clustering, tiles, and the route layer
load only after the person asks for the map.

## Implementation

- `src/components/public/MapView.astro` renders the facade, map canvas, and an
  accessible destination list.
- `Leaflet.markercluster` groups dense pins.
- Markers use `circleMarker` so the build does not depend on Leaflet's default
  image paths.
- The Explore map follows the current page's result set.
- The destination detail map centers on the place and links back through the
  list fallback.

## Tiles

Development uses the OpenStreetMap standard tile server with visible
attribution. Do not treat public OSM tiles as an unlimited production service.
Before launch, choose a provider whose usage policy and plan fit expected
traffic, and record the decision in the ADR/decision log.

## Accessibility

- The facade is a button with a clear label.
- The map container is a labelled region.
- A server-rendered `<details>` list provides the same places and links without
  the map.
- Scroll-wheel zoom is off so the map does not hijack page scrolling.

## Future

- Admin/builder location picker.
- Route line display for template days.
- Clustering tests at a larger destination volume.
- Production tile provider and usage monitoring.
