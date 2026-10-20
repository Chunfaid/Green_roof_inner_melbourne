# Maintenance and handover

**System:** [Green Roof Implementation Support Map](https://chunfaid.github.io/Green_roof_inner_melbourne/)  
**Original project / QGIS working files:** [Google Drive archive](https://drive.google.com/drive/folders/1RLLwQCqrKRfBHzgTp6HNHYdhkORR0K4Q) (access depends on folder-sharing permissions)

## Status and ownership

This is a **published, reusable prototype**, not a live data service. Most spatial analysis is performed offline in QGIS/PyQGIS. GitHub Pages serves precomputed GeoJSON layers through a static Leaflet/JavaScript front end; selecting a map or scenario does not rerun GIS calculations.

| Responsibility | Current owner | Ownership required for long-term adoption |
| --- | --- | --- |
| Source inventory and data licensing | Original project author | Nominated GIS/data steward |
| Roof screening and baseline grid | Original project author | GIS analyst familiar with QGIS |
| Weighted scores and cooling outputs | Original project author | GIS/Python analyst |
| QA, sign-off and change log | Original project author | GIS team lead/reviewer distinct from processor |
| Web deployment, dependencies and access | GitHub repository maintainer | Web GIS owner / hosting administrator |

**No council, university unit or outside organisation has committed to ongoing maintenance.** An adopting organisation must confirm named owners, secure data access and agree on an update budget/schedule.

## Re-run triggers and scope

| Trigger | Actions needed | Suggested response |
| --- | --- | --- |
| New LST or NDVI raster/score layer | Review scoring, rebuild affected 250 m grid indicator, weighted priorities, rooftop priority and scenarios | Recompute before claiming results reflect the new observation period |
| New ABS population or SEIFA data | Update mesh-block/SEIFA spatial joins, recalculate grid scores and all affected downstream outputs | Recompute when relevant source releases are adopted |
| New footprints, roof-classification evidence, rooftop feasibility or solar panels | Re-screen polygons and confidence; recompute candidate rooftops and scenario roof-area intersections | Recompute before site screening/investment use |
| Different weights, 4.5/4.0/3.0 priority thresholds, or cooling curve | Version parameters; regenerate all affected scores/scenarios; compare with prior version | Recompute immediately after approved method change |
| Changed council boundaries or grid IDs | Rebuild and revalidate spatial joins, roof-to-grid relationships and outputs | **Full rebuild**, not just replacing the boundary GeoJSON |
| Missing/corrupted source file, failing load or broken application | Restore known-good dataset/version; validate and test live map | Fix before public use |
| No upstream change | Verify links, publication, dependencies and source availability | **Proposed review every six months**, not an automated schedule |

## Inventory and prerequisites

- Published repository data is in `data/`; the full dataset filenames and scenario matrix are in [README.md](README.md).
- Original, intermediate and QGIS project files are kept separately in the [Drive project archive](https://drive.google.com/drive/folders/1RLLwQCqrKRfBHzgTp6HNHYdhkORR0K4Q), subject to archive contents and access settings. **Do not assume GitHub contains every original source or project intermediate.**
- Local GIS processing: QGIS 3.x, its Python/PyQGIS environment, the original EPSG:7899 (GDA2020/Vicgrid) grid with unique `id`, and the original LST field `LST_mean`.
- Publish web-consumable layers as GeoJSON suitable for Leaflet (EPSG:4326); keep source CRS, transformation details and provenance in the archive.
- Static website: `index.html`, `style.css`, `app.js`; files must retain matching paths and field names.
- Record software versions, input releases, parameter values and data licences for each future rerun. Dependencies and GIS plugins may change.

## Actual rerun procedure

1. **Create a backup/release point** of the current `main` revision and the archived GIS inputs. Log the trigger, operator, source dates and approved parameter changes in [CHANGELOG.md](CHANGELOG.md).
2. **Inspect and refresh source data** (buildings/roof polygons, solar panels, SEIFA, population, NDVI, LST and study boundary). Reproject working layers to EPSG:7899 as needed. Verify unique grid IDs and matching spatial footprints.
3. **Rebuild the cooling-need grid**, combining the four indicator scores. Rebuild the Balanced score and, where relevant, the 40% focus / 20% remaining scores in `w_heat`, `w_equity`, `w_green`, `w_pop`. The exact input transformation/classification parameters must be checked against the original QGIS project; earlier parts used manual QGIS operations.
4. **Re-screen candidate roofs** with the updated footprint and roof evidence, apply solar-panel exclusions and retain confidence and `area_score` attributes. Rejoin grid scores to roof polygons, verify the roof-to-grid mapping, then calculate `p_F=(w_F+area_score)/2` for each focus (Balanced uses the original candidate-priority field).
5. **Rebuild scenarios** for each focus using cumulative thresholds: S1 score ≥4.5, S2 ≥4.0 and S3 ≥3.0. Fix geometries; dissolve selected roof polygons to eliminate overlaps; intersect with the nominal 250 m grid; sum projected roof area by grid `id`; and join to the **complete** temperature baseline grid. The additional-focus cooling scenarios were previously batch processed using PyQGIS; the available QGIS batch script is archived as [scripts/batch_greenroof_scenarios.py](scripts/batch_greenroof_scenarios.py). It accepts previously screened rooftop selections, **not raw source data**, and should be tested in the adopting QGIS version before operational use.
6. **Apply the established illustrative cooling model**: coverage = roof area / 62,500 m² ×100; `cooling_C` absent below 30% coverage; linearly 1.0–3.8 °C at 30–90%; capped at 3.8 °C above 90%. Do not label these as measured air temperatures.
7. **Export** all 15 cooling files (5 focuses × 3 scenarios), weighted priority layers, and candidate roofs to the existing filenames in `data/`. A file rename requires a matching `app.js` update.
8. **Run automated and manual QA** (below). Review changes against prior maps, especially areas with large differences or new missing data.
9. **Publish by reviewed Git commit** to `main`; confirm GitHub Pages deployment; manually open the site and test each focus, all scenarios, a rooftop selection, legends and metric cards on desktop/mobile.
10. **Document the release** in [CHANGELOG.md](CHANGELOG.md) with dates, source versions, script/processing method, checker, result counts, unexpected deviations, and a rollback commit.

## QA and acceptance

Run from the repo root after Python 3 installation:

```bash
python3 scripts/validate_outputs.py
```

This reads the 15 published scenario files, checks expected structure, numeric cooling fields, coverage/cooling consistency where fields exist, and verifies nondecreasing affected-cell counts from S1 to S3. It exits nonzero on errors. It is a **structural and arithmetic check**, not proof of physical model validity; legacy Balanced files may produce warnings where fields are missing.

Before sign-off, manually verify that: complete grids line up geographically; roof polygons do not overlap after dissolve; percentages are within 0–100%; no estimated cooling occurs below 30% coverage where coverage is available; all expected cells render; the five focuses and fifteen cases load; and the live site's numbers match validated data. Investigate discrepancies rather than editing outputs to make tests pass.

## Operational risks and sustainability

- **Partial automation**: original raster processing, roof classification and some QGIS steps are not a single reproducible pipeline. An adopting analyst needs the original project and domain knowledge, not only this repository.
- **Data limitations**: detailed roof geometry, confidence and DSM/LOD2 coverage differ by area; candidate screening must not be used as structural certification.
- **Static outputs**: GitHub Pages has no automatic refresh from Drive or upstream providers. A person must regenerate and commit updated files.
- **Availability/licensing**: Drive permissions and third-party source rights may restrict re-use. Verify these before public distribution.
- **Hosting/dependencies**: GitHub Pages, OpenStreetMap basemap tiles, browser interfaces and CDN Leaflet assets may change; keep a working copy and periodically test.
- **Continuity**: if the repository owner becomes unavailable, transfer repository access, archive permissions and written release ownership.

### Recovery / rollback

If the published map breaks, revert the latest data/code commit to the last validated Git revision and let Pages redeploy. Keep the original output files and compare a failed dataset's field names, coordinates and size with the previous known-good copy. Log the incident and subsequent fix in the change log.

## Minimum handover package

Repository source code and 15 published scenario outputs; README and this file; data dictionary; validation script and a saved validation result; latest QGIS working project and processing scripts in Drive; source provenance/licences; a named maintainer and alternate; a release/change log; and explicit access instructions for GitHub and Drive (do not publish credentials).

## Handover verification status (2026-10-20)

- **Batch script archived:** [scripts/batch_greenroof_scenarios.py](scripts/batch_greenroof_scenarios.py) is a reference PyQGIS script for the scenario stage. Earlier candidate-roof classification and weighted-score preprocessing remain partially manual and are not packaged as a one-click rerun.
- **QA script:** committed but a full run against all 15 repository datasets has **not been verified**; until the check completes on a machine with all data, status is **pending**. Run the command in this guide and save the terminal output in the release record.
- **Google Drive:** project archive link is provided, but anonymous folder listing/download **could not be verified** in this environment. The owner must test in a logged-out browser window and verify that all source/QGIS project files are actually present and shared appropriately.
- **Continuity owner:** the original project author / current repository owner is the interim maintainer. **No independent organisational successor or backup has accepted responsibility.** This is an adoption prerequisite, not something software can assign automatically.
