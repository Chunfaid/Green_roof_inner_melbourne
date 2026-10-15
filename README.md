# Green Roof Web Map — Interactive + Improved Colours

Put your existing GeoJSON files inside the `data/` folder with the same filenames:

- Project_boundaries.geojson
- Population_density.geojson
- Socioeconomic_index.geojson
- NDVI.geojson
- land_surface_temperture.geojson
- green_roof_neeed_score.geojson
- greenroof_candidate.geojson
- Scenario_1_priority.geojson
- Scenario_2_targeted.geojson
- Scenario_3_Board.geojson

## Improvements

- Population uses a blue ramp.
- SEIFA vulnerability uses a purple ramp.
- NDVI need progresses from green to warm colours as greening need rises.
- LST uses a yellow-to-red heat ramp.
- Combined intervention need uses a yellow-to-red priority ramp.
- Candidate roofs use Very High → Very Low priority colours.
- Cooling scenarios use a light-to-dark blue cooling ramp.
- Clicking a candidate roof highlights it and opens a dedicated information panel.
- The roof panel shows key decision attributes first, plus every available GeoJSON attribute.
- Candidate roofs are lazy-loaded only when switched on.

## Test locally

```bash
python3 -m http.server 8000
```

Then open:

http://localhost:8000


## Fixed layer order

Input-factor layers now render above the combined Need layer, so their distinct colour palettes are visible:

- Population = blue
- SEIFA = purple
- NDVI/greening need = green-to-warm
- LST = yellow-to-red
- Combined Need = yellow-to-red
- Cooling scenarios = blue


## Candidate priority colour fix

This version supports `priority_c` as either:

- a text class (`Very High`, `High`, `Moderate`, `Low`, `Very Low`), or
- a numeric candidate-priority score.

Numeric priority thresholds used by the project:

- >= 4.5 = Very High
- >= 4.0 = High
- >= 3.0 = Moderate
- >= 2.0 = Low
- < 2.0 = Very Low

Candidate polygons are also more opaque so the priority colours remain visible over OpenStreetMap.


## Roof attribute mapping updated from the actual candidate table

The candidate roof interface now supports the actual field names shown in QGIS, including:

- council
- source
- height_m
- area_m2
- area_score
- need_score
- roof_prob
- NDVI_score
- confidence
- unique uid
- priority c
- population
- SEIFA scor
- LST / LST_score

The roof panel prioritises the planning-relevant fields first and keeps the remaining fields available under Show all.


## SEIFA layer fix

The web map now recognises more possible SEIFA field names and automatically looks for a 1–5 numeric score field if the configured field name does not match the GeoJSON exactly.

This fixes the common case where the layer loads but appears blank / pale because every feature was being treated as `Not assessed`.


## Exact SEIFA fields confirmed from QGIS

The socioeconomic layer now uses:

- `vuln_score` for the 1–5 vulnerability classification and web-map colouring
- `grid_irsd` as the underlying IRSD value shown in the popup

Other fields such as `sum_weighted` and `sum_valid_area` are retained in the GeoJSON but are not used for the main display.


## Candidate priority display fix

Candidate roof styling now reads the exact QGIS field:

- `priority c`

Supported values:

- Very High
- High
- Moderate
- Low
- Very low / Very Low

Candidate polygons use 90% fill opacity so the priority colours remain clearly visible over the OpenStreetMap building footprints.
