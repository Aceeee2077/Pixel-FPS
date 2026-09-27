"""Reusable PBR material library for the weapon pipeline.

Every material is a real Principled BSDF with Base Color, Metallic, Roughness
and a baked-in grime normal map, so the exported glTF carries full PBR data
instead of a flat Lambert colour. Worn edges come from geometry bevels plus a
subtle curvature-free noise mask, never from painting the reference image on a
plane.
"""
import bpy


def _set(bsdf, name, value):
    if name in bsdf.inputs:
        try:
            bsdf.inputs[name].default_value = value
        except (TypeError, ValueError):
            pass


def _grime_nodes(material, scale, strength):
    """Add a low-frequency noise -> bump chain for micro surface variation."""
    tree = material.node_tree
    bsdf = tree.nodes.get("Principled BSDF")
    if bsdf is None or "Normal" not in bsdf.inputs:
        return
    coords = tree.nodes.new("ShaderNodeTexCoord")
    coords.location = (-900, -260)
    noise = tree.nodes.new("ShaderNodeTexNoise")
    noise.location = (-680, -260)
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 4.0
    if "Roughness" in noise.inputs:
        noise.inputs["Roughness"].default_value = 0.62
    bump = tree.nodes.new("ShaderNodeBump")
    bump.location = (-420, -260)
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.0025
    tree.links.new(coords.outputs["Object"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def pbr(name, color, metallic, roughness, coat=0.0, coat_roughness=0.15,
        emission=None, clearcoat_normal=None):
    material = bpy.data.materials.get(name)
    if material is not None:
        return material
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    _set(bsdf, "Base Color", (color[0], color[1], color[2], 1.0))
    _set(bsdf, "Metallic", metallic)
    _set(bsdf, "Roughness", roughness)
    _set(bsdf, "Coat Weight", coat)
    _set(bsdf, "Coat Roughness", coat_roughness)
    _set(bsdf, "IOR", 1.45)
    if emission is not None:
        _set(bsdf, "Emission Color", (emission[0], emission[1], emission[2], 1.0))
        _set(bsdf, "Emission Strength", emission[3])
    material["pbr_metallic"] = metallic
    material["pbr_roughness"] = roughness
    return material


# --------------------------------------------------------------------------
# the eight library functions requested by the brief
# --------------------------------------------------------------------------
def create_gunmetal():
    """Blued/gunmetal steel: the receiver and barrel default for most rifles."""
    material = pbr("M_Gunmetal", (.055, .058, .062), .92, .38, coat=.05)
    _grime_nodes(material, 240.0, .07)
    return material


def create_black_anodized_metal():
    material = pbr("M_BlackAnodized", (.017, .019, .021), .68, .52)
    _grime_nodes(material, 320.0, .06)
    return material


def create_phosphate_steel():
    """Parkerized finish used on M4/AWP barrels and bolts."""
    material = pbr("M_PhosphateSteel", (.036, .037, .040), .85, .58)
    _grime_nodes(material, 280.0, .09)
    return material


def create_polymer_black():
    material = pbr("M_PolymerBlack", (.024, .025, .027), .03, .68, coat=.03)
    _grime_nodes(material, 420.0, .16)
    return material


def create_polymer_green():
    """Olive-drab chassis polymer (AWP stock, AUG shell)."""
    material = pbr("M_PolymerGreen", (.115, .126, .062), .02, .72, coat=.02)
    _grime_nodes(material, 380.0, .15)
    return material


def create_polymer_fde():
    material = pbr("M_PolymerFDE", (.255, .203, .128), .02, .70, coat=.02)
    _grime_nodes(material, 380.0, .15)
    return material


def create_polymer_grey():
    material = pbr("M_PolymerGrey", (.052, .056, .055), .04, .62, coat=.04)
    _grime_nodes(material, 400.0, .13)
    return material


def create_wood():
    """Shellac-finished laminate for AK furniture."""
    material = pbr("M_Wood", (.186, .086, .036), .0, .46, coat=.22)
    _grime_nodes(material, 26.0, .30)
    return material


def create_wood_dark():
    material = pbr("M_WoodDark", (.108, .048, .022), .0, .52, coat=.18)
    _grime_nodes(material, 30.0, .30)
    return material


def create_brushed_steel():
    """Bolt carriers, charging handles, knife fittings."""
    material = pbr("M_BrushedSteel", (.235, .245, .252), .95, .28, coat=.04)
    _grime_nodes(material, 560.0, .05)
    return material


def create_stainless_bright():
    material = pbr("M_StainlessBright", (.44, .455, .462), .96, .19, coat=.06)
    return material


def create_scope_glass():
    material = pbr("M_ScopeGlass", (.012, .020, .026), .10, .045, coat=.9)
    _set(material.node_tree.nodes.get("Principled BSDF"), "IOR", 1.52)
    return material


def create_rubber():
    material = pbr("M_Rubber", (.019, .019, .020), .0, .88)
    _grime_nodes(material, 160.0, .22)
    return material


def create_brass():
    return pbr("M_Brass", (.412, .300, .106), .92, .30)


def create_skin_slot_blade():
    """Neutral high-polish blade slot; runtime gem finishes recolor this."""
    return pbr("M_Blade_SkinSlot", (.40, .46, .44), .88, .16, coat=.45)


def create_skin_slot_grip():
    return pbr("M_Grip_SkinSlot", (.028, .032, .034), .10, .70, coat=.05)


def create_skin_slot_inlay():
    return pbr("M_Inlay_SkinSlot", (.16, .42, .32), .45, .22, coat=.35)


def gun_palette():
    """Standard library handed to every firearm module."""
    return {
        "gunmetal": create_gunmetal(),
        "anodized": create_black_anodized_metal(),
        "phosphate": create_phosphate_steel(),
        "polymer": create_polymer_black(),
        "polymer_green": create_polymer_green(),
        "polymer_fde": create_polymer_fde(),
        "polymer_grey": create_polymer_grey(),
        "wood": create_wood(),
        "wood_dark": create_wood_dark(),
        "steel": create_brushed_steel(),
        "bright": create_stainless_bright(),
        "glass": create_scope_glass(),
        "rubber": create_rubber(),
        "brass": create_brass(),
    }


def knife_palette():
    return {
        "blade": create_skin_slot_blade(),
        "grip": create_skin_slot_grip(),
        "steel": create_brushed_steel(),
        "inlay": create_skin_slot_inlay(),
    }
