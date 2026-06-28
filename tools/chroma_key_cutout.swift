import AppKit
import Foundation

struct Options {
    var input = ""
    var output = ""
    var runtimeOutput: String?
    var runtimeWidth = 192
    var runtimeHeight = 320
    var maxSubjectWidth = 164.0
    var maxSubjectHeight = 300.0
    var threshold = 42
    var feather = 32
    var padding = 12
    var keyRed = 0
    var keyGreen = 255
    var keyBlue = 0
}

func value(after flag: String, in args: [String]) -> String? {
    guard let index = args.firstIndex(of: flag), index + 1 < args.count else { return nil }
    return args[index + 1]
}

func parseOptions() -> Options {
    let args = Array(CommandLine.arguments.dropFirst())
    var options = Options()
    options.input = value(after: "--input", in: args) ?? ""
    options.output = value(after: "--out", in: args) ?? ""
    options.runtimeOutput = value(after: "--runtime-out", in: args)
    if let value = value(after: "--runtime-width", in: args), let number = Int(value) { options.runtimeWidth = number }
    if let value = value(after: "--runtime-height", in: args), let number = Int(value) { options.runtimeHeight = number }
    if let value = value(after: "--max-subject-width", in: args), let number = Double(value) { options.maxSubjectWidth = number }
    if let value = value(after: "--max-subject-height", in: args), let number = Double(value) { options.maxSubjectHeight = number }
    if let value = value(after: "--threshold", in: args), let number = Int(value) { options.threshold = number }
    if let value = value(after: "--feather", in: args), let number = Int(value) { options.feather = number }
    if let value = value(after: "--padding", in: args), let number = Int(value) { options.padding = number }
    if let value = value(after: "--key-red", in: args), let number = Int(value) { options.keyRed = number }
    if let value = value(after: "--key-green", in: args), let number = Int(value) { options.keyGreen = number }
    if let value = value(after: "--key-blue", in: args), let number = Int(value) { options.keyBlue = number }
    return options
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

func loadBitmap(path: String) -> NSBitmapImageRep {
    guard
        let image = NSImage(contentsOfFile: path),
        let tiff = image.tiffRepresentation,
        let rep = NSBitmapImageRep(data: tiff)
    else {
        fail("Could not load image: \(path)")
    }
    return rep
}

func makeBitmap(width: Int, height: Int) -> NSBitmapImageRep {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: width * 4,
        bitsPerPixel: 32
    ) else {
        fail("Could not allocate bitmap \(width)x\(height)")
    }
    return rep
}

func alphaForPixel(red: Int, green: Int, blue: Int, keyRed: Int, keyGreen: Int, keyBlue: Int, threshold: Int, feather: Int) -> UInt8 {
    let dr = red - keyRed
    let dg = green - keyGreen
    let db = blue - keyBlue
    let distance = sqrt(Double(dr * dr + dg * dg + db * db))
    if distance <= Double(threshold) { return 0 }
    if distance >= Double(threshold + feather) { return 255 }
    let t = (distance - Double(threshold)) / Double(max(1, feather))
    return UInt8(max(0, min(255, Int(round(t * 255)))))
}

func writePNG(_ rep: NSBitmapImageRep, path: String) {
    guard let data = rep.representation(using: .png, properties: [:]) else {
        fail("Could not encode PNG: \(path)")
    }
    do {
        try data.write(to: URL(fileURLWithPath: path))
    } catch {
        fail("Could not write PNG \(path): \(error)")
    }
}

