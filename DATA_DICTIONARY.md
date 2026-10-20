# Data dictionary and interface contracts

This describes **fields used by the published application and scenario model**, not a complete dump of every QGIS input attribute. The GIS working projects and data provenance belong in the [original project archive](https://drive.google.com/drive/folders/1RLLwQCqrKRfBHzgTp6HNHYdhkORR0K4Q).

| Field | Meaning | Unit / convention | Notes |
| --- | --- | --- | --- |
| `id` | Stable original grid-cell identifier | Integer | Must be unique in the complete baseline grid; preserve during intersections and joins |
| `LST_mean` | Baseline land surface temperature | °C | Not ambient air temperature |
| `LST_score` | Scored relative LST need | 1–5 | Larger = higher need |
| `need_score` | Original combined need | Relative 1–5 score | Balanced approach |
| `w_heat`, `w_equity`, `w_green`, `w_pop` | Alternative indicator-weighted need | Relative score | Selected indicator 40%; others 20% each |
| `area_score` | Rooftop area-related priority | Relative score | Combined with need to form rooftop priority |
| `p_heat`, `p_equity`, `p_green`, `p_pop` | Alternative roof prioritisation | Score = (weighted need + area score)/2 | May be null if unassessed |
| `gr_area_sum` / `roof_area_m2` | Selected rooftop union area inside cell | m² | May differ between old and new files |
| `gr_percentage` | Cell coverage by selected candidate rooftops | % | Defined against nominal 62,500 m² |
| `cooling_C` | Illustrative modelled land surface cooling | °C | Null where the model makes no estimate |
| `scenario_LST` | Baseline LST after modelled cooling | °C | Equals baseline if no modelled estimate in new outputs |
| Roof priority/class | Screening category | Very High, High, Moderate, Low, Very Low | Thresholds ≥4.5 / ≥4.0 / ≥3.0 / ≥2.0 |
| Roof confidence | Certainty of roof screening source | Categorical | Not structural feasibility |

**Required scenario file coverage:** Balanced, Heat, Equity, Vegetation and Population × Scenario 1/2/3. Exact case-sensitive filenames are listed in [README.md](README.md). The older Balanced layers may omit fields found in the newer outputs.

**Interpretation:** Affected-cell count = cells with positive numerical modelled cooling. Average reduction per affected cell excludes unchanged/unassessed cells, and is not the mean across the whole LGA.

**Null values:** Null cooling indicates no modelled estimate under the threshold or incomplete data; do not interpret it as measured zero cooling. Any missing source values require review rather than automatic replacement for science claims.

**Provenance to retain per update:** owner, licence, original URL/provider, observation period, retrieval date, CRS, spatial coverage, field transformations, score thresholds, script or QGIS processing version and QA outcome.
