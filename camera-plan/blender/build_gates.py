"""Build the 3 barrier/LPR gates of Land & Houses Park Korat in Blender, from the same design as 3d.html.

Run headless (Blender 4.2+ or the `bpy` module):
    blender -b -P build_gates.py -- --out ./out [--samples 48] [--res 1600 900]
    python  build_gates.py --out ./out            # with `pip install bpy`

Output per gate: G1.blend, G1_overview.png, G1_lpr_view.png (and the same for G2, G3).
Units are metres. x = along the road (IN cars drive +x), y = across (IN lane on the -y side, Thai left-hand traffic), z = up.
Dimensions are the current estimates; change DIM below after measuring on site.
"""
import argparse, math, os, sys

import bpy
from mathutils import Vector

DIM = {"kerbW": 7.0, "laneW": 3.5, "islandW": 3.0}  # G2/G3 road width; G1 lane and island/booth width
GATES = {
    "G1": ("island", "G1 front gate - booth in the middle of the road, barriers on the booth"),
    "G2": ("kerb", "G2 back gate (south of Soi 4) - roadside barriers facing each other"),
    "G3": ("kerb", "G3 back gate (north of Soi 4) - roadside barriers facing each other"),
}
VAS_RED, VAS_NAVY = (0.93, 0.11, 0.14), (0.16, 0.22, 0.57)


def layout(kind):
    """Same geometry rules as the web model: arm tips meet on one line with a 5 cm gap."""
    if kind == "kerb":
        W = DIM["kerbW"]; h = W / 2; c = h + 0.25
        return dict(kind=kind, inY=-h / 2, outY=h / 2, half=h, island=False, cabIn=(0, -c), cabOut=(0, c),
                    dirIn=1, dirOut=-1, outX=0, arm=c - 0.05,
                    lprIn=(0.6, -(c + 0.25), 1.3), chkIn=(1.0, -(c + 0.65), 2.8),
                    lprOut=(-0.6, c + 0.25, 1.3), chkOut=(-1.0, c + 0.65, 2.8), house=-(c + 2.25))
    Lw = DIM["laneW"]; ih = DIM["islandW"] / 2; c = ih - 0.15
    return dict(kind=kind, inY=-(ih + Lw / 2), outY=ih + Lw / 2, half=ih + Lw, island=True, ih=ih, cabIn=(-0.5, -c),
                cabOut=(2.5, c), dirIn=-1, dirOut=1, outX=2.5, arm=Lw + 0.15 - 0.05,
                lprIn=(-0.95, -(ih - 0.35), 1.3), chkIn=(-0.45, -(ih - 0.25), 2.8),
                lprOut=(2.95, ih - 0.35, 1.3), chkOut=(2.45, ih - 0.25, 2.8), booth=True)


# ---------- helpers ----------
_mats = {}
def mat(name, rgb, rough=0.7, emit=0.0):
    key = (name, rgb, rough, emit)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name)
    if bpy.app.version < (5, 0): m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    if emit:
        b.inputs["Emission Color"].default_value = (*rgb, 1); b.inputs["Emission Strength"].default_value = emit
    _mats[key] = m; return m

