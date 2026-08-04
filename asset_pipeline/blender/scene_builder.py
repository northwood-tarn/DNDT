"""Build deterministic proxy geometry and render conditioning passes in Blender 4.x."""

import argparse
import json
import math
import os
import sys

try:
    import bpy
    from mathutils import Vector
except ImportError as exc:
    raise SystemExit("Run this script through Blender: blender --background --python ...") from exc


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--resolution-x", type=int, default=1920)
    parser.add_argument("--resolution-y", type=int, default=1080)
    raw = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return parser.parse_args(raw)


def cube(name, location, scale, material, object_index):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.pass_index = object_index
    return obj


def material(name, colour):
    value = bpy.data.materials.new(name)
    value.diffuse_color = (*colour, 1.0)
    return value


def wall_segments(plan, wall, doors, wall_material):
    dims = plan["room"]["dimensions"]
    thickness = plan["constants"]["wall_thickness"]
    width, length, height = dims["width"], dims["length"], dims["height"]
    horizontal = wall in ("north", "south")
    span = width if horizontal else length
    intervals = sorted([(door["position"] - door["dimensions"][0] / 2,
                         door["position"] + door["dimensions"][0] / 2,
                         door["dimensions"][2], door["id"]) for door in doors if door["wall"] == wall])
    cursor = 0.0
    segment_number = 0

    def add_segment(start, end, z, segment_height, suffix):
        nonlocal segment_number
        if end - start <= 1e-6 or segment_height <= 1e-6:
            return
        centre = (start + end) / 2
        if horizontal:
            location = (centre, length if wall == "north" else 0, z)
            scale = (end - start, thickness, segment_height)
        else:
            location = (width if wall == "east" else 0, centre, z)
            scale = (thickness, end - start, segment_height)
        cube(f"wall_{wall}_{suffix}_{segment_number}", location, scale, wall_material, 2)
        segment_number += 1

    for start, end, door_height, door_id in intervals:
        add_segment(cursor, start, height / 2, height, "side")
        add_segment(start, end, door_height + (height - door_height) / 2, height - door_height, f"lintel_{door_id}")
        cursor = end
    add_segment(cursor, span, height / 2, height, "side")


def point_camera(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def configure_outputs(scene, output):
    view_layer = scene.view_layers[0]
    view_layer.use_pass_z = True
    view_layer.use_pass_normal = True
    view_layer.use_pass_ambient_occlusion = True
    view_layer.use_pass_object_index = True
    scene.use_nodes = True
    nodes = scene.node_tree.nodes
    nodes.clear()
    render = nodes.new("CompositorNodeRLayers")

    def file_output(pass_name, socket_name, colour_mode="RGB", depth="16"):
        node = nodes.new("CompositorNodeOutputFile")
        node.name = f"output_{pass_name}"
        node.base_path = output
        node.file_slots[0].path = f"{pass_name}_"
        node.format.file_format = "PNG"
        node.format.color_mode = colour_mode
        node.format.color_depth = depth
        scene.node_tree.links.new(render.outputs[socket_name], node.inputs[0])

    file_output("beauty", "Image", "RGBA", "8")
    file_output("depth", "Depth", "BW", "16")
    file_output("normal", "Normal", "RGB", "16")
    file_output("ambient_occlusion", "AO", "BW", "16")
    file_output("segmentation", "IndexOB", "BW", "16")


def build(plan, output, resolution_x, resolution_y):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = resolution_x
    scene.render.resolution_y = resolution_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.025, 0.025)

    dims = plan["room"]["dimensions"]
    width, length, height = dims["width"], dims["length"], dims["height"]
    thickness = plan["constants"]["wall_thickness"]
    wall_mat = material("structure", (0.45, 0.47, 0.5))
    floor_mat = material("floor", (0.18, 0.2, 0.22))
    prop_mat = material("structural_props", (0.28, 0.34, 0.4))
    cube("floor", (width / 2, length / 2, -thickness / 2), (width, length, thickness), floor_mat, 1)
    cube("ceiling", (width / 2, length / 2, height + thickness / 2), (width, length, thickness), wall_mat, 3)
    for wall in ("north", "east", "south", "west"):
        wall_segments(plan, wall, plan["resolved"]["doors"], wall_mat)

    for prop in plan["resolved"]["props"]:
        x, y = prop["position"]["x"], prop["position"]["y"]
        sx, sy, sz = prop["dimensions"]
        obj = cube(prop["id"], (x, y, sz / 2), (sx, sy, sz), prop_mat, prop["segmentation_id"])
        obj.rotation_euler[2] = math.radians(prop["rotation_degrees"])

    camera_data = bpy.data.cameras.new("canonical_camera")
    camera_data.lens_unit = "FOV"
    camera_data.angle = math.radians(plan["resolved"]["camera"]["fov_degrees"])
    camera = bpy.data.objects.new("canonical_camera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = plan["resolved"]["camera"]["position"]
    point_camera(camera, plan["resolved"]["camera"]["target"])
    scene.camera = camera

    light_data = bpy.data.lights.new("canonical_main", "AREA")
    light_data.energy = plan["constants"]["lighting"]["main_illuminance_lux"]
    light_data.shape = "RECTANGLE"
    light_data.size = max(width, length) * 0.6
    light = bpy.data.objects.new("canonical_main", light_data)
    scene.collection.objects.link(light)
    light.location = (width / 2, length / 2, height - 0.1)
    light.rotation_euler = (0, 0, 0)

    os.makedirs(output, exist_ok=True)
    configure_outputs(scene, output)
    scene.render.filepath = os.path.join(output, "beauty.png")
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output, "scene.blend"))
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    args = arguments()
    with open(args.plan, "r", encoding="utf-8") as handle:
        build(json.load(handle), os.path.abspath(args.output), args.resolution_x, args.resolution_y)
