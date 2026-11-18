"""Fishbelly geometry service: measures a mesh and returns numbers.

It does NOT decide pass/fail. The rules live in packages/core (evaluateMeasurements),
so there is one rule set for the whole platform.

NOT YET RUN: written without trimesh/FastAPI available. Treat the wall-thickness
estimate in particular as a starting point to verify against known test meshes.

Run:  uvicorn main:app --reload --port 8000
Then set GEOMETRY_SERVICE_URL=http://localhost:8000 for the web app.
"""

import io

import numpy as np
import trimesh
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Fishbelly geometry")

MAX_MESH_CHARS = 50_000_000


class MeasureRequest(BaseModel):
    mesh: str
    format: str = "stl"


def _footprint(vertices: np.ndarray) -> float:
    """Largest horizontal extent (x or y) of a set of points."""
    spans = vertices[:, :2].max(axis=0) - vertices[:, :2].min(axis=0)
    return float(spans.max())


def _min_wall_thickness(mesh: trimesh.Trimesh, samples: int = 3000) -> float | None:
    """Rough minimum wall thickness: cast rays inward from surface samples.

    Uses the 1st percentile rather than the absolute minimum so a few bad rays
    at sharp edges don't dominate. Only meaningful on a watertight mesh.
    """
    if not mesh.is_watertight:
        return None
    points, faces = trimesh.sample.sample_surface(mesh, samples)
    thickness = trimesh.proximity.thickness(
        mesh, points, exterior=False, normals=mesh.face_normals[faces], method="ray"
    )
    thickness = thickness[np.isfinite(thickness) & (thickness > 0)]
    return float(np.percentile(thickness, 1)) if len(thickness) else None


@app.post("/measure")
def measure(req: MeasureRequest) -> dict:
    if req.format != "stl":
        raise HTTPException(400, "Only STL is supported so far.")
    if len(req.mesh) > MAX_MESH_CHARS:
        raise HTTPException(413, "Mesh too large.")
    try:
        mesh = trimesh.load(io.BytesIO(req.mesh.encode()), file_type="stl", force="mesh")
    except Exception as exc:  # trimesh raises many types on bad input
        raise HTTPException(400, f"Could not read mesh: {exc}") from exc
    if len(mesh.vertices) == 0:
        raise HTTPException(400, "Mesh is empty.")

    mesh.merge_vertices()
    z = mesh.vertices[:, 2]
    base = mesh.vertices[z <= z.min() + 0.01]  # the product stands on z = min, in mm
    return {
        "heightMm": float(z.max() - z.min()),
        "maxDiameterMm": _footprint(mesh.vertices),
        "baseDiameterMm": _footprint(base),
        "minWallThicknessMm": _min_wall_thickness(mesh),
        "watertight": bool(mesh.is_watertight),
        "components": int(mesh.body_count),  # 1 = nothing floating or loose
    }


@app.get("/health")
def health() -> dict:
    return {"ok": True}
