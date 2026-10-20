"""QGIS 3.x Python Console batch processor for pre-selected candidate rooftop files.

Historic project workflow archived for handover. NOT a complete end-to-end
data-refresh pipeline. Requires saved EPSG:7899 roof selections and loaded,
complete EPSG:7899 baseline grid with unique id and LST_mean.
Run in QGIS Python Console's Editor using the 'Run Script' button.
"""
from pathlib import Path
from qgis.core import (
    QgsProject, QgsVectorLayer, QgsField, QgsFeature, QgsGeometry,
    QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsVectorFileWriter
)
from qgis.PyQt.QtCore import QVariant
from qgis.PyQt.QtWidgets import QFileDialog, QInputDialog
import processing

AREA_PER_CELL = 62500.0
candidates = [
    lyr for lyr in QgsProject.instance().mapLayers().values()
    if isinstance(lyr, QgsVectorLayer) and lyr.isValid()
    and {"id", "LST_mean"}.issubset(lyr.fields().names())
]
if not candidates:
    raise ValueError("Load a complete baseline 250 m grid with id and LST_mean")
labels = [f"{lyr.name()} ({lyr.featureCount()} cells; {lyr.crs().authid()})" for lyr in candidates]
choice, ok = QInputDialog.getItem(None, "Select baseline", "Complete baseline LST grid", labels, 0, False)
if not ok:
    raise RuntimeError("Cancelled")
grid = candidates[labels.index(choice)]
if grid.crs().authid() != "EPSG:7899":
    raise ValueError("Grid must use EPSG:7899")
paths, _ = QFileDialog.getOpenFileNames(
    None, "Select saved rooftop scenario selections", str(Path.home()),
    "Vector files (*.gpkg *.geojson *.json *.shp)"
)
if not paths:
    raise RuntimeError("No rooftop files selected")
folder = QFileDialog.getExistingDirectory(None, "Choose output folder", str(Path.home()))
if not folder:
    raise RuntimeError("No output folder selected")
base_rows = list(grid.getFeatures())
ids = [f["id"] for f in base_rows]
if any(i is None for i in ids) or len(ids) != len(set(ids)):
    raise ValueError("Grid id must be unique and non-null")
for count, path in enumerate(paths, 1):
    source = QgsVectorLayer(path, Path(path).stem, "ogr")
    if not source.isValid() or source.crs().authid() != "EPSG:7899":
        raise ValueError(f"Invalid roof layer or CRS: {path}")
    fixed = processing.run("native:fixgeometries", {"INPUT": source, "OUTPUT": "memory:"})["OUTPUT"]
    dissolved = processing.run("native:dissolve", {
        "INPUT": fixed, "FIELD": [], "SEPARATE_DISJOINT": False, "OUTPUT": "memory:"
    })["OUTPUT"]
    pieces = processing.run("native:intersection", {
        "INPUT": grid, "OVERLAY": dissolved,
        "INPUT_FIELDS": ["id"], "OVERLAY_FIELDS": [],
        "OVERLAY_FIELDS_PREFIX": "roof_", "OUTPUT": "memory:"
    })["OUTPUT"]
    areas = dict.fromkeys(ids, 0.0)
    for part in pieces.getFeatures():
        if part.hasGeometry() and part["id"] in areas:
            areas[part["id"]] += part.geometry().area()
    result = QgsVectorLayer("MultiPolygon?crs=EPSG:7899", "modelled_cooling", "memory")
    provider = result.dataProvider()
    provider.addAttributes([
        QgsField("id", QVariant.LongLong), QgsField("LST_mean", QVariant.Double),
        QgsField("gr_area_sum", QVariant.Double), QgsField("gr_percentage", QVariant.Double),
        QgsField("cooling_C", QVariant.Double), QgsField("scenario_LST", QVariant.Double)
    ])
    result.updateFields()
    output_rows = []
    excessive = 0
    for base in base_rows:
        area = areas[base["id"]]
        pct = area / AREA_PER_CELL * 100
        excessive += pct > 100.001
        cooling = None if pct < 30 else (1.0 + (pct - 30) * (2.8/60) if pct <= 90 else 3.8)
        try:
            lst = float(base["LST_mean"])
        except (TypeError, ValueError):
            lst = None
        if lst is not None and (lst != lst):
            lst = None
        after = lst - cooling if lst is not None and cooling is not None else lst
        f = QgsFeature(result.fields())
        geometry = QgsGeometry(base.geometry())
        if not geometry.isMultipart():
            geometry.convertToMultiType()
        f.setGeometry(geometry)
        f.setAttributes([int(base["id"]), lst, area, pct, cooling, after])
        output_rows.append(f)
    provider.addFeatures(output_rows)
    result.updateExtents()
    output_path = str(Path(folder) / (Path(path).stem + "_cooling.geojson"))
    opts = QgsVectorFileWriter.SaveVectorOptions()
    opts.driverName = "GeoJSON"
    opts.fileEncoding = "UTF-8"
    opts.ct = QgsCoordinateTransform(
        QgsCoordinateReferenceSystem("EPSG:7899"),
        QgsCoordinateReferenceSystem("EPSG:4326"),
        QgsProject.instance()
    )
    written = QgsVectorFileWriter.writeAsVectorFormatV3(
        result, output_path, QgsProject.instance().transformContext(), opts
    )
    if written[0] != QgsVectorFileWriter.NoError:
        raise RuntimeError(f"Export failed: {output_path}: {written}")
    print(f"[{count}/{len(paths)}] {output_path}; cells={len(output_rows)}, over-100%={excessive}")
print("Finished. Validate generated outputs before replacing published files.")
