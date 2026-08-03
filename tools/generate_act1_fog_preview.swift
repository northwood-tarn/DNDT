import AppKit
import CoreGraphics

let inputPath = "app/docs/layout_sketches/act_maps_v1/act_1_greyharbour.png"
let outputPath = "app/docs/layout_sketches/act_maps_v1/act_1_greyharbour_fog_preview_v2.png"

guard let image = NSImage(contentsOfFile: inputPath),
      let source = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fatalError("Could not load Act I map")
}

let width = source.width
let height = source.height
let bytesPerRow = width * 4
var pixels = [UInt8](repeating: 0, count: height * bytesPerRow)
let colorSpace = CGColorSpaceCreateDeviceRGB()
guard let context = CGContext(data: &pixels, width: width, height: height,
                              bitsPerComponent: 8, bytesPerRow: bytesPerRow,
                              space: colorSpace,
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fatalError("Could not create raster context")
}
context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))

func clamp(_ value: Double, _ low: Double = 0, _ high: Double = 1) -> Double {
    min(high, max(low, value))
}

func smoothstep(_ edge0: Double, _ edge1: Double, _ x: Double) -> Double {
    let t = clamp((x - edge0) / (edge1 - edge0))
    return t * t * (3 - 2 * t)
}

func ellipseReveal(_ x: Double, _ y: Double,
                   cx: Double, cy: Double, rx: Double, ry: Double) -> Double {
    let d = sqrt(pow((x-cx)/rx, 2) + pow((y-cy)/ry, 2))
    return 1 - smoothstep(0.64, 1.08, d)
}

func segmentReveal(_ x: Double, _ y: Double,
                   ax: Double, ay: Double, bx: Double, by: Double,
                   inner: Double, outer: Double) -> Double {
    let vx = bx-ax, vy = by-ay
    let wx = x-ax, wy = y-ay
    let t = clamp((wx*vx + wy*vy) / (vx*vx + vy*vy))
    let px = ax + t*vx, py = ay + t*vy
    let d = hypot(x-px, y-py)
    return 1 - smoothstep(inner, outer, d)
}

func hashNoise(_ x: Int, _ y: Int) -> Double {
    var n = UInt64(x &* 374761393 &+ y &* 668265263)
    n = (n ^ (n >> 13)) &* 1274126177
    return Double(n & 1023) / 1023.0
}

for y in 0..<height {
    for x in 0..<width {
        let fx = Double(x), fy = Double(y)

        // Known living harbour: clear at its heart, feathered along its coast and walls.
        let harbour = ellipseReveal(fx, fy, cx: 1000, cy: 690, rx: 590, ry: 285)

        // Known route westward, including the intermediary island and refinery silhouette.
        let causeway = segmentReveal(fx, fy, ax: 595, ay: 520, bx: 235, by: 350,
                                     inner: 52, outer: 150) * 0.82
        let refinery = ellipseReveal(fx, fy, cx: 205, cy: 345, rx: 230, ry: 180) * 0.76

        // Open water remains readable along both lower corners of the presentation.
        let lowerLeftSea = ellipseReveal(fx, fy, cx: 40, cy: 875, rx: 430, ry: 245) * 0.90
        let lowerRightSea = ellipseReveal(fx, fy, cx: 1640, cy: 875, rx: 500, ry: 255) * 0.90
        let reveal = max(max(harbour, max(causeway, refinery)), max(lowerLeftSea, lowerRightSea))

        // Large slow-moving fog shapes. Texture alters opacity only; geography stays intact.
        let waves = sin(fx * 0.011 + sin(fy * 0.017) * 1.8)
                  + sin(fy * 0.019 - fx * 0.004) * 0.7
                  + sin((fx + fy) * 0.006) * 0.45
        let grain = (hashNoise(x / 5, y / 5) - 0.5) * 0.10
        let fogTexture = clamp(0.86 + waves * 0.055 + grain, 0.68, 0.96)
        var fog = clamp(fogTexture * (1 - reveal))

        // The Necropolis is known as a looming boundary, not readable urban geography.
        // This deep veil is spatially limited so it cannot darken the refinery or lower seas.
        let cityHorizontal = smoothstep(390, 590, fx) * (1 - smoothstep(1430, 1660, fx))
        let cityVertical = 1 - smoothstep(300, 570, fy)
        let cityVeil = cityHorizontal * cityVertical
        fog = max(fog, (0.90 + cityVertical * 0.06) * cityVeil)

        let offset = y * bytesPerRow + x * 4
        let r = Double(pixels[offset])
        let g = Double(pixels[offset + 1])
        let b = Double(pixels[offset + 2])

        // Warm-black negative-ink fog, never a flat digital black.
        let fogR = 9.0 + 7.0 * (1 - fogTexture)
        let fogG = 8.0 + 6.0 * (1 - fogTexture)
        let fogB = 7.0 + 5.0 * (1 - fogTexture)
        pixels[offset]     = UInt8(clamp((r * (1-fog) + fogR * fog) / 255) * 255)
        pixels[offset + 1] = UInt8(clamp((g * (1-fog) + fogG * fog) / 255) * 255)
        pixels[offset + 2] = UInt8(clamp((b * (1-fog) + fogB * fog) / 255) * 255)
        pixels[offset + 3] = 255
    }
}

guard let result = context.makeImage() else { fatalError("Could not create output image") }
let rep = NSBitmapImageRep(cgImage: result)
guard let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("Could not encode output")
}
try png.write(to: URL(fileURLWithPath: outputPath))
print(outputPath)
