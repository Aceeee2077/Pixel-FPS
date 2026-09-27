"""Neutral export materials; runtime skin presets are applied in Three.js."""
import bpy


def pbr(name, color, metallic, roughness, coat=0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    return material


def palette():
    return {
        "blade": pbr("Blade_Polished_SkinSlot", (.42, .57, .53), .82, .23, .32),
        "grip": pbr("Grip_Charcoal", (.025, .035, .037), .12, .72),
        "steel": pbr("Fittings_BrushedSteel", (.23, .29, .31), .86, .34),
        "inlay": pbr("Inlay_SkinSlot", (.17, .55, .42), .52, .25, .28),
    }
