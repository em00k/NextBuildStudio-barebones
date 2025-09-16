"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractColorsFromImage = extractColorsFromImage;
/**
 * Image Color Extraction for ZX Next Palette
 *
 * Uses Jimp for image processing to extract a palette from images.
 *
 * Note: This is a separate module to keep image processing dependencies
 * isolated and allow for easier replacement if needed.
 */
const Jimp = __importStar(require("jimp"));
const paletteUtils_1 = require("./paletteUtils");
/**
 * Extract colo rs from an image file
 *
 * @param imageData - The raw image data as Uint8Array
 * @param maxColors - Maximum number of colors to extract (default: 256)
 * @returns Promise resolving to an array of PaletteColor objects
 */
async function extractColorsFromImage(imageData, maxColors = 256) {
    try {
        // Load image from buffer
        const image = await Jimp.read(Buffer.from(imageData));
        // Get image dimensions
        const width = image.getWidth();
        const height = image.getHeight();
        // Map to store unique colors
        const colorMap = new Map();
        // Scan image pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Get pixel color (RGBA format)
                const pixelColor = Jimp.intToRGBA(image.getPixelColor(x, y));
                // Skip transparent pixels
                if (pixelColor.a < 128)
                    continue;
                // Convert to RGB
                const rgb = {
                    r: pixelColor.r,
                    g: pixelColor.g,
                    b: pixelColor.b
                };
                // Create a key for the color map
                const colorKey = `${rgb.r},${rgb.g},${rgb.b}`;
                // Add to map if not exists
                if (!colorMap.has(colorKey)) {
                    colorMap.set(colorKey, rgb);
                }
            }
        }
        console.log(`Extracted ${colorMap.size} unique colors from image`);
        // Convert to array of RGB values
        let colors = Array.from(colorMap.values());
        // If we have too many colors, quantize them
        if (colors.length > maxColors) {
            colors = quantizeColors(colors, maxColors);
            console.log(`Quantized to ${colors.length} colors`);
        }
        // Convert to ZX Next PaletteColor format
        const paletteColors = colors.map(rgb => {
            // Convert 8-bit RGB to 3-bit per channel (9-bit RGB)
            const r9 = Math.round((rgb.r / 255) * 7);
            const g9 = Math.round((rgb.g / 255) * 7);
            const b9 = Math.round((rgb.b / 255) * 7);
            // Convert to hex using the utility function
            const hex = (0, paletteUtils_1.rgb9ToHex)(r9, g9, b9);
            return { hex, priority: false };
        });
        return paletteColors;
    }
    catch (error) {
        console.error('Error extracting colors from image:', error);
        throw error;
    }
}
/**
 * Simple color quantization using median cut algorithm
 *
 * @param colors - Array of RGB colors
 * @param targetCount - Target number of colours
 * @returns Array of quantized RGB colors
 */
function quantizeColors(colors, targetCount) {
    if (colors.length <= targetCount) {
        return colors;
    }
    // Start with all colors in one bucket
    const buckets = [colors];
    // Split buckets until we have enough
    while (buckets.length < targetCount) {
        // Find the bucket with the largest range
        let largestRangeIndex = 0;
        let largestRange = 0;
        for (let i = 0; i < buckets.length; i++) {
            const bucket = buckets[i];
            if (bucket.length <= 1)
                continue; // Can't split further
            // Find the component with the largest range
            let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
            for (const color of bucket) {
                rMin = Math.min(rMin, color.r);
                rMax = Math.max(rMax, color.r);
                gMin = Math.min(gMin, color.g);
                gMax = Math.max(gMax, color.g);
                bMin = Math.min(bMin, color.b);
                bMax = Math.max(bMax, color.b);
            }
            const rRange = rMax - rMin;
            const gRange = gMax - gMin;
            const bRange = bMax - bMin;
            const bucketRange = Math.max(rRange, gRange, bRange);
            if (bucketRange > largestRange) {
                largestRange = bucketRange;
                largestRangeIndex = i;
            }
        }
        // If we can't split any further, break
        if (largestRange === 0)
            break;
        // Split the bucket along the component with the largest range
        const bucketToSplit = buckets[largestRangeIndex];
        // Determine the component to sort by
        let sortComponent;
        let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
        for (const color of bucketToSplit) {
            rMin = Math.min(rMin, color.r);
            rMax = Math.max(rMax, color.r);
            gMin = Math.min(gMin, color.g);
            gMax = Math.max(gMax, color.g);
            bMin = Math.min(bMin, color.b);
            bMax = Math.max(bMax, color.b);
        }
        const rRange = rMax - rMin;
        const gRange = gMax - gMin;
        const bRange = bMax - bMin;
        if (rRange >= gRange && rRange >= bRange) {
            sortComponent = 'r';
        }
        else if (gRange >= rRange && gRange >= bRange) {
            sortComponent = 'g';
        }
        else {
            sortComponent = 'b';
        }
        // Sort by the selected component
        bucketToSplit.sort((a, b) => a[sortComponent] - b[sortComponent]);
        // Split at median
        const medianIndex = Math.floor(bucketToSplit.length / 2);
        const lowerHalf = bucketToSplit.slice(0, medianIndex);
        const upperHalf = bucketToSplit.slice(medianIndex);
        // Replace the bucket with the two halves
        buckets.splice(largestRangeIndex, 1, lowerHalf, upperHalf);
    }
    // Extract the average color from each bucket
    return buckets.map(bucket => {
        if (bucket.length === 0) {
            return { r: 0, g: 0, b: 0 }; // Default black if empty bucket
        }
        if (bucket.length === 1) {
            return bucket[0]; // Return single color
        }
        // Calculate average color for bucket
        let rSum = 0, gSum = 0, bSum = 0;
        for (const color of bucket) {
            rSum += color.r;
            gSum += color.g;
            bSum += color.b;
        }
        return {
            r: Math.round(rSum / bucket.length),
            g: Math.round(gSum / bucket.length),
            b: Math.round(bSum / bucket.length)
        };
    });
}
//# sourceMappingURL=imageColorExtractor.js.map