func processCutout(source: NSBitmapImageRep, options: Options) -> NSBitmapImageRep {
    let width = source.pixelsWide
    let height = source.pixelsHigh
    let out = makeBitmap(width: width, height: height)
    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for y in 0..<height {
        for x in 0..<width {
            guard let color = source.colorAt(x: x, y: y)?.usingColorSpace(.deviceRGB) else { continue }
            let red = max(0, min(255, Int(round(color.redComponent * 255))))
            let green = max(0, min(255, Int(round(color.greenComponent * 255))))
            let blue = max(0, min(255, Int(round(color.blueComponent * 255))))
            let alpha = alphaForPixel(red: red, green: green, blue: blue, keyRed: options.keyRed, keyGreen: options.keyGreen, keyBlue: options.keyBlue, threshold: options.threshold, feather: options.feather)
            var outRed = red
            var outGreen = green
            var outBlue = blue
            if alpha > 0 {
                if options.keyGreen > options.keyRed && options.keyGreen > options.keyBlue && outGreen > outRed + 18 && outGreen > outBlue + 18 {
                    outGreen = max(outRed, outBlue)
                } else if options.keyRed > options.keyGreen && options.keyBlue > options.keyGreen && outRed > outGreen + 18 && outBlue > outGreen + 18 {
                    let neutral = outGreen
                    outRed = min(outRed, max(neutral, outBlue / 2))
                    outBlue = min(outBlue, max(neutral, outRed / 2))
                }
            }
            if alpha > 8 {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
            out.setColor(NSColor(calibratedRed: CGFloat(outRed) / 255, green: CGFloat(outGreen) / 255, blue: CGFloat(outBlue) / 255, alpha: CGFloat(alpha) / 255), atX: x, y: y)
        }
    }

    if maxX < minX || maxY < minY {
        fail("No subject detected after chroma key")
    }

    return crop(rep: out, minX: max(0, minX - options.padding), minY: max(0, minY - options.padding), maxX: min(width - 1, maxX + options.padding), maxY: min(height - 1, maxY + options.padding))
}

func crop(rep: NSBitmapImageRep, minX: Int, minY: Int, maxX: Int, maxY: Int) -> NSBitmapImageRep {
    let width = maxX - minX + 1
    let height = maxY - minY + 1
    let out = makeBitmap(width: width, height: height)
    for y in 0..<height {
        for x in 0..<width {
            if let color = rep.colorAt(x: minX + x, y: minY + y) {
                out.setColor(color, atX: x, y: y)
            }
        }
    }
    return out
}

func makeRuntime(cutout: NSBitmapImageRep, options: Options) -> NSBitmapImageRep {
    let canvas = makeBitmap(width: options.runtimeWidth, height: options.runtimeHeight)
    let scale = min(options.maxSubjectWidth / Double(cutout.pixelsWide), options.maxSubjectHeight / Double(cutout.pixelsHigh))
    let targetWidth = max(1, Int(round(Double(cutout.pixelsWide) * scale)))
    let targetHeight = max(1, Int(round(Double(cutout.pixelsHigh) * scale)))

    let image = NSImage(size: NSSize(width: cutout.pixelsWide, height: cutout.pixelsHigh))
    image.addRepresentation(cutout)

    let outImage = NSImage(size: NSSize(width: options.runtimeWidth, height: options.runtimeHeight))
    outImage.lockFocus()
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: options.runtimeWidth, height: options.runtimeHeight).fill()
    let destX = (options.runtimeWidth - targetWidth) / 2
    let destY = 8
    image.draw(in: NSRect(x: destX, y: destY, width: targetWidth, height: targetHeight), from: NSRect(x: 0, y: 0, width: cutout.pixelsWide, height: cutout.pixelsHigh), operation: .sourceOver, fraction: 1.0)
    outImage.unlockFocus()

    guard let tiff = outImage.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff) else {
        fail("Could not create runtime bitmap")
    }
    return rep
}

let options = parseOptions()
if options.input.isEmpty || options.output.isEmpty {
    fail("Usage: swift tools/chroma_key_cutout.swift --input in.png --out full.png [--runtime-out runtime.png]")
}

let source = loadBitmap(path: options.input)
let cutout = processCutout(source: source, options: options)
writePNG(cutout, path: options.output)

if let runtimeOutput = options.runtimeOutput {
    let runtime = makeRuntime(cutout: cutout, options: options)
    writePNG(runtime, path: runtimeOutput)
}
