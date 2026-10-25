"""Cinematic, advertising-grade renders of the 3 barrier/LPR gates (Grand Opening set).

Same geometry rules as build_gates.py / 3d.html, rebuilt with realistic procedural materials,
golden-hour sky, bevelled hard-surface models, depth of field and 2.39:1 film framing.

    python cinematic.py --out ./cine [--samples 128] [--res 2048 858] [--gates G1 G2 G3] [--shots hero product aerial lpr]
    blender -b -P cinematic.py -- --out ./cine
"""
import argparse, math, os, random, sys

import bpy, bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_gates import DIM, GATES, layout  # noqa: E402  (shared design geometry)

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS_PLATE_PACK = ""
VAS_RED, VAS_NAVY = (0.80, 0.03, 0.04), (0.035, 0.06, 0.28)
THAI_FONT = "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf"
LATIN_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


# ---------------------------------------------------------------- textures drawn with PIL (signs, plates, banner)
def make_images(out):
    from PIL import Image, ImageDraw, ImageFont
    def font(path, size):
        for p in (path, THAI_FONT, LATIN_FONT):
            try: return ImageFont.truetype(p, size)
            except Exception: pass
        return ImageFont.load_default()
    imgs = {}
    def save(name, im):
        p = os.path.join(out, "_tex_" + name + ".png"); im.save(p); imgs[name] = p
    # company sign
    im = Image.new("RGB", (1200, 520), (9, 16, 72)); d = ImageDraw.Draw(im)
    d.rectangle([0, 440, 1200, 520], fill=(205, 10, 14))
    d.text((600, 150), "VAS", font=font(LATIN_FONT, 230), fill="white", anchor="mm")
    d.text((600, 345), "ระบบไม้กั้นอัจฉริยะ + กล้องอ่านป้ายทะเบียน", font=font(THAI_FONT, 62), fill="white", anchor="mm")
    d.text((600, 480), "SMART GATE · LPR · CCTV", font=font(LATIN_FONT, 44), fill="white", anchor="mm")
    save("sign", im)
    # grand opening banner
    im = Image.new("RGB", (2400, 420), (9, 16, 72)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 2400, 40], fill=(205, 10, 14)); d.rectangle([0, 380, 2400, 420], fill=(205, 10, 14))
    d.text((1200, 150), "GRAND OPENING", font=font(LATIN_FONT, 170), fill=(255, 214, 90), anchor="mm")
    d.text((1200, 310), "เปิดใช้งานระบบไม้กั้นอัจฉริยะ  ·  LAND & HOUSES PARK KORAT", font=font(THAI_FONT, 74), fill="white", anchor="mm")
    save("banner", im)
    # feather flag
    im = Image.new("RGB", (300, 1200), (9, 16, 72)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 300, 120], fill=(205, 10, 14))
    for i, ch in enumerate("VAS"):
        d.text((150, 330 + i * 230), ch, font=font(LATIN_FONT, 210), fill="white", anchor="mm")
    save("flag", im)
    # Thai licence plates. With --plate-pack (an Assetto Corsa/CSP "Thailand" plate style folder: bg.png, nm.png,
    # ThangLuang.ttf, number.ttf) follow that style's layout: 724x320, letters at (-205,-100) size 230,
    # number at (130,-45) size 150, province at (0,80) size 80, measured from the plate centre.
    pack = ARGS_PLATE_PACK
    for name, letters, number in (("plate_in", "กข", "1234"), ("plate_out", "1กก", "999")):
        if pack and os.path.exists(os.path.join(pack, "bg.png")):
            im = Image.open(os.path.join(pack, "bg.png")).convert("RGB").resize((724, 320)); d = ImageDraw.Draw(im)
            thai = os.path.join(pack, "ThangLuang.ttf"); num = os.path.join(pack, "number.ttf")
            if not (os.path.exists(num) and os.path.getsize(num) > 1000): num = LATIN_FONT
            cx, cy, ink = 362, 160, (15, 15, 15)
            d.text((cx - 205, cy - 100 + 30), letters, font=font(thai, 230), fill=ink, anchor="mm")
            d.text((cx + 130, cy - 45), number, font=font(num, 150), fill=ink, anchor="mm")
            d.text((cx, cy + 80), "นครราชสีมา", font=font(thai, 80), fill=ink, anchor="mm")
            save(name, im)
            nm = os.path.join(pack, "nm.png")
            if os.path.exists(nm): imgs["plate_normal"] = nm
        else:
            im = Image.new("RGB", (680, 300), "white"); d = ImageDraw.Draw(im)
            d.rectangle([6, 6, 674, 294], outline="black", width=10)
            d.text((340, 120), letters + " " + number, font=font(THAI_FONT, 150), fill="black", anchor="mm")
            d.text((340, 245), "นครราชสีมา", font=font(THAI_FONT, 70), fill="black", anchor="mm")
            save(name, im)
    # VAS117 label
    im = Image.new("RGB", (400, 140), (205, 10, 14)); d = ImageDraw.Draw(im)
    d.text((200, 70), "VAS117", font=font(LATIN_FONT, 96), fill="white", anchor="mm"); save("vas117", im)
    im = Image.new("RGB", (360, 120), (9, 16, 72)); d = ImageDraw.Draw(im)
    d.text((180, 60), "VAS · LPR", font=font(LATIN_FONT, 64), fill="white", anchor="mm"); save("vaslogo", im)
    return imgs


