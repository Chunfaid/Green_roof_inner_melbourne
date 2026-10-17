# Green Roof Implementation Support Map — Inner Melbourne

**Live website:** https://chunfaid.github.io/Green_roof_inner_melbourne/

An interactive, exploratory spatial decision-support map for prioritising potential green-roof interventions across the Inner Melbourne study area. This prototype supports planning investigation; it does **not** establish rooftop engineering feasibility or predict measured neighbourhood air-temperature changes.

## Use the map

1. **Cooling need:** review the combined priority map or its four contributing indicators. Select one of five weighting approaches.
2. **Rooftops:** inspect screened candidate rooftop polygons, their available attributes and the priority scores associated with each planning focus.
3. **Scenarios:** choose a planning focus and compare three progressively broader rooftop selections. The map shows illustrative modelled land-surface cooling, the number of affected 250 m grid cells, the average reduction **per affected cell**, and a three-scenario comparison chart.

The selected focus is carried between views. The scenario chart compares affected grid-cell counts using bars and displays average cooling in degrees Celsius in each row. A scale bar displays distances in metres or kilometres.

## Spatial inputs and assessment

The analysis uses a nominal **250 m × 250 m** grid (62,500 m² per complete cell). The four indicators are population density (exposure), socioeconomic disadvantage/vulnerability (SEIFA IRSD), vegetation need (NDVI), and land surface temperature (LST). Indicator scores are displayed on a relative 1–5 scale.

The original **Balanced** combined-need score uses the project's existing `need_score` field. The alternative focus maps increase the weight of one indicator to **40%** and give each of the remaining three **20%**. Their grid score fields are `w_heat`, `w_equity`, `w_green`, and `w_pop`, respectively. These weighting choices are sensitivity scenarios, not empirically optimised weights.

### Rooftop priority and selection

Potential roofs were identified and screened in QGIS using available building/roof data. The original candidate priority combines intervention need and an area suitability score:

`candidate_score = (need_score + area_score) / 2`

For alternative focus `F`, the scenario selection uses:

`p_F = (w_F + area_score) / 2`

The uploaded weighted candidate rooftop layer is `data/Greenroof_weight_v2.geojson`. This project retains the earlier screening and does not claim a structural or waterproofing inspection.

| Priority band | Score |
|---|---|
| Very High | ≥ 4.5 |
| High | ≥ 4.0 and < 4.5 |
| Moderate | ≥ 3.0 and < 4.0 |
| Low | ≥ 2.0 and < 3.0 |
| Very Low | < 2.0 |

The three implementation scenarios are **cumulative**, evaluated separately for each of the five planning focuses:

| Scenario | Included candidate scores | Selection |
|---|---|---|
| 1 — Priority | Very High | score ≥ 4.5 |
| 2 — Targeted | High + Very High | score ≥ 4.0 |
| 3 — Broad | Moderate + High + Very High | score ≥ 3.0 |

Null/unassessed focus scores are excluded from scenario rooftop selection.

## Cooling modelling workflow

The four alternative-focus scenario sets were generated using saved EPSG:7899 rooftop polygon selections. Per scenario the workflow is:

1. Repair invalid roof geometries where required; dissolve selected rooftop polygons to remove overlaps.
2. Intersect the dissolved geometry with the complete 250 m grid.
3. Sum intersected roof polygon area by the original grid `id`, using projected EPSG:7899 square metres.
4. Join the resulting `gr_area_sum` to the complete baseline temperature grid by `id`. Cells without selected area are represented by zero coverage.
5. Calculate the scenario rooftop coverage and modelled cooling; export complete grid polygons to EPSG:4326 GeoJSON for Leaflet.

The area-coverage and illustrative temperature formulas are:

```text
gr_percentage = gr_area_sum / 62500 × 100

if gr_percentage < 30:  cooling_C = NULL
if 30 <= gr_percentage <= 90:
    cooling_C = 1.0 + (gr_percentage - 30) × (2.8 / 60)
if gr_percentage > 90:  cooling_C = 3.8

scenario_LST = LST_mean - cooling_C, where a cooling value exists
scenario_LST = LST_mean, otherwise (if baseline LST is valid)
```

