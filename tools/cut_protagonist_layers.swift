import AppKit
import CoreGraphics
import Foundation

struct Point {
    let x: Double
    let y: Double
}

struct Layer {
    let name: String
    let polygons: [[Point]]
}

func contains(_ point: Point, in polygon: [Point]) -> Bool {
    guard polygon.count > 2 else { return false }
    var inside = false
    var j = polygon.count - 1
    for i in 0..<polygon.count {
        let pi = polygon[i]
        let pj = polygon[j]
        let intersects = ((pi.y > point.y) != (pj.y > point.y))
            && (point.x < (pj.x - pi.x) * (point.y - pi.y) / ((pj.y - pi.y) == 0 ? 0.0001 : (pj.y - pi.y)) + pi.x)
        if intersects { inside.toggle() }
        j = i
    }
    return inside
}

func writePNG(_ pixels: [UInt8], width: Int, height: Int, to url: URL) throws {
    var mutable = pixels
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: &mutable,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let image = context.makeImage() else {
        throw NSError(domain: "LayerCutter", code: 1, userInfo: [NSLocalizedDescriptionKey: "Could not create output image"])
    }
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "LayerCutter", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not encode PNG"])
    }
    try data.write(to: url)
}

func writeClippedLayer(_ layer: Layer, image: CGImage, width: Int, height: Int, to url: URL) throws {
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(
        data: &pixels,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        throw NSError(domain: "LayerCutter", code: 3, userInfo: [NSLocalizedDescriptionKey: "Could not create clipped layer context"])
    }

    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()

    let path = CGMutablePath()
    for polygon in layer.polygons {
        guard let first = polygon.first else { continue }
        path.move(to: CGPoint(x: first.x, y: first.y))
        for point in polygon.dropFirst() {
            path.addLine(to: CGPoint(x: point.x, y: point.y))
        }
        path.closeSubpath()
    }

    context.addPath(path)
    context.clip()
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    context.restoreGState()

    try writePNG(pixels, width: width, height: height, to: url)
}

let args = CommandLine.arguments
guard args.count == 3 else {
    fputs("usage: swift tools/cut_protagonist_layers.swift <input.png> <output-dir>\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: args[1])
let outputURL = URL(fileURLWithPath: args[2])
try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

guard let image = NSImage(contentsOf: inputURL),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fputs("Could not load input image\n", stderr)
    exit(1)
}

let width = cgImage.width
let height = cgImage.height
var source = [UInt8](repeating: 0, count: width * height * 4)
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(
    data: &source,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("Could not create source context\n", stderr)
    exit(1)
}
context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

let layers: [Layer] = [
    Layer(name: "00_back_cloak", polygons: [[
        Point(x: 42, y: 98), Point(x: 196, y: 78), Point(x: 280, y: 135),
        Point(x: 286, y: 286), Point(x: 220, y: 450), Point(x: 72, y: 406),
        Point(x: 16, y: 252)
    ]]),
    Layer(name: "01_head_hood", polygons: [[
        Point(x: 224, y: 12), Point(x: 308, y: 22), Point(x: 338, y: 74),
        Point(x: 308, y: 128), Point(x: 226, y: 120), Point(x: 202, y: 62)
    ]]),
    Layer(name: "02_torso", polygons: [[
        Point(x: 214, y: 100), Point(x: 322, y: 116), Point(x: 348, y: 252),
        Point(x: 300, y: 318), Point(x: 214, y: 292), Point(x: 184, y: 186)
    ]]),
    Layer(name: "03_sword_arm", polygons: [[
        Point(x: 306, y: 134), Point(x: 358, y: 168), Point(x: 384, y: 250),
        Point(x: 354, y: 288), Point(x: 314, y: 228), Point(x: 284, y: 170)
    ]]),
    Layer(name: "04_off_arm", polygons: [[
        Point(x: 158, y: 132), Point(x: 226, y: 142), Point(x: 232, y: 244),
        Point(x: 188, y: 276), Point(x: 136, y: 206)
    ]]),
    Layer(name: "05_lantern", polygons: [[
        Point(x: 244, y: 202), Point(x: 300, y: 206), Point(x: 310, y: 284),
        Point(x: 260, y: 306), Point(x: 232, y: 254)
    ]]),
    Layer(name: "06_front_leg", polygons: [[
        Point(x: 298, y: 284), Point(x: 360, y: 300), Point(x: 412, y: 458),
        Point(x: 348, y: 486), Point(x: 292, y: 370)
    ]]),
    Layer(name: "07_back_leg", polygons: [[
        Point(x: 170, y: 274), Point(x: 244, y: 286), Point(x: 228, y: 424),
        Point(x: 174, y: 494), Point(x: 116, y: 438)
    ]]),
    Layer(name: "08_front_cloak_tails", polygons: [[
        Point(x: 122, y: 224), Point(x: 320, y: 250), Point(x: 346, y: 408),
        Point(x: 246, y: 488), Point(x: 78, y: 446), Point(x: 38, y: 322)
    ]]),
    Layer(name: "09_sword", polygons: [[
        Point(x: 250, y: 276), Point(x: 276, y: 264), Point(x: 446, y: 386),
        Point(x: 440, y: 402), Point(x: 254, y: 304)
    ]])
]

func sourceAlphaAt(_ offset: Int) -> UInt8 {
    source[offset + 3]
}

func looksLikeBackground(_ offset: Int) -> Bool {
    let r = Int(source[offset])
    let g = Int(source[offset + 1])
    let b = Int(source[offset + 2])
    return sourceAlphaAt(offset) < 8 || (r < 8 && g < 8 && b < 8)
}

var fullSubject = [UInt8](repeating: 0, count: width * height * 4)
for y in 0..<height {
    for x in 0..<width {
        let offset = (y * width + x) * 4
        if !looksLikeBackground(offset) {
            fullSubject[offset] = source[offset]
            fullSubject[offset + 1] = source[offset + 1]
            fullSubject[offset + 2] = source[offset + 2]
            fullSubject[offset + 3] = source[offset + 3]
        }
    }
}
try writePNG(fullSubject, width: width, height: height, to: outputURL.appendingPathComponent("full_subject_clean.png"))

for layer in layers {
    try writeClippedLayer(layer, image: cgImage, width: width, height: height, to: outputURL.appendingPathComponent("\(layer.name).png"))
}

print("Wrote \(layers.count + 1) PNGs to \(outputURL.path)")