# ---------------------------------------------------------------- materials
MATS = {}
def _nt(m):
    nt = m.node_tree; return nt, nt.nodes, nt.links, nt.nodes["Principled BSDF"]

def M(name, base, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emit=0.0, emit_col=None, transmission=0.0, ior=1.45, alpha=1.0):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); nt, n, l, b = _nt(m)
    b.inputs["Base Color"].default_value = (*base, 1); b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal; b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough; b.inputs["IOR"].default_value = ior
    b.inputs["Transmission Weight"].default_value = transmission; b.inputs["Alpha"].default_value = alpha
    if emit:
        b.inputs["Emission Color"].default_value = (*(emit_col or base), 1); b.inputs["Emission Strength"].default_value = emit
    MATS[name] = m; return m

def textured(name, c1, c2, scale=8.0, rough=(0.6, 0.85), bump=0.25, fine=80.0, speckle=0.0, metal=0.0, coat=0.0):
    """Procedural surface: large-scale colour variation + fine bump (+ optional aggregate speckle)."""
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); nt, n, l, b = _nt(m)
    tc = n.new("ShaderNodeTexCoord")
    big = n.new("ShaderNodeTexNoise"); big.inputs["Scale"].default_value = scale; big.inputs["Detail"].default_value = 8
    l.new(tc.outputs["Object"], big.inputs["Vector"])
    ramp = n.new("ShaderNodeValToRGB"); l.new(big.outputs["Fac"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].position = 0.7; ramp.color_ramp.elements[1].color = (*c2, 1)
    col = ramp.outputs["Color"]
    if speckle:
        vor = n.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = speckle; l.new(tc.outputs["Object"], vor.inputs["Vector"])
        vr = n.new("ShaderNodeValToRGB"); l.new(vor.outputs["Distance"], vr.inputs["Fac"])
        vr.color_ramp.elements[0].position = 0.0; vr.color_ramp.elements[0].color = (1, 1, 1, 1)
        vr.color_ramp.elements[1].position = 0.12; vr.color_ramp.elements[1].color = (0, 0, 0, 1)
        mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "SCREEN"; mix.inputs["Factor"].default_value = 0.35
        l.new(col, mix.inputs[6]); l.new(vr.outputs["Color"], mix.inputs[7]); col = mix.outputs[2]
    l.new(col, b.inputs["Base Color"])
    fn = n.new("ShaderNodeTexNoise"); fn.inputs["Scale"].default_value = fine; fn.inputs["Detail"].default_value = 10
    l.new(tc.outputs["Object"], fn.inputs["Vector"])
    rr = n.new("ShaderNodeMapRange"); rr.inputs["To Min"].default_value, rr.inputs["To Max"].default_value = rough
    l.new(fn.outputs["Fac"], rr.inputs["Value"]); l.new(rr.outputs["Result"], b.inputs["Roughness"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.02
    l.new(fn.outputs["Fac"], bp.inputs["Height"]); l.new(bp.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Metallic"].default_value = metal; b.inputs["Coat Weight"].default_value = coat
    MATS[name] = m; return m

def image_mat(name, path, rough=0.4, emit=0.0, normal=None):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name); nt, n, l, b = _nt(m)
    tx = n.new("ShaderNodeTexImage"); tx.image = bpy.data.images.load(path)
    l.new(tx.outputs["Color"], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = rough
    if normal:  # embossed plate: tangent-space normal map from the plate pack
        nx = n.new("ShaderNodeTexImage"); nx.image = bpy.data.images.load(normal); nx.image.colorspace_settings.name = "Non-Color"
        nmn = n.new("ShaderNodeNormalMap"); nmn.inputs["Strength"].default_value = 1.0
        l.new(nx.outputs["Color"], nmn.inputs["Color"]); l.new(nmn.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Coat Weight"].default_value = 0.2
    if emit:
        l.new(tx.outputs["Color"], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = emit
    MATS[name] = m; return m

def car_paint(name, rgb):
    return M(name, rgb, rough=0.32, metal=0.55, coat=1.0, coat_rough=0.02)


# ---------------------------------------------------------------- geometry helpers
def _finish(o, mat, bevel=0.0, subsurf=0, smooth=True):
    if mat: o.data.materials.append(mat)
    if bevel:
        bm = o.modifiers.new("bevel", "BEVEL"); bm.width = bevel; bm.segments = 3; bm.limit_method = "ANGLE"
    if subsurf:
        sm = o.modifiers.new("sub", "SUBSURF"); sm.levels = sm.render_levels = subsurf
    if smooth:
        try: o.data.shade_smooth()
        except Exception: bpy.ops.object.shade_smooth()
        if bevel and not subsurf:
            try: bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
            except Exception: pass
    return o

def box(name, size, loc, mat=None, bevel=0.0, rot=None, parent=None, subsurf=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if rot: o.rotation_euler = rot
    _finish(o, mat, bevel, subsurf, smooth=bool(bevel or subsurf))
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=32, bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object; o.name = name
    _finish(o, mat, bevel, 0, smooth=True)
    if parent: o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted()
    return o

def plane(name, size, loc, mat, rot=(math.radians(90), 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True); o.data.materials.append(mat); return o

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------- assets
def barrier(name, x, y, z0, direction, arm_len, mats, lift_deg=0.0):
    """VAS117-style cabinet: bevelled powder-coated body, red cap, logo label, round striped arm."""
    box(name + "_plinth", (0.5, 0.44, 0.08), (x, y, z0 + 0.04), mats["concrete"], bevel=0.01)
    box(name + "_cab", (0.36, 0.30, 0.98), (x, y, z0 + 0.57), mats["powder_white"], bevel=0.025)
    box(name + "_cap", (0.38, 0.32, 0.12), (x, y, z0 + 1.08), mats["powder_red"], bevel=0.02)
    lab = plane(name + "_label", (0.26, 0.09), (x - 0.182, y, z0 + 0.9), mats["vas117"], rot=(math.radians(90), 0, math.radians(-90)))
    box(name + "_door_seam", (0.005, 0.22, 0.6), (x - 0.181, y, z0 + 0.45), mats["rubber"])
    bpy.ops.object.empty_add(location=(x, y, z0 + 0.86)); piv = bpy.context.active_object; piv.name = name + "_pivot"
    cyl(name + "_hub", 0.07, 0.36, (x, y, z0 + 0.86), mats["steel"], rot=(0, math.radians(90), 0), parent=piv)
    n = max(2, round(arm_len / 0.45)); seg = arm_len / n
    for i in range(n):
        cyl("%s_arm%d" % (name, i), 0.035, seg, (x, y + direction * (seg / 2 + i * seg + 0.05), z0 + 0.86),
            mats["arm_white"] if i % 2 else mats["arm_red"], rot=(math.radians(90), 0, 0), verts=24, parent=piv)
    cyl(name + "_tip", 0.04, 0.05, (x, y + direction * (arm_len + 0.07), z0 + 0.86), mats["rubber"], rot=(math.radians(90), 0, 0), parent=piv)
    piv.rotation_euler.x = -direction * math.radians(lift_deg)
    return piv

def lpr_camera(name, pos, target, mats, ir=True):
    """Bullet LPR camera with sunshield, bracket and IR ring on a steel pole."""
    x, y, h = pos
    cyl(name + "_pole", 0.045, h, (x, y, h / 2), mats["steel"])
    cyl(name + "_base", 0.12, 0.02, (x, y, 0.01), mats["steel"])
    bpy.ops.object.empty_add(location=(x, y, h + 0.1)); rig = bpy.context.active_object; rig.name = name + "_rig"
    d = Vector(target) - rig.location
    rig.rotation_euler = (0, math.atan2(-d.z, math.hypot(d.x, d.y)) * 0.6, math.atan2(d.y, d.x))
    origin = rig.location.copy()
    def part(o):  # keep the part's offset from the mount and let it turn with the mount
        loc = o.location - origin; o.parent = rig; o.matrix_parent_inverse.identity(); o.location = loc; return o
    box(name + "_arm", (0.14, 0.04, 0.04), (x - 0.05, y, h + 0.04), mats["steel_dark"], bevel=0.008)
    part(box(name + "_body", (0.30, 0.11, 0.10), (x + 0.1, y, h + 0.1), mats["powder_white"], bevel=0.02))
    part(box(name + "_shield", (0.36, 0.14, 0.012), (x + 0.12, y, h + 0.16), mats["powder_white"], bevel=0.004))
    part(cyl(name + "_lens", 0.034, 0.02, (x + 0.255, y, h + 0.1), mats["lens"], rot=(0, math.radians(90), 0)))
    part(cyl(name + "_bezel", 0.052, 0.012, (x + 0.252, y, h + 0.1), mats["steel_dark"], rot=(0, math.radians(90), 0)))
    for sgn in (1, -1):
        part(plane(name + "_logo", (0.12, 0.04), (x + 0.1, y + sgn * 0.0565, h + 0.1), mats["vaslogo"], rot=(math.radians(90), 0, 0 if sgn < 0 else math.pi)))
    if ir:
        for k in range(6):
            a = k / 6 * math.tau
            part(cyl(name + "_ir%d" % k, 0.007, 0.01, (x + 0.256, y + 0.046 * math.cos(a), h + 0.1 + 0.035 * math.sin(a)),
                     mats["ir"], rot=(0, math.radians(90), 0), verts=8))
    return rig

def car(name, x, y, heading, paint, plate_mat, mats, lights=True):
    bpy.ops.object.empty_add(location=(x, y, 0)); root = bpy.context.active_object; root.name = name
    def part(o): o.parent = root; return o
    body = box(name + "_body", (4.5, 1.82, 0.62), (0, 0, 0.62), paint, bevel=0.16, subsurf=1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.25, 0, 1.17)); cab = bpy.context.active_object; cab.name = name + "_cabin"
    cab.scale = (2.5, 1.6, 0.52); bpy.ops.object.transform_apply(scale=True)
    bm = bmesh.new(); bm.from_mesh(cab.data)
    for v in bm.verts:
        if v.co.z > 0: v.co.x = v.co.x * 0.68 - 0.08; v.co.y *= 0.9
    bm.to_mesh(cab.data); bm.free(); _finish(cab, mats["glass_dark"], bevel=0.08, subsurf=1)
    roof = box(name + "_roof", (1.55, 1.36, 0.05), (-0.33, 0, 1.44), paint, bevel=0.03)
    for wx in (1.45, -1.45):
        for wy in (0.86, -0.86):
            cyl(name + "_tyre", 0.34, 0.24, (wx, wy, 0.34), mats["rubber"], rot=(math.radians(90), 0, 0), bevel=0.05)
            cyl(name + "_rim", 0.22, 0.25, (wx, wy, 0.34), mats["chrome"], rot=(math.radians(90), 0, 0), verts=24)
    pl = plane(name + "_plate", (0.36, 0.16), (2.262, 0, 0.5), plate_mat, rot=(math.radians(90), 0, math.radians(90)))
    for sy in (0.62, -0.62):
        box(name + "_head", (0.04, 0.34, 0.11), (2.24, sy, 0.78), mats["headlight"] if lights else mats["chrome"], bevel=0.02)
        box(name + "_tail", (0.04, 0.3, 0.1), (-2.24, sy, 0.8), mats["taillight"], bevel=0.02)
    box(name + "_grille", (0.03, 0.8, 0.14), (2.245, 0, 0.66), mats["steel_dark"], bevel=0.01)
    for o in list(bpy.data.objects):
        if o.name.startswith(name + "_") and o.parent is None: o.parent = root
    root.rotation_euler = (0, 0, heading)
    if lights:
        for sy in (0.62, -0.62):
            bpy.ops.object.light_add(type="SPOT", location=(2.3, sy, 0.78)); sp = bpy.context.active_object
            sp.data.energy = 400; sp.data.spot_size = math.radians(55); sp.data.color = (1, 0.95, 0.85)
            sp.rotation_euler = (0, math.radians(95), 0); sp.parent = root
    return root

def bush(name, loc, r, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=loc); o = bpy.context.active_object; o.name = name
    o.scale = (1, 1, 0.75)
    tex = bpy.data.textures.new(name + "_t", "CLOUDS"); tex.noise_scale = 0.18; tex.noise_depth = 4
    dm = o.modifiers.new("disp", "DISPLACE"); dm.texture = tex; dm.strength = r * 0.6
    return _finish(o, mat, subsurf=1)

def tree(name, loc, mats, h=5.5):
    x, y = loc
    cyl(name + "_trunk", 0.14, h * 0.6, (x, y, h * 0.3), mats["bark"], verts=12)
    for k in range(9):
        a = random.uniform(0, math.tau); rr = random.uniform(0.3, 1.2)
        bush(name + "_crown%d" % k, (x + rr * math.cos(a), y + rr * math.sin(a), h * 0.6 + random.uniform(0, 1.6)),
             random.uniform(0.7, 1.15), mats["leaf"])

def street_lamp(name, x, y, mats, side):
    cyl(name + "_pole", 0.06, 6.5, (x, y, 3.25), mats["steel"], verts=16)
    box(name + "_armp", (0.08, 1.2, 0.08), (x, y - side * 0.6, 6.45), mats["steel"], bevel=0.01)
    box(name + "_head", (0.5, 0.25, 0.1), (x, y - side * 1.15, 6.4), mats["lamp"], bevel=0.02)
    bpy.ops.object.light_add(type="SPOT", location=(x, y - side * 1.15, 6.3)); sp = bpy.context.active_object
    sp.data.energy = 600; sp.data.spot_size = math.radians(110); sp.data.color = (1, 0.82, 0.55); sp.rotation_euler = (0, 0, 0)

def flag(name, x, y, mats):
    cyl(name + "_pole", 0.02, 3.6, (x, y, 1.8), mats["steel"], verts=12)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x + 0.33, y, 2.25), rotation=(math.radians(90), 0, 0))
    o = bpy.context.active_object; o.name = name; o.scale = (0.62, 2.4, 1); bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mats["flag"])
    sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = sub.render_levels = 3
    wave = o.modifiers.new("wave", "WAVE"); wave.height = 0.06; wave.width = 0.6; wave.narrowness = 1.2; wave.use_normal = True
    wave.time_offset = random.uniform(0, 30)


# ---------------------------------------------------------------- scene
def build(gate, imgs, args):
    kind, title = GATES[gate]
    L = layout(kind)
    bpy.ops.wm.read_factory_settings(use_empty=True); MATS.clear(); random.seed(7)
    sc = bpy.context.scene
    mats = {
        "asphalt": textured("asphalt", (0.035, 0.036, 0.04), (0.075, 0.075, 0.08), scale=2.5, rough=(0.78, 0.95), bump=0.35, fine=180, speckle=700),
        "concrete": textured("concrete", (0.42, 0.41, 0.39), (0.6, 0.59, 0.56), scale=3, rough=(0.7, 0.9), bump=0.3, fine=60),
        "kerb": textured("kerb", (0.55, 0.55, 0.53), (0.78, 0.78, 0.76), scale=5, rough=(0.65, 0.9), bump=0.25, fine=70),
        "wall": textured("wall", (0.72, 0.66, 0.56), (0.86, 0.82, 0.73), scale=1.2, rough=(0.75, 0.92), bump=0.12, fine=40),
        "grass": textured("grass", (0.05, 0.16, 0.025), (0.16, 0.3, 0.06), scale=1.5, rough=(0.8, 0.95), bump=0.6, fine=300),
        "paint_white": textured("paint_white", (0.7, 0.7, 0.68), (0.92, 0.92, 0.9), scale=20, rough=(0.45, 0.7), bump=0.1, fine=150),
        "paint_yellow": textured("paint_yellow", (0.62, 0.42, 0.04), (0.85, 0.6, 0.06), scale=20, rough=(0.45, 0.7), bump=0.1, fine=150),
        "zone": M("zone", (0.9, 0.62, 0.02), rough=0.55),
        "powder_white": M("powder_white", (0.86, 0.87, 0.88), rough=0.32, coat=0.35),
        "powder_red": M("powder_red", VAS_RED, rough=0.3, coat=0.6),
        "arm_white": M("arm_white", (0.9, 0.9, 0.9), rough=0.25, coat=0.5),
        "arm_red": M("arm_red", (0.75, 0.02, 0.03), rough=0.25, coat=0.5),
        "steel": M("steel", (0.62, 0.63, 0.65), rough=0.28, metal=1.0),
        "steel_dark": M("steel_dark", (0.12, 0.12, 0.13), rough=0.35, metal=0.8),
        "chrome": M("chrome", (0.8, 0.8, 0.82), rough=0.12, metal=1.0),
        "rubber": M("rubber", (0.02, 0.02, 0.022), rough=0.85),
        "lens": M("lens", (0.01, 0.01, 0.015), rough=0.02, coat=1.0),
        "ir": M("ir", (0.4, 0.0, 0.0), rough=0.3, emit=3.0, emit_col=(1.0, 0.05, 0.03)),
        "glass_dark": M("glass_dark", (0.02, 0.025, 0.03), rough=0.03, coat=1.0, metal=0.2),
        "glass": M("glass", (0.85, 0.9, 0.95), rough=0.02, transmission=1.0, ior=1.5),
        "headlight": M("headlight", (1, 0.97, 0.9), rough=0.1, emit=60.0),
        "taillight": M("taillight", (0.5, 0.0, 0.0), rough=0.2, emit=6.0, emit_col=(1, 0.02, 0.02)),
        "lamp": M("lamp", (1, 0.85, 0.6), rough=0.3, emit=40.0, emit_col=(1, 0.82, 0.55)),
        "roof": textured("roof", (0.18, 0.12, 0.09), (0.3, 0.2, 0.14), scale=6, rough=(0.6, 0.8), bump=0.4, fine=90),
        "booth_wall": textured("booth_wall", (0.83, 0.8, 0.74), (0.93, 0.91, 0.86), scale=2, rough=(0.6, 0.8), bump=0.08, fine=50),
        "interior": M("interior", (1, 0.85, 0.6), rough=0.8, emit=4.0, emit_col=(1, 0.8, 0.55)),
        "bark": textured("bark", (0.09, 0.06, 0.04), (0.18, 0.12, 0.08), scale=12, rough=(0.8, 0.95), bump=0.8, fine=60),
        "leaf": textured("leaf", (0.02, 0.09, 0.015), (0.1, 0.24, 0.04), scale=6, rough=(0.45, 0.7), bump=0.9, fine=120),
        "ribbon": M("ribbon", (0.75, 0.01, 0.03), rough=0.25, coat=0.4),
        "gold": M("gold", (0.95, 0.7, 0.25), rough=0.2, metal=1.0),
        "sign": image_mat("sign", imgs["sign"], rough=0.35, emit=0.6),
        "banner": image_mat("banner", imgs["banner"], rough=0.6, emit=0.3),
        "flag": image_mat("flagmat", imgs["flag"], rough=0.7),
        "plate_in": image_mat("plate_in", imgs["plate_in"], rough=0.35, normal=imgs.get("plate_normal")),
        "plate_out": image_mat("plate_out", imgs["plate_out"], rough=0.35, normal=imgs.get("plate_normal")),
        "vas117": image_mat("vas117", imgs["vas117"], rough=0.3),
        "vaslogo": image_mat("vaslogo", imgs["vaslogo"], rough=0.3),
    }

    half = L["half"]
    # ground and road surfaces
    box("ground", (160, 90, 0.2), (0, 0, -0.1), mats["grass"])
    box("road", (90, 2 * half, 0.04), (0, 0, 0.0), mats["asphalt"])
    if L["island"]:
        box("island", (90, 2 * L["ih"], 0.16), (0, 0, 0.08), mats["concrete"], bevel=0.03)
        for x in range(-44, 44, 2):
            box("island_curb_paint", (1.0, 0.04, 0.162), (x, L["ih"], 0.081), mats["paint_yellow"])
            box("island_curb_paint", (1.0, 0.04, 0.162), (x, -L["ih"], 0.081), mats["paint_yellow"])
    else:
        for x in range(-44, 44, 3):
            box("centre_line", (1.6, 0.12, 0.006), (x, 0, 0.023), mats["paint_yellow"])
    for s in (1, -1):
        box("kerb", (90, 0.22, 0.2), (0, s * (half + 0.11), 0.1), mats["kerb"], bevel=0.02)
        box("edge_line", (90, 0.1, 0.006), (0, s * (half - 0.2), 0.023), mats["paint_white"])
        box("footpath", (90, 1.6, 0.14), (0, s * (half + 1.02), 0.07), mats["concrete"], bevel=0.01)
        box("wall", (34, 0.22, 2.1), (-23, s * (half + 4.6), 1.05), mats["wall"], bevel=0.01)
        box("wall_cap", (34, 0.34, 0.08), (-23, s * (half + 4.6), 2.14), mats["concrete"], bevel=0.01)
        for px in range(-39, -6, 4):
            box("wall_pier", (0.4, 0.4, 2.3), (px, s * (half + 4.6), 1.15), mats["concrete"], bevel=0.02)
    lane = DIM["laneW"] if L["island"] else DIM["kerbW"] / 2
    box("stop_in", (0.4, lane - 0.3, 0.006), (L["cabIn"][0] - 0.7, L["inY"], 0.023), mats["paint_white"])
    box("stop_out", (0.4, lane - 0.3, 0.006), (L["outX"] + 0.7, L["outY"], 0.023), mats["paint_white"])
    for k in range(4):  # LPR capture zone chevrons
        box("zone_bar", (0.3, lane - 0.6, 0.006), (L["cabIn"][0] - 3.6 - k * 0.8, L["inY"], 0.023), mats["zone"])

    z0 = 0.16 if L["island"] else 0.0
    barrier("barrier_in", *L["cabIn"], z0, L["dirIn"], L["arm"], mats, lift_deg=args.lift)
    barrier("barrier_out", *L["cabOut"], z0, L["dirOut"], L["arm"], mats, lift_deg=0)

    # guardhouse
    if L.get("booth"):
        bx, by, bw = 1.0, 0.0, 2.4
    else:
        bx, by, bw = 2.4, L["house"] - 1.0, 2.6
    if gate != "G3":  # Street View: G3 has no guardhouse
        box("booth", (bw, bw * 0.95, 2.5), (bx, by, 1.35), mats["booth_wall"], bevel=0.03)
        box("booth_roof", (bw + 0.6, bw + 0.5, 0.16), (bx, by, 2.72), mats["roof"], bevel=0.03)
        box("booth_interior", (bw - 0.15, bw * 0.95 - 0.15, 2.3), (bx, by, 1.35), mats["interior"])
        for sx in (-1, 1):
            box("booth_glass", (0.04, bw * 0.6, 1.0), (bx + sx * bw / 2, by, 1.65), mats["glass"])
        bpy.ops.object.light_add(type="POINT", location=(bx, by, 2.2)); bpy.context.active_object.data.energy = 300
        bpy.context.active_object.data.color = (1, 0.8, 0.55)
    box("poe_cabinet", (0.42, 0.24, 0.62), (bx + bw / 2 + 0.4, by, 0.5), M("cab_green", (0.02, 0.32, 0.27), rough=0.35, coat=0.3), bevel=0.015)

    # cameras (LPR + vehicle check)
    bx0 = L["cabIn"][0]
    t_lpr_in = (bx0 - 5.5, L["inY"], 0.5); t_chk_in = (bx0 - 6, L["inY"], 1.0)
    t_lpr_out = (L["outX"] + 5.5, L["outY"], 0.5); t_chk_out = (L["outX"] + 6.25, L["outY"], 1.0)
    lpr_camera("LPR_IN", L["lprIn"], t_lpr_in, mats); lpr_camera("CHK_IN", L["chkIn"], t_chk_in, mats, ir=False)
    lpr_camera("LPR_OUT", L["lprOut"], t_lpr_out, mats); lpr_camera("CHK_OUT", L["chkOut"], t_chk_out, mats, ir=False)

    # grand-opening dressing: ribbon in front of the IN barrier, banner, feather flags, company sign
    rx = bx0 - 1.6
    for sy in (-1, 1):
        cyl("ribbon_post", 0.05, 1.1, (rx, L["inY"] + sy * (lane / 2 - 0.25), 0.55), mats["gold"], verts=16)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(rx, L["inY"] + sy * (lane / 2 - 0.25), 1.14))
        _finish(bpy.context.active_object, mats["gold"])
    box("ribbon", (0.012, lane - 0.5, 0.12), (rx, L["inY"], 1.0), mats["ribbon"])
    for sgn in (1, -1):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.03, location=(rx, L["inY"] + sgn * 0.12, 1.0), rotation=(0, math.radians(90), 0))
        _finish(bpy.context.active_object, mats["ribbon"])
    box("ribbon_tail", (0.012, 0.06, 0.4), (rx, L["inY"] + 0.05, 0.8), mats["ribbon"], rot=(math.radians(12), 0, 0))
    gy = half + 2.2
    for sy in (-1, 1):
        cyl("banner_post", 0.07, 4.6, (bx0 + 7, sy * gy, 2.3), mats["steel"], verts=16)
    plane("banner", (2 * gy - 0.4, 0.9), (bx0 + 7 - 0.03, 0, 4.2), mats["banner"], rot=(math.radians(90), 0, math.radians(-90)))
    plane("banner_back", (2 * gy - 0.4, 0.9), (bx0 + 7 + 0.03, 0, 4.2), mats["banner"], rot=(math.radians(90), 0, math.radians(90)))
    for k in range(4):
        flag("flag_%d" % k, bx0 - 9 - k * 2.6, -(half + 1.4), mats)
        flag("flagb_%d" % k, bx0 - 9 - k * 2.6, half + 1.4, mats)
    sy = -(half + 2.6); sxp = bx0 - 15
    for px in (-1.2, 1.2):
        cyl("sign_post", 0.06, 2.6, (sxp + px, sy, 1.3), mats["steel"], verts=16)
    box("sign_frame", (2.7, 0.1, 1.25), (sxp, sy, 2.75), mats["steel_dark"], bevel=0.02)
    plane("sign_face", (2.6, 1.13), (sxp, sy - 0.055, 2.75), mats["sign"], rot=(math.radians(90), 0, 0))

    # real grass blades on the verges near the camera (hair particles)
    if args.grass:
        for s in (1, -1):
            bpy.ops.mesh.primitive_plane_add(size=1, location=(bx0 - 8, s * (half + 3.0), 0.005))
            gp = bpy.context.active_object; gp.name = "grass_bed"; gp.scale = (40, 2.6, 1); bpy.ops.object.transform_apply(scale=True)
            gp.data.materials.append(mats["grass"]); gp.data.materials.append(M("blade", (0.08, 0.22, 0.04), rough=0.6))
            ps = gp.modifiers.new("grass", "PARTICLE_SYSTEM").particle_system.settings
            ps.type = "HAIR"; ps.count = args.grass; ps.hair_length = 0.13; ps.material = 2
            ps.use_advanced_hair = True; ps.brownian_factor = 0.03; ps.root_radius = 0.6; ps.tip_radius = 0.0
            ps.child_type = "INTERPOLATED"; ps.child_percent = 4; ps.rendered_child_count = 4; ps.roughness_2 = 0.08
    # environment: trees, bushes, street lamps
    for k, x in enumerate(range(-40, 20, 7)):
        for s in (1, -1):
            tree("tree_%d_%d" % (k, s), (x + random.uniform(-1, 1), s * (half + 7.5 + random.uniform(0, 3))), mats, h=random.uniform(4.5, 6.5))
            bush("bush_%d_%d" % (k, s), (x + 3, s * (half + 3.2), 0.35), random.uniform(0.45, 0.7), mats["leaf"])
    for x in (-26, -10, 8):
        street_lamp("lamp_%d" % x, x, -(half + 0.9), mats, -1)

    # cars at the capture point / leaving
    paints = {"G1": ((0.75, 0.76, 0.78), (0.25, 0.02, 0.03)), "G2": ((0.75, 0.76, 0.78), (0.25, 0.02, 0.03)),
              "G3": ((0.02, 0.02, 0.025), (0.55, 0.56, 0.6))}[gate]
    car("car_in", bx0 - 5 - 2.25, L["inY"], 0, car_paint("paint_in", paints[0]), mats["plate_in"], mats)
    car("car_out", L["outX"] + 7 + 2.25, L["outY"], math.pi, car_paint("paint_out", paints[1]), mats["plate_out"], mats)

    # lighting: golden-hour physical sky + warm sun
    world = bpy.data.worlds.new("sky"); sc.world = world; wn = world.node_tree.nodes; wl = world.node_tree.links
    sky = wn.new("ShaderNodeTexSky"); sky.sky_type = "MULTIPLE_SCATTERING" if args.sky == "ms" else "SINGLE_SCATTERING"
    sky.sun_elevation = math.radians(args.sun_elev); sky.sun_rotation = math.radians(args.sun_rot)
    sky.sun_intensity = 0.6
    wl.new(sky.outputs["Color"], wn["Background"].inputs["Color"]); wn["Background"].inputs["Strength"].default_value = args.sky_strength
    bpy.ops.object.light_add(type="SUN"); sun = bpy.context.active_object; sun.data.energy = args.sun_energy
    sun.data.color = (1.0, 0.78, 0.55); sun.data.angle = math.radians(1.2)
    sun.rotation_euler = (math.radians(90 - args.sun_elev), 0, math.radians(args.sun_rot + 90))

    # render settings: Cycles, denoise, AgX, 2.39:1
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = args.samples
    sc.cycles.use_denoising = True; sc.cycles.use_adaptive_sampling = True
    sc.cycles.max_bounces = 8; sc.cycles.caustics_reflective = sc.cycles.caustics_refractive = False
    sc.render.resolution_x, sc.render.resolution_y = args.res; sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    for vt in ("AgX", "Filmic", "Standard"):
        try: sc.view_settings.view_transform = vt; break
        except TypeError: continue
    for lk in ("AgX - Punchy", "Punchy", "Medium High Contrast"):
        try: sc.view_settings.look = lk; break
        except TypeError: continue
    sc.view_settings.exposure = args.exposure

    shots = {
        # name: (location, target, focal length mm, f-stop, focus target)
        "hero": ((bx0 + 6.5, L["inY"] - 0.9 * L["dirIn"] * 0 - (0.6 if kind == "kerb" else -0.4), 0.85), (bx0 - 6, L["inY"] + 0.3, 0.9), 28, 2.8, Vector((bx0, L["cabIn"][1], 1.0))),
        "product": ((L["lprIn"][0] - 1.7, L["lprIn"][1] + 0.75 * math.copysign(1, L["inY"] - L["lprIn"][1]), L["lprIn"][2] + 0.12),
                    (L["lprIn"][0] - 0.1, L["lprIn"][1], L["lprIn"][2] + 0.05), 85, 2.8,
                    Vector(L["lprIn"]) + Vector((0, 0, 0.1)) + (Vector(t_lpr_in) - Vector(L["lprIn"])).normalized() * 0.25),
        "aerial": ((bx0 - 16, -(half + 13), 11), (bx0 - 1.5, 0, 0.5), 30, 8.0, Vector((bx0, 0, 0.8))),
        "lpr": None,
    }
    os.makedirs(args.out, exist_ok=True)
    for shot in args.shots:
        if shot == "lpr":
            eye = Vector((L["lprIn"][0], L["lprIn"][1], L["lprIn"][2] + 0.1)); eye += (Vector(t_lpr_in) - eye).normalized() * 0.35
            bpy.ops.object.camera_add(location=eye); cam = bpy.context.active_object
            cam.data.sensor_fit = "HORIZONTAL"; cam.data.angle = math.radians(30); look_at(cam, t_lpr_in)
        else:
            loc, tgt, lens, fstop, focus = shots[shot]
            bpy.ops.object.camera_add(location=loc); cam = bpy.context.active_object; cam.data.lens = lens
            cam.data.sensor_width = 36; look_at(cam, tgt)
            cam.data.dof.use_dof = True; cam.data.dof.aperture_fstop = fstop
            cam.data.dof.focus_distance = (focus - cam.location).length
        cam.name = "cam_" + shot; sc.camera = cam
        for o in bpy.data.objects:  # the ceremonial ribbon would block the plate in the LPR camera view
            if o.name.startswith("ribbon") or (o.type == "MESH" and o.data.materials and o.data.materials[0].name in ("gold", "ribbon")):
                o.hide_render = (shot == "lpr")
        sc.render.filepath = os.path.join(args.out, "%s_%s.png" % (gate, shot))
        bpy.ops.render.render(write_still=True)
        print("rendered", gate, shot, flush=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(args.out, gate + "_cinematic.blend")))


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="cine"); p.add_argument("--samples", type=int, default=128)
    p.add_argument("--res", type=int, nargs=2, default=[2048, 858])
    p.add_argument("--gates", nargs="*", default=list(GATES)); p.add_argument("--shots", nargs="*", default=["hero", "product", "aerial", "lpr"])
    p.add_argument("--lift", type=float, default=0.0, help="IN arm lift angle for the hero shot (0 = closed with ribbon)")
    p.add_argument("--sun-elev", type=float, default=9.0); p.add_argument("--sun-rot", type=float, default=215.0)
    p.add_argument("--sun-energy", type=float, default=4.5); p.add_argument("--sky-strength", type=float, default=0.4)
    p.add_argument("--exposure", type=float, default=0.0); p.add_argument("--sky", default="ms")
    p.add_argument("--grass", type=int, default=60000, help="grass blades per verge (0 = off)")
    p.add_argument("--plate-pack", default="", help="folder of a CSP 'Thailand' number-plate style (bg.png, nm.png, fonts)")
    a = p.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    ARGS_PLATE_PACK = a.plate_pack
    images = make_images(a.out)
    for g in a.gates:
        build(g, images, a)
