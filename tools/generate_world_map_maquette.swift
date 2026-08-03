import AppKit

let canvasWidth = 1672
let canvasHeight = 941
let outputPath = CommandLine.arguments.dropFirst().first
    ?? "app/docs/layout_sketches/working images/world_map_maquette_v1.png"

struct RNG {
    var state: UInt64
    mutating func next() -> Double {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Double(state >> 11) / Double(UInt64.max >> 11)
    }
    mutating func between(_ a: CGFloat, _ b: CGFloat) -> CGFloat {
        a + CGFloat(next()) * (b - a)
    }
}

func p(_ x: CGFloat, _ yFromTop: CGFloat) -> NSPoint {
    NSPoint(x: x, y: CGFloat(canvasHeight) - yFromTop)
}

func path(_ points: [(CGFloat, CGFloat)], closed: Bool = true) -> NSBezierPath {
    let result = NSBezierPath()
    result.move(to: p(points[0].0, points[0].1))
    for point in points.dropFirst() { result.line(to: p(point.0, point.1)) }
    if closed { result.close() }
    result.lineJoinStyle = .round
    result.lineCapStyle = .round
    return result
}

func stroke(_ shape: NSBezierPath, _ color: NSColor, _ width: CGFloat) {
    color.setStroke(); shape.lineWidth = width; shape.stroke()
}

func fill(_ shape: NSBezierPath, _ color: NSColor) {
    color.setFill(); shape.fill()
}

func texture(in shape: NSBezierPath, seed: UInt64, count: Int,
             color: NSColor, length: ClosedRange<CGFloat>, width: CGFloat) {
    var rng = RNG(state: seed)
    NSGraphicsContext.saveGraphicsState()
    shape.addClip()
    color.setStroke()
    for _ in 0..<count {
        let x = rng.between(0, CGFloat(canvasWidth))
        let y = rng.between(0, CGFloat(canvasHeight))
        let len = rng.between(length.lowerBound, length.upperBound)
        let rise = rng.between(-3, 3)
        let mark = NSBezierPath()
        mark.move(to: p(x, y))
        mark.curve(to: p(x + len, y + rise),
                   controlPoint1: p(x + len * 0.33, y - rng.between(0, 4)),
                   controlPoint2: p(x + len * 0.66, y + rng.between(0, 4)))
        mark.lineWidth = width
        mark.stroke()
    }
    NSGraphicsContext.restoreGraphicsState()
}

func line(_ points: [(CGFloat, CGFloat)], color: NSColor, width: CGFloat,
          dash: [CGFloat] = []) {
    let result = path(points, closed: false)
    result.lineWidth = width
    if !dash.isEmpty { result.setLineDash(dash, count: dash.count, phase: 0) }
    color.setStroke(); result.stroke()
}

let sea = NSColor(calibratedRed: 0.045, green: 0.043, blue: 0.039, alpha: 1)
let seaLight = NSColor(calibratedRed: 0.20, green: 0.19, blue: 0.16, alpha: 0.42)
let lowLand = NSColor(calibratedRed: 0.22, green: 0.205, blue: 0.17, alpha: 1)
let cityLand = NSColor(calibratedRed: 0.29, green: 0.27, blue: 0.22, alpha: 1)
let highLand = NSColor(calibratedRed: 0.34, green: 0.32, blue: 0.27, alpha: 1)
let ink = NSColor(calibratedRed: 0.055, green: 0.052, blue: 0.046, alpha: 1)
let paleInk = NSColor(calibratedRed: 0.63, green: 0.59, blue: 0.48, alpha: 0.85)
let wallInk = NSColor(calibratedRed: 0.10, green: 0.09, blue: 0.075, alpha: 1)

guard let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: canvasWidth,
                                    pixelsHigh: canvasHeight, bitsPerSample: 8,
                                    samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                                    colorSpaceName: .deviceRGB, bytesPerRow: 0,
                                    bitsPerPixel: 0) else { fatalError("bitmap allocation failed") }

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
sea.setFill(); NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight).fill()

// Sea grain and current lines.
var seaRng = RNG(state: 11)
for _ in 0..<1900 {
    let x = seaRng.between(0, CGFloat(canvasWidth))
    let y = seaRng.between(0, CGFloat(canvasHeight))
    let len = seaRng.between(8, 42)
    line([(x,y),(x+len,y+seaRng.between(-2,2))], color: seaLight, width: seaRng.between(0.4,1.3))
}