def box(name, size, loc, rgb, rough=0.7, parent=None, rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    if rot: o.rotation_euler = rot
    o.data.materials.append(mat(name + "_m", rgb, rough))
    if parent: o.parent = parent
    return o

def cyl(name, r, depth, loc, rgb, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=24)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(mat(name + "_m", rgb, 0.5)); return o

def text(body, loc, size=0.35, rgb=(0.05, 0.05, 0.05), rot=(math.radians(90), 0, 0), align="CENTER", emit=0.0):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    o = bpy.context.active_object; o.data.body = body; o.data.size = size; o.data.align_x = align
    o.data.extrude = 0.005; o.data.materials.append(mat("txt_%s" % (rgb,), rgb, 0.5, emit)); return o

def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def barrier(name, x, y, z0, direction, arm_len):
    """VAS117-style cabinet with a red/white arm. Returns the arm pivot (rotate X to lift)."""
    box(name + "_cab", (0.38, 0.32, 1.0), (x, y, z0 + 0.5), (0.93, 0.94, 0.95), 0.4)
    box(name + "_top", (0.39, 0.33, 0.12), (x, y, z0 + 0.86), VAS_RED, 0.4)
    text("VAS117", (x - 0.2, y, z0 + 0.82), 0.07, (1, 1, 1), rot=(math.radians(90), 0, math.radians(-90)))
    bpy.ops.object.empty_add(location=(x, y, z0 + 0.75)); piv = bpy.context.active_object; piv.name = name + "_pivot"
    n = max(1, round(arm_len / 0.5)); seg = arm_len / n
    for i in range(n):
        o = box("%s_arm%d" % (name, i), (0.07, seg, 0.07), (x, y + direction * (seg / 2 + i * seg), z0 + 0.75),
                (1, 1, 1) if i % 2 else (0.85, 0.12, 0.12), 0.4)
        o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    return piv

def camera_rig(name, pos, target, colour):
    x, y, h = pos
    cyl(name + "_pole", 0.04, h, (x, y, h / 2), (0.42, 0.45, 0.47))
    b = box(name + "_body", (0.12, 0.26, 0.1), (x, y, h + 0.08), (0.96, 0.97, 0.97), 0.3)
    d = Vector(target) - Vector((x, y, h + 0.08)); b.rotation_euler = (0, 0, math.atan2(d.y, d.x) + math.pi / 2)
    text(name, (x, y, h + 0.45), 0.18, colour, emit=0.5)

def car(name, x, y, heading, rgb, plate):
    bpy.ops.object.empty_add(location=(x, y, 0)); root = bpy.context.active_object; root.name = name
    root.rotation_euler = (0, 0, heading)
    parts = [box(name + "_body", (4.4, 1.8, 0.7), (0, 0, 0.55), rgb, 0.3),
             box(name + "_cabin", (2.4, 1.6, 0.6), (-0.2, 0, 1.15), rgb, 0.3),
             box(name + "_glass", (2.2, 1.62, 0.5), (-0.2, 0, 1.17), (0.08, 0.12, 0.15), 0.05),
             box(name + "_plate", (0.01, 0.34, 0.15), (2.205, 0, 0.5), (1, 1, 1), 0.5)]
    for wx, wy in ((1.4, 0.85), (1.4, -0.85), (-1.4, 0.85), (-1.4, -0.85)):
        parts.append(cyl(name + "_w", 0.33, 0.22, (wx, wy, 0.33), (0.06, 0.06, 0.07), rot=(math.radians(90), 0, 0)))
    parts.append(text(plate, (2.215, 0, 0.47), 0.07, rot=(math.radians(90), 0, math.radians(90))))
    for p in parts:
        p.location = Vector(p.location); p.parent = root
    return root


def build(gate):
    kind, title = GATES[gate]
    L = layout(kind)
    bpy.ops.wm.read_factory_settings(use_empty=True); _mats.clear()
    sc = bpy.context.scene
    # ground, road, island/centre line, kerbs, walls
    box("ground", (120, 60, 0.02), (0, 0, -0.01), (0.42, 0.55, 0.33), 0.95)
    box("road", (80, 2 * L["half"], 0.02), (0, 0, 0.0), (0.2, 0.21, 0.22), 0.85)
    if L["island"]:
        box("island", (80, 2 * L["ih"], 0.15), (0, 0, 0.075), (0.72, 0.74, 0.72), 0.9)
    else:
        for x in range(-38, 38, 3):
            box("cl", (1.6, 0.12, 0.005), (x, 0, 0.012), (0.95, 0.8, 0.2), 0.6)
    for s in (1, -1):
        box("kerb", (80, 0.2, 0.18), (0, s * (L["half"] + 0.1), 0.09), (0.86, 0.87, 0.86))
        box("wall", (30, 0.25, 2.0), (-20, s * (L["half"] + 4.5), 1.0), (0.85, 0.82, 0.76))
    lane = DIM["laneW"] if L["island"] else DIM["kerbW"] / 2
    box("stop_in", (0.4, lane, 0.006), (L["cabIn"][0] - 0.6, L["inY"], 0.013), (1, 1, 1))
    box("stop_out", (0.4, lane, 0.006), (L["outX"] + 0.6, L["outY"], 0.013), (1, 1, 1))
    zone = box("lpr_capture_zone", (2, 3.3, 0.004), (L["cabIn"][0] - 5, L["inY"], 0.02), (1.0, 0.85, 0.0))

    z0 = 0.15 if L["island"] else 0.0
    arm_in = barrier("barrier_in", *L["cabIn"], z0, L["dirIn"], L["arm"])
    arm_out = barrier("barrier_out", *L["cabOut"], z0, L["dirOut"], L["arm"])
    arm_in.rotation_euler.x = -L["dirIn"] * math.radians(85) * 0      # closed (set to 85° to show it open)
    arm_out.rotation_euler.x = 0

    if L.get("booth"):
        box("booth", (2.4, 2.4, 2.5), (1.0, 0, 1.4), (0.91, 0.89, 0.85))
        box("booth_roof", (2.9, 2.9, 0.15), (1.0, 0, 2.72), (0.48, 0.43, 0.38))
        box("booth_win_a", (0.05, 1.4, 0.9), (-0.22, 0, 1.6), (0.56, 0.71, 0.79), 0.05)
        box("booth_win_b", (0.05, 1.4, 0.9), (2.22, 0, 1.6), (0.56, 0.71, 0.79), 0.05)
        box("poe_cabinet", (0.4, 0.22, 0.6), (1.0, -1.33, 0.6), (0.05, 0.42, 0.36))
    else:
        hy = L["house"] - 1.2
        box("guardhouse", (3, 2.4, 2.6), (2.2, hy, 1.3), (0.91, 0.89, 0.85))
        box("guardhouse_roof", (3.4, 2.8, 0.15), (2.2, hy, 2.68), (0.48, 0.43, 0.38))
        box("poe_cabinet", (0.5, 0.25, 0.7), (4.2, L["house"] + 0.4, 0.8), (0.05, 0.42, 0.36))

    # company sign (VAS colours)
    sy, sxp = -(L["half"] + 2.5), -16  # sign beside the approach road, clear of the camera view
    for px in (-1.1, 1.1):
        cyl("sign_post", 0.05, 2.4, (sxp + px, sy, 1.2), (0.48, 0.51, 0.53))
    box("sign_board", (2.6, 0.08, 1.1), (sxp, sy, 2.6), VAS_NAVY, 0.4)
    box("sign_stripe", (2.6, 0.085, 0.16), (sxp, sy, 2.13), VAS_RED, 0.4)
    text("VAS", (sxp, sy - 0.06, 2.62), 0.42, (1, 1, 1), emit=0.3)
    text("Barrier + LPR", (sxp, sy - 0.06, 2.3), 0.16, (1, 1, 1), emit=0.3)

    # cameras
    bx = L["cabIn"][0]
    t_lpr_in = (bx - 5.5, L["inY"], 0.5); t_chk_in = (bx - 6, L["inY"], 1.0)
    t_lpr_out = (L["outX"] + 5.5, L["outY"], 0.5); t_chk_out = (L["outX"] + 6.25, L["outY"], 1.0)
    camera_rig("LPR-IN", L["lprIn"], t_lpr_in, VAS_RED); camera_rig("CHK-IN", L["chkIn"], t_chk_in, VAS_NAVY)
    camera_rig("LPR-OUT", L["lprOut"], t_lpr_out, VAS_RED); camera_rig("CHK-OUT", L["chkOut"], t_chk_out, VAS_NAVY)

    # cars waiting at the capture point
    car("car_in", bx - 5 - 2.2, L["inY"], 0, (0.72, 0.77, 0.8), "KK 1234")
    car("car_out", L["outX"] + 5 + 2.2, L["outY"], math.pi, (0.54, 0.17, 0.17), "1KK 999")

    # dimension annotations
    R2 = 2 * L["half"]
    box("dim_line", (0.05, R2, 0.05), (-12, 0, 0.06), (0.05, 0.05, 0.05))
    text("Road %.1f m" % R2, (-12, -L["half"] - 0.6, 0.5), 0.3)
    text("Arm %.2f m x2" % L["arm"], (bx, L["cabIn"][1] + L["dirIn"] * L["arm"] / 2, 1.25), 0.2)

    # lighting and render setup
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 20)); sun = bpy.context.active_object
    sun.data.energy = 3.5; sun.rotation_euler = (math.radians(40), math.radians(15), math.radians(-30))
    world = bpy.data.worlds.new("sky"); sc.world = world
    if bpy.app.version < (5, 0): world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.62, 0.76, 0.88, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = ARGS.samples
    sc.render.resolution_x, sc.render.resolution_y = ARGS.res
    sc.render.image_settings.file_format = "PNG"
    sc.view_settings.view_transform = "Standard"

    # overview camera
    bpy.ops.object.camera_add(location=(-13, -17, 11)); cam = bpy.context.active_object; cam.name = "overview"
    cam.data.lens = 24; look_at(cam, (-1.5, 0, 0.3))
    # LPR-IN view: 4MP sensor, ~30° horizontal field of view
    eye = Vector((L["lprIn"][0], L["lprIn"][1], L["lprIn"][2] + 0.08)); eye += (Vector(t_lpr_in) - eye).normalized() * 0.3  # just in front of the lens
    bpy.ops.object.camera_add(location=eye); lpr = bpy.context.active_object
    lpr.name = "lpr_in_view"; lpr.data.sensor_fit = "HORIZONTAL"; lpr.data.angle = math.radians(30); look_at(lpr, t_lpr_in)

    os.makedirs(ARGS.out, exist_ok=True)
    text(title, (-8, L["half"] + 5, 2.6), 0.45, rot=(math.radians(90), 0, 0), align="CENTER")
    sc.camera = cam; sc.render.filepath = os.path.join(ARGS.out, gate + "_overview.png"); bpy.ops.render.render(write_still=True)
    sc.camera = lpr; sc.render.filepath = os.path.join(ARGS.out, gate + "_lpr_view.png"); bpy.ops.render.render(write_still=True)
    sc.camera = cam
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(ARGS.out, gate + ".blend")))
    print("built", gate, "arm %.2f m" % L["arm"], "road %.1f m" % R2)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="out"); p.add_argument("--samples", type=int, default=48)
    p.add_argument("--res", type=int, nargs=2, default=[1600, 900]); p.add_argument("--gates", nargs="*", default=list(GATES))
    ARGS = p.parse_args(argv)
    for g in ARGS.gates:
        build(g)
