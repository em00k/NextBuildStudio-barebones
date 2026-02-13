"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse8BitSprites = parse8BitSprites;
exports.parse4BitSprites = parse4BitSprites;
exports.parse8x8Font = parse8x8Font;
exports.parse8x8Tiles = parse8x8Tiles;
exports.encodeSpriteData = encodeSpriteData;
exports.getSpriteByOriginalIndex = getSpriteByOriginalIndex;
// --- Parsing Functions ---
function parse8BitSprites(data, preserveIndices = false) {
    const sprites = [];
    const spriteSize = 256; // 16x16 pixels, 1 byte per pixel
    const maxSprites = Math.floor(data.length / spriteSize);
    const numSprites = Math.min(maxSprites, 512); // Increased limit to 512
    // Create hash map for quick sprite comparison if preserveIndices is enabled
    const spriteHashes = new Map();
    // Original to deduplicated mapping (index = original position, value = deduplicated position)
    const originalToDeduplicatedMap = new Array(numSprites).fill(-1);
    // Deduplicated to original mapping (index = deduplicated position, value = original position)
    const deduplicatedToOriginalMap = [];
    console.log(`[DEBUG] parse8BitSprites: Processing ${numSprites} sprites with preserveIndices=${preserveIndices}`);
    for (let i = 0; i < numSprites; i++) {
        const spritePixels = [];
        const offset = i * spriteSize;
        // Read 16x16 pixels (1 byte per pixel)
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x++) {
                const pixelOffset = offset + (y * 16) + x;
                if (pixelOffset < data.length) {
                    const colorIndex = data[pixelOffset];
                    spritePixels.push(colorIndex);
                }
                else {
                    spritePixels.push(0); // Default to 0 for missing data
                }
            }
        }
        // If preserveIndices is enabled, we'll check for duplicates
        if (preserveIndices) {
            // Generate a hash for quick comparison
            const hash = spritePixels.join(',');
            // Check if we've seen this sprite before
            if (spriteHashes.has(hash)) {
                // This is a duplicate - map it to the existing sprite
                const existingIndex = spriteHashes.get(hash);
                originalToDeduplicatedMap[i] = existingIndex;
                console.log(`[DEBUG] Sprite ${i} is a duplicate of sprite ${existingIndex}`);
                continue; // Skip adding this duplicate
            }
            else {
                // This is a new unique sprite
                const newIndex = sprites.length;
                spriteHashes.set(hash, newIndex);
                originalToDeduplicatedMap[i] = newIndex;
                deduplicatedToOriginalMap.push(i);
            }
        }
        sprites.push({
            index: sprites.length, // Use the current length as the index
            pixels: spritePixels,
            width: 16,
            height: 16
        });
    }
    console.log(`[DEBUG] Deduplicated sprites: ${sprites.length} unique sprites from ${numSprites} total`);
    return {
        type: 'sprite8',
        sprites: sprites,
        width: 16,
        height: 16,
        description: `8-bit sprites (16×16 pixels, 256 colors)`,
        count: sprites.length,
        // Add mapping data if using preserveIndices
        originalToDeduplicatedMap: preserveIndices ? originalToDeduplicatedMap : undefined,
        deduplicatedToOriginalMap: preserveIndices ? deduplicatedToOriginalMap : undefined,
        originalCount: preserveIndices ? numSprites : undefined
    };
}
function parse4BitSprites(data, paletteOffset, preserveIndices = false) {
    const sprites = [];
    const spriteSize = 128; // 16x16 pixels, 4 bits per pixel (2 pixels per byte)
    const maxSprites = Math.floor(data.length / spriteSize);
    const numSprites = Math.min(maxSprites, 512); // Increased limit to 512
    // Create hash map for quick sprite comparison if preserveIndices is enabled
    const spriteHashes = new Map();
    // Original to deduplicated mapping (index = original position, value = deduplicated position)
    const originalToDeduplicatedMap = new Array(numSprites).fill(-1);
    // Deduplicated to original mapping (index = deduplicated position, value = original position)
    const deduplicatedToOriginalMap = [];
    console.log(`[DEBUG] parse4BitSprites: Processing ${numSprites} sprites with preserveIndices=${preserveIndices}`);
    for (let i = 0; i < numSprites; i++) {
        const spritePixels = [];
        const offset = i * spriteSize;
        // Read 16x16 pixels (4 bits per pixel, 2 pixels per byte)
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < 16; x += 2) {
                const byteOffset = offset + (y * 8) + (x / 2);
                if (byteOffset < data.length) {
                    const byte = data[byteOffset];
                    const pixel1 = (byte >> 4) & 0x0F; // High nibble
                    const pixel2 = byte & 0x0F; // Low nibble
                    spritePixels.push(pixel1 + paletteOffset);
                    if (x + 1 < 16) {
                        spritePixels.push(pixel2 + paletteOffset);
                    }
                }
                else {
                    spritePixels.push(0); // Default to 0 for missing data
                    if (x + 1 < 16) {
                        spritePixels.push(0);
                    }
                }
            }
        }
        // If preserveIndices is enabled, we'll check for duplicates
        if (preserveIndices) {
            // Generate a hash for quick comparison
            const hash = spritePixels.join(',');
            // Check if we've seen this sprite before
            if (spriteHashes.has(hash)) {
                // This is a duplicate - map it to the existing sprite
                const existingIndex = spriteHashes.get(hash);
                originalToDeduplicatedMap[i] = existingIndex;
                console.log(`[DEBUG] Sprite ${i} is a duplicate of sprite ${existingIndex}`);
                continue; // Skip adding this duplicate
            }
            else {
                // This is a new unique sprite
                const newIndex = sprites.length;
                spriteHashes.set(hash, newIndex);
                originalToDeduplicatedMap[i] = newIndex;
                deduplicatedToOriginalMap.push(i);
            }
        }
        sprites.push({
            index: sprites.length, // Use the current length as the index
            pixels: spritePixels,
            width: 16,
            height: 16
        });
    }
    console.log(`[DEBUG] Deduplicated sprites: ${sprites.length} unique sprites from ${numSprites} total`);
    return {
        type: 'sprite4',
        sprites: sprites,
        width: 16,
        height: 16,
        description: `4-bit sprites (16×16 pixels, 16 colors, palette offset: ${paletteOffset})`,
        count: sprites.length,
        paletteOffset: paletteOffset, // Store the offset used for parsing
        // Add mapping data if using preserveIndices
        originalToDeduplicatedMap: preserveIndices ? originalToDeduplicatedMap : undefined,
        deduplicatedToOriginalMap: preserveIndices ? deduplicatedToOriginalMap : undefined,
        originalCount: preserveIndices ? numSprites : undefined
    };
}
function parse8x8Font(data) {
    const chars = [];
    const charSize = 64; // 8x8 pixels, 1 byte per pixel
    const maxChars = Math.floor(data.length / charSize);
    const numChars = Math.min(maxChars, 256); // Max 256 characters
    for (let i = 0; i < numChars; i++) {
        const charPixels = [];
        const offset = i * charSize;
        // Read 8x8 pixels (1 byte per pixel)
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const pixelOffset = offset + (y * 8) + x;
                if (pixelOffset < data.length) {
                    const colorIndex = data[pixelOffset];
                    charPixels.push(colorIndex);
                }
                else {
                    charPixels.push(0); // Default to 0 for missing data
                }
            }
        }
        chars.push({
            index: i,
            pixels: charPixels,
            width: 8,
            height: 8
        });
    }
    return {
        type: 'font8x8',
        sprites: chars,
        width: 8,
        height: 8,
        description: `8×8 font (256 colors)`,
        count: numChars
    };
}
function parse8x8Tiles(data, paletteOffset) {
    const tiles = [];
    const tileSize = 32; // 8x8 pixels, 4 bits per pixel (2 pixels per byte)
    const maxTiles = Math.floor(data.length / tileSize);
    const numTiles = Math.min(maxTiles, 512); // Reasonable limit
    for (let i = 0; i < numTiles; i++) {
        const tilePixels = [];
        const offset = i * tileSize;
        // Read 8x8 pixels (4 bits per pixel, 2 pixels per byte)
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x += 2) {
                const byteOffset = offset + (y * 4) + (x / 2);
                if (byteOffset < data.length) {
                    const byte = data[byteOffset];
                    const pixel1 = (byte >> 4) & 0x0F; // High nibble
                    const pixel2 = byte & 0x0F; // Low nibble
                    tilePixels.push(pixel1 + paletteOffset);
                    if (x + 1 < 8) {
                        tilePixels.push(pixel2 + paletteOffset);
                    }
                }
                else {
                    tilePixels.push(0); // Default to 0 for missing data
                    if (x + 1 < 8) {
                        tilePixels.push(0);
                    }
                }
            }
        }
        tiles.push({
            index: i,
            pixels: tilePixels,
            width: 8,
            height: 8
        });
    }
    return {
        type: 'tile8x8',
        sprites: tiles,
        width: 8,
        height: 8,
        description: `8×8 tiles (16 colors, palette offset: ${paletteOffset})`,
        count: numTiles,
        paletteOffset: paletteOffset // Store the offset used for parsing
    };
}
// --- Encoding Functions ---
function encodeSpriteData(spriteData) {
    switch (spriteData.type) {
        case 'sprite8':
            return encode8BitSpriteData(spriteData, 16, 16);
        case 'sprite4':
            const offset4 = spriteData.paletteOffset ?? 0; // Use stored or default offset
            console.log(`Encoding 4-bit sprite data with offset: ${offset4}`);
            return encode4BitSpriteData(spriteData, 16, 16, offset4);
        case 'font8x8':
            return encode8BitSpriteData(spriteData, 8, 8);
        case 'tile8x8':
            const offsetTile = spriteData.paletteOffset ?? 0; // Use stored or default offset
            console.log(`Encoding 4-bit tile data with offset: ${offsetTile}`);
            return encode4BitSpriteData(spriteData, 8, 8, offsetTile);
        default:
            // Ensure exhaustive check (TypeScript will warn if a type is missed)
            const _exhaustiveCheck = spriteData.type;
            throw new Error(`Unsupported sprite type for encoding: ${_exhaustiveCheck}`);
    }
}
function encode8BitSpriteData(spriteData, width, height) {
    const spriteSize = width * height;
    const numSprites = spriteData.sprites.length;
    const bufferSize = numSprites * spriteSize;
    const buffer = Buffer.alloc(bufferSize);
    for (let i = 0; i < numSprites; i++) {
        const sprite = spriteData.sprites[i];
        const offset = i * spriteSize;
        if (!sprite || !sprite.pixels || sprite.pixels.length !== spriteSize) {
            console.warn(`Skipping invalid sprite data at index ${i} during 8-bit encoding`);
            // Fill with 0s to maintain buffer size
            for (let p = 0; p < spriteSize; p++) {
                buffer[offset + p] = 0;
            }
            continue; // Skip if sprite data is invalid
        }
        for (let p = 0; p < spriteSize; p++) {
            buffer[offset + p] = sprite.pixels[p] & 0xFF; // Ensure it's a byte
        }
    }
    return buffer;
}
function encode4BitSpriteData(spriteData, width, height, paletteOffset) {
    const pixelsPerSprite = width * height;
    const bytesPerSprite = pixelsPerSprite / 2;
    const numSprites = spriteData.sprites.length;
    const bufferSize = numSprites * bytesPerSprite;
    const buffer = Buffer.alloc(bufferSize);
    for (let i = 0; i < numSprites; i++) {
        const sprite = spriteData.sprites[i];
        const spriteOffsetBytes = i * bytesPerSprite;
        if (!sprite || !sprite.pixels || sprite.pixels.length !== pixelsPerSprite) {
            console.warn(`Skipping invalid 4-bit sprite data at index ${i} during encoding`);
            // Fill with 0s to maintain buffer size
            for (let b = 0; b < bytesPerSprite; b++) {
                buffer[spriteOffsetBytes + b] = 0;
            }
            continue; // Skip if sprite data is invalid
        }
        for (let p = 0; p < pixelsPerSprite; p += 2) {
            // Calculate the byte index within the overall buffer
            const byteIndex = spriteOffsetBytes + (p / 2);
            // Get the two pixel indices, subtract the offset, ensure they are within 0-15 range
            const pixelValue1 = sprite.pixels[p] ?? 0; // Default to 0 if somehow undefined
            const pixelValue2 = (p + 1 < pixelsPerSprite) ? (sprite.pixels[p + 1] ?? 0) : 0;
            const pixelIndex1 = Math.max(0, Math.min(15, pixelValue1 - paletteOffset)) & 0x0F;
            const pixelIndex2 = Math.max(0, Math.min(15, pixelValue2 - paletteOffset)) & 0x0F;
            // Combine into one byte (pixel1 in high nibble, pixel2 in low nibble)
            const byteValue = (pixelIndex1 << 4) | pixelIndex2;
            buffer[byteIndex] = byteValue;
        }
    }
    return buffer;
}
// Helper function to get a sprite by its original index
function getSpriteByOriginalIndex(spriteData, originalIndex) {
    if (!spriteData.originalToDeduplicatedMap) {
        // If no mapping exists, assume 1:1 correspondence
        return originalIndex < spriteData.sprites.length ? spriteData.sprites[originalIndex] : null;
    }
    // Check if the original index is valid
    if (originalIndex < 0 || originalIndex >= spriteData.originalToDeduplicatedMap.length) {
        return null;
    }
    // Get the deduplicated index
    const deduplicatedIndex = spriteData.originalToDeduplicatedMap[originalIndex];
    // Check if the deduplicated index is valid
    if (deduplicatedIndex < 0 || deduplicatedIndex >= spriteData.sprites.length) {
        return null;
    }
    return spriteData.sprites[deduplicatedIndex];
}
//# sourceMappingURL=spriteDataHandler.js.map