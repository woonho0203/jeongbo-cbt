import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)
guard let image = NSImage(contentsOf: url),
      let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    fatalError("image load failed")
}

let semaphore = DispatchSemaphore(value: 0)
let request = VNRecognizeTextRequest { request, error in
    if let error = error {
        fputs("OCR error: \(error)\n", stderr)
        semaphore.signal()
        return
    }
    let observations = request.results as? [VNRecognizedTextObservation] ?? []
    for obs in observations {
        guard let candidate = obs.topCandidates(1).first else { continue }
        let box = obs.boundingBox
        let row: [String: Any] = [
            "x": box.minX,
            "y": box.minY,
            "w": box.width,
            "h": box.height,
            "text": candidate.string,
        ]
        let data = try! JSONSerialization.data(withJSONObject: row, options: [.sortedKeys])
        print(String(data: data, encoding: .utf8)!)
    }
    semaphore.signal()
}

request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["ko-KR", "en-US"]

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])
semaphore.wait()