The 30% threshold defines **where this specific model returns a cooling estimate**. `NULL` cooling below the threshold does not establish that physical cooling is zero. The fixed 62,500 m² denominator is a simplifying nominal-full-cell assumption; boundary-clipped partial cells require caution.

The original Balanced scenarios are retained from the earlier QGIS workflow, while the alternative-focus outputs were batch generated using PyQGIS and compared for plausibility against the manually calculated Heat Scenario 1. The automated run returned 2,742 cells per new output and no rooftop-coverage values exceeding 100%. This is not independent scientific validation of the cooling model.

### Map statistics

- **Grid cells with temperature reduction:** grid cells with positive numeric modelled `cooling_C`.
- **Average temperature drop per affected grid cell:** arithmetic mean of positive `LST_mean - scenario_LST` where available, otherwise the positive `cooling_C` estimate for legacy Balanced layers. Unaffected cells are excluded.
- **Three-scenario comparison:** shows affected grid-cell counts as bars and average affected-cell cooling values in °C, for the selected focus.

The average is **not** the average drop across the study area or an air-temperature change, and each cell is given equal weight rather than weighting by population or affected area.

## Project data and filenames

### Priority and base layers

| Purpose | Repository file |
|---|---|
| Study boundary | `data/Project_boundaries.geojson` |
| Population | `data/Population_density.geojson` |
| Socioeconomic vulnerability | `data/Socioeconomic_index.geojson` |
| Vegetation need | `data/NDVI.geojson` |
| Surface temperature | `data/land_surface_temperture.geojson` |
| Original combined need | `data/green_roof_neeed_score.geojson` |
| Heat focus | `data/Temperture_Focus.geojson` |
| Equity focus | `data/equality_Focus.geojson` |
| Vegetation focus | `data/Greeness_Focus.geojson` |
| Population focus | `data/Population_foucs.geojson` |
| Weighted candidate roofs | `data/Greenroof_weight_v2.geojson` |

### Cooling scenario datasets

| Focus | Scenario 1 | Scenario 2 | Scenario 3 |
|---|---|---|---|
| Balanced | `Scenario_1_priority.geojson` | `Scenario_2_targeted.geojson` | `Scenario_3_Board.geojson` |
| Heat | `Heat_S1_cooling.geojson` | `Heat_S2_roofs_cooling.geojson` | `Heat_S3_roofs_cooling.geojson` |
| Equity | `Equity_S1_roofs_cooling.geojson` | `Equity_S2_roofs_cooling.geojson` | `Equity_S3_roofs_cooling.geojson` |
| Vegetation | `Green_S1_roofs_cooling.geojson` | `Green_S2_roofs_cooling.geojson` | `Green_S3_roofs_cooling.geojson` |
| Population | `Population_S1_roofs_cooling.geojson` | `Population_S2_roofs_cooling.geojson` | `Population_S3_roofs_cooling.geojson` |

All filenames in this table are under `data/`. The spelling of source filenames is intentional and must be preserved to avoid breaking links.

For the new outputs, typical fields include `id`, `LST_mean`, `gr_area_sum`, `gr_percentage`, `cooling_C`, and `scenario_LST`. Original Balanced files may have different field coverage.

## Running locally

From the repository root:

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. The webpage requires HTTP hosting to fetch local GeoJSON files (opening `index.html` directly as a file is not sufficient). The production map uses GitHub Pages and Leaflet/OpenStreetMap.

## Limitations and responsible use

- Roof polygons and flat-roof classification may contain omissions and errors. Roof suitability, load-bearing capacity, waterproofing, drainage, access, ownership and cost must be independently assessed.
- Detailed DSM/LOD2 coverage was not consistently available across all study councils, limiting confidence in roof characteristics.
- LST is surface temperature, **not** air temperature or direct human heat exposure.
- The cooling transfer function is illustrative and literature-derived, not calibrated or validated against observed local cooling.
- Score thresholds, weights and the nominal cell-area assumption affect results; sensitivity to these choices warrants further study.
- The outputs are planning screening scenarios, not engineering designs, investment approvals or guaranteed temperature reductions.

## Source documentation

Input source datasets and any supporting literature references should be cited from the project's original QGIS project/report documentation; this repository does not independently verify detailed acquisition dates, rooftop classification accuracy or the provenance of the cooling coefficients. Do not treat the example scenario formulas as a substitute for the original research citations.