// The Backlands: a vast upper-right mass whose top and right edges escape the frame.
let backlands = path([(720,0),(1672,0),(1672,505),(1550,470),(1430,420),(1320,360),
                      (1210,305),(1100,278),(1015,282),(935,310),(860,350),(790,374),(738,355)])
fill(backlands, highLand)
texture(in: backlands, seed: 22, count: 2700,
        color: NSColor(calibratedWhite: 0.06, alpha: 0.34), length: 4...24, width: 0.9)
texture(in: backlands, seed: 23, count: 1200,
        color: NSColor(calibratedWhite: 0.75, alpha: 0.12), length: 5...21, width: 0.8)
stroke(backlands, ink, 5)

// Distant escarpment; upper terrain remains visible and continues out of frame.
let cliffTop: [(CGFloat,CGFloat)] = [(790,92),(960,76),(1140,82),(1320,105),(1490,142),(1672,185)]
line(cliffTop, color: wallInk, width: 13)
for index in 0..<(cliffTop.count - 1) {
    let a = cliffTop[index], b = cliffTop[index+1]
    for step in 0..<15 {
        let t = CGFloat(step) / 15
        let x = a.0 + (b.0-a.0)*t
        let y = a.1 + (b.1-a.1)*t
        line([(x,y),(x-7,y+28)], color: ink.withAlphaComponent(0.75), width: 2)
    }
}

// Necropolis island/city mass. Its complete upper/back edge directly borders sea.
let necropolis = path([(505,312),(610,285),(750,280),(910,300),(1070,335),(1220,390),
                       (1350,455),(1450,535),(1468,620),(1420,685),(1290,735),(1110,760),
                       (920,750),(760,710),(635,650),(550,575),(500,485),(482,395)])
fill(necropolis, cityLand)
texture(in: necropolis, seed: 41, count: 1750,
        color: NSColor(calibratedWhite: 0.05, alpha: 0.30), length: 3...15, width: 0.75)

// Great outer wall.
stroke(necropolis, wallInk, 18)
stroke(necropolis, paleInk.withAlphaComponent(0.55), 3)

// Layered curving roads, deliberately irregular rather than perfect circles.
let roads: [[(CGFloat,CGFloat)]] = [
    [(595,390),(720,345),(880,340),(1035,375),(1170,430),(1280,500),(1350,575)],
    [(575,455),(710,405),(865,398),(1015,425),(1145,475),(1250,535),(1320,610)],
    [(590,525),(725,475),(870,468),(1000,490),(1110,535),(1205,590),(1260,655)],
    [(650,590),(770,550),(900,545),(1015,565),(1110,610),(1170,675)],
    [(760,330),(755,430),(770,540),(800,665)],
    [(950,325),(935,420),(930,535),(920,730)],
    [(1120,360),(1085,450),(1065,555),(1080,735)]
]
for road in roads { line(road, color: ink.withAlphaComponent(0.82), width: 6) }

// Dense city blocks clipped to the city mass.
var cityRng = RNG(state: 55)
NSGraphicsContext.saveGraphicsState(); necropolis.addClip()
for _ in 0..<1100 {
    let x = cityRng.between(525, 1430)
    let y = cityRng.between(315, 725)
    let bw = cityRng.between(5, 15)
    let bh = cityRng.between(4, 11)
    let block = path([(x,y),(x+bw,y-2),(x+bw+2,y+bh),(x+2,y+bh+2)])
    fill(block, ink.withAlphaComponent(cityRng.between(0.45,0.92)))
    if cityRng.next() > 0.82 {
        line([(x+bw/2,y-2),(x+bw/2,y-cityRng.between(5,17))], color: paleInk, width: 1.2)
    }
}
NSGraphicsContext.restoreGraphicsState()

// A few civic masses without turning the city into a collection of monuments.
for (x,y,s) in [(735.0,365.0,1.0),(1000.0,450.0,1.25),(1190.0,510.0,0.9)] {
    let base = path([(x-22*s,y+15*s),(x+23*s,y+15*s),(x+17*s,y-10*s),(x-15*s,y-10*s)])
    fill(base, ink); stroke(base, paleInk.withAlphaComponent(0.5), 2)
    line([(x,y-10*s),(x,y-48*s)], color: ink, width: 7*s)
}

// Ruined old Greyharbour: a diagonal damaged strip between living harbour and city.
let ruins = path([(400,650),(485,600),(565,605),(655,642),(745,692),(775,735),
                  (720,775),(625,760),(535,728),(455,700)])
