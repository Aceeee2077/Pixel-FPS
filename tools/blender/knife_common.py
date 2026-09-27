"""Original low-poly knife geometry helpers. Blender 4.x, metres, +Y blade-forward."""
import bpy
import math


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def collection_root(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def outline(name, points, thickness, material, parent=None, bevel=0.004):
    n = len(points)
    verts = [(x, y, z) for z in (-thickness / 2, thickness / 2) for x, y in points]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name="BladeUV")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index]
            uv.data[loop_index].uv = (vertex.co.x + .5, (vertex.co.y + .65) / 1.4)
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    if bevel:
        mod = ob.modifiers.new("Forged edge bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        normal = ob.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return ob


def block(name, location, dimensions, material, parent=None, bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    ob = bpy.context.object
    ob.name = name
    ob.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    if bevel:
        mod = ob.modifiers.new("Machined bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        ob.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return ob


def screw(name, x, y, radius, material, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=0.006, location=(x, y, 0))
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    return ob


def ring(name, x, y, major, minor, material, parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=10,
        location=(x, y, 0), major_radius=major, minor_radius=minor)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(material)
    if parent:
        ob.parent = parent
    return ob


def pivot(name, x, y, parent):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    ob.location = (x, y, 0)
    ob.parent = parent
    return ob


def parent_keep(child, parent):
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


