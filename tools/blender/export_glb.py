"""Export one reusable geometry per knife family."""
from pathlib import Path
import bpy


def export_family(family, root):
    output = Path(__file__).resolve().parents[2] / "public" / "assets" / "weapons" / "knives" / family / (family + ".glb")
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB",
        use_selection=True, export_yup=True, export_animations=True)
    print("Exported", output)
    return output