fill(ruins, lowLand)
stroke(ruins, ink.withAlphaComponent(0.9), 4)
var ruinRng = RNG(state: 77)
NSGraphicsContext.saveGraphicsState(); ruins.addClip()
for _ in 0..<175 {
    let x = ruinRng.between(420,760), y = ruinRng.between(615,760)
    line([(x,y),(x+ruinRng.between(4,17),y+ruinRng.between(-7,7))], color: ink, width: ruinRng.between(1,3))
}
NSGraphicsContext.restoreGraphicsState()

// Greyharbour: small, robust, and dock-heavy.
let greyharbour = path([(88,708),(185,660),(300,652),(405,685),(500,750),(530,820),
                        (482,888),(355,920),(210,906),(105,858),(62,790)])
fill(greyharbour, lowLand)
texture(in: greyharbour, seed: 91, count: 500,
        color: ink.withAlphaComponent(0.35), length: 3...15, width: 0.8)
stroke(greyharbour, wallInk, 8)

// Beloved wooden walls and a heavier defensive edge facing the Necropolis.
line([(170,675),(300,668),(405,700),(480,752)], color: paleInk.withAlphaComponent(0.62), width: 5)
line([(405,700),(480,752),(505,805)], color: wallInk, width: 12)

// Working docks: more dock structure than housing.
for y in stride(from: 742.0, through: 866.0, by: 29.0) {
    line([(112,y),(32,y+10)], color: paleInk, width: 5)
    line([(32,y+10),(18,y+20)], color: ink, width: 3)
}

// Approximately two hundred inhabitants suggested by sparse buildings and larger war buildings.
var harbourRng = RNG(state: 101)
for _ in 0..<58 {
    let x = harbourRng.between(145,420), y = harbourRng.between(710,855)
    let bw = harbourRng.between(7,16), bh = harbourRng.between(6,13)
    let house = path([(x,y),(x+bw,y),(x+bw,y+bh),(x,y+bh)])
    fill(house, ink.withAlphaComponent(0.78))
}
for (x,y,w,h) in [(390.0,728.0,44.0,25.0),(425.0,762.0,48.0,26.0),(448.0,798.0,42.0,24.0)] {
    let building = path([(x,y),(x+w,y),(x+w,y+h),(x,y+h)])
    fill(building, wallInk); stroke(building, paleInk.withAlphaComponent(0.55), 2)
}

// Refinery route: Greyharbour -> intermediary island -> refinery, all independently legible.
let middleIsland = path([(36,647),(70,625),(106,635),(124,663),(105,691),(68,702),(38,680)])
fill(middleIsland, lowLand); stroke(middleIsland, wallInk, 5)
let refineryIsland = path([(0,548),(55,520),(122,536),(158,580),(145,620),(98,642),(42,625),(0,600)])
fill(refineryIsland, lowLand); stroke(refineryIsland, wallInk, 6)
line([(121,690),(99,680),(81,665)], color: paleInk, width: 7)
line([(61,640),(43,616),(28,595)], color: paleInk, width: 7)

// Low industrial refinery complex: multiple tanks/sheds, no giant circular tower.
for (x,y,w,h) in [(30.0,558.0,38.0,18.0),(72.0,550.0,42.0,20.0),(54.0,585.0,58.0,21.0)] {
    let shed = path([(x,y),(x+w,y),(x+w,y+h),(x,y+h)])
    fill(shed, ink); stroke(shed, paleInk.withAlphaComponent(0.5), 2)
}
for x in [40.0, 86.0, 124.0] { line([(x,555),(x,530)], color: wallInk, width: 5) }

// Short crevasse: exactly at the midpoint of the lower/front city edge.
let crevasse = path([(918,748),(904,770),(916,789),(903,810),(918,832),(930,850)], closed: false)
stroke(crevasse, sea, 18)
stroke(crevasse, ink, 5)

// Soft distressed edge, raster only.
let gradient = NSGradient(colors: [NSColor.clear, NSColor.black.withAlphaComponent(0.60)])!
for rect in [NSRect(x:0,y:0,width:canvasWidth,height:85),
             NSRect(x:0,y:canvasHeight-85,width:canvasWidth,height:85)] {
    gradient.draw(in: rect, angle: rect.minY == 0 ? 90 : 270)
}

NSGraphicsContext.restoreGraphicsState()
guard let png = bitmap.representation(using: .png, properties: [:]) else { fatalError("PNG encoding failed") }
try png.write(to: URL(fileURLWithPath: outputPath))
print(outputPath)
