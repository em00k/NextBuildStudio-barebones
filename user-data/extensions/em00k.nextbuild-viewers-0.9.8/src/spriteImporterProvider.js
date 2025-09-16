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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpriteImporterProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
// import Jimp from 'jimp'; // <-- Removed jimp
const jimp_1 = __importDefault(require("jimp")); // <-- Re-added Jimp for BMP fallback
const sharp_1 = __importDefault(require("sharp")); // <-- Added sharp import
const paletteUtils_1 = require("./paletteUtils"); // <-- Import available functions from paletteUtils
// Explicitly import Buffer from 'buffer' to ensure we're using the right version
const buffer_1 = require("buffer");
// // ZX Next RGB mapping: maps 3-bit RGB values (0-7) to 8-bit RGB values (0-255)
// const RGB3_TO_8_MAP = [0x00, 0x24, 0x49, 0x6D, 0x92, 0xB6, 0xDB, 0xFF];
// --- Helper Function: Find Closest Color --- 
// Finds the index of the color in the targetPalette (array of {r,g,b} 0-255) 
// closest to the input color (r,g,b 0-255)
function findClosestPaletteIndex(r, g, b, targetPalette) {
    let minDistanceSq = Infinity;
    let closestIndex = 0;
    // Convert input RGB values to ZX Next's 9-bit RGB space first (3-3-3 format)
    // This gives more accurate color matching for this specific hardware
    const r3bit = Math.round(r * 7 / 255); // Map 0-255 to 0-7
    const g3bit = Math.round(g * 7 / 255); // Map 0-255 to 0-7
    const b3bit = Math.round(b * 7 / 255); // Map 0-255 to 0-7
    for (let i = 0; i < targetPalette.length; i++) {
        const palColor = targetPalette[i];
        // Convert palette colors to 3-bit space too (0-7 range)
        const pr3bit = Math.round(palColor.r * 7 / 255);
        const pg3bit = Math.round(palColor.g * 7 / 255);
        const pb3bit = Math.round(palColor.b * 7 / 255);
        // Calculate distance in ZX Next's native 3-bit-per-channel color space
        const dr = r3bit - pr3bit;
        const dg = g3bit - pg3bit;
        const db = b3bit - pb3bit;
        // Weight the components to match human perception
        // Humans are more sensitive to green, then red, then blue
        const distanceSq = (dr * dr * 3) + (dg * dg * 4) + (db * db * 2);
        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            closestIndex = i;
            // Optimization: if exact match found, return immediately
            if (minDistanceSq === 0) {
                break;
            }
        }
    }
    return closestIndex;
}
// --- Define ZX Next colors mapping (same as in paletteUtils) ---
// Specific mapping from 3-bit component (0-7) to 8-bit component value
const RGB3_TO_8_MAP = [0x00, 0x24, 0x49, 0x6D, 0x92, 0xB6, 0xDB, 0xFF];
// --- Function to debug palette values ---
function debugPalette(palette, label) {
    if (palette.length > 0) {
        console.log(`${label} - First few entries:`);
        for (let i = 0; i < Math.min(5, palette.length); i++) {
            console.log(`  [${i}]: ${JSON.stringify(palette[i])}`);
        }
    }
    else {
        console.log(`${label} - Empty palette!`);
    }
}
// --- Convert Default 9-bit palette to 8-bit for distance calculation --- 
const defaultPalette8bit = paletteUtils_1.defaultPaletteRGB.map(rgb9 => {
    const r = RGB3_TO_8_MAP[rgb9[0]];
    const g = RGB3_TO_8_MAP[rgb9[1]];
    const b = RGB3_TO_8_MAP[rgb9[2]];
    return { r, g, b };
});
// Debug the default palette
debugPalette(paletteUtils_1.defaultPaletteRGB.slice(0, 5), 'Default Palette RGB9');
debugPalette(defaultPalette8bit.slice(0, 5), 'Default Palette 8bit');
class SpriteImporterProvider {
    context;
    static viewType = 'nextbuild-viewers.spriteImporter';
    static title = 'Sprite Importer';
    _panel;
    _extensionUri;
    _disposables = [];
    _imageUri; // Store the URI of the image being imported
    _currentImageFsPath; // Store the fsPath for comparison
    constructor(context, imageUri, panel // Optional panel for creation
    ) {
        this.context = context;
        this._extensionUri = context.extensionUri;
        this._imageUri = imageUri;
        this._currentImageFsPath = imageUri.fsPath;
        // If a panel isn't provided, create one. Otherwise, use the provided one (e.g., during deserialization).
        if (panel) {
            this._panel = panel;
        }
        else {
            this._panel = vscode.window.createWebviewPanel(SpriteImporterProvider.viewType, `${SpriteImporterProvider.title}: ${path.basename(imageUri.fsPath)}`, vscode.ViewColumn.One, this.getWebviewOptions());
        }
        console.log(`[SpriteImporterProvider] Created/obtained panel for: ${imageUri.fsPath}`);
        // Set the webview's initial content
        this.updateWebviewContent();
        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message) => {
            console.log('[SpriteImporterProvider] Received message:', {
                command: message.command,
                // Avoid logging potentially large data like pixelDataBase64
                dataKeys: message.data ? Object.keys(message.data) : null
            });
            switch (message.command) {
                case 'getImageData':
                    this.sendImageData();
                    return;
                case 'importSprites':
                    if (message.data) {
                        await this.saveSpriteSheet(message.data);
                    }
                    else {
                        console.error("Received importSprites command without data.");
                    }
                    return;
                case 'loadTargetPalette': // Handle new message
                    await this.handleLoadTargetPalette();
                    return;
                case 'loadImageRequest': // Handle request to load a new image
                    await this.handleLoadImageRequest();
                    return;
                case 'saveExtractedPalette': // Handle saving the extracted palette
                    if (message.paletteHex && Array.isArray(message.paletteHex)) {
                        await this.saveExtractedPaletteToFile(message.paletteHex);
                    }
                    else {
                        console.error("Received saveExtractedPalette command without valid palette data.");
                        vscode.window.showErrorMessage("Could not save palette: Invalid data received.");
                    }
                    return;
                case 'exportAsBlock':
                    if (message.data) {
                        await this.saveAsBlockFile(message.data);
                    }
                    else {
                        console.error("Received exportAsBlock command without data.");
                        vscode.window.showErrorMessage("Could not export block: Invalid data received.");
                    }
                    return;
                case 'showError':
                    if (message.text) {
                        vscode.window.showErrorMessage(message.text);
                    }
                    return;
                case 'convertToPng':
                    // Convert current image to PNG
                    await this.convertImageToPNG(this._imageUri);
                    return;
                case 'convertImage':
                    // Handle image conversion to NXI
                    await this.handleImageConversion(message.options);
                    return;
            }
        }, null, this._disposables);
    }
    dispose() {
        console.log('[SpriteImporterProvider] Disposing panel and resources.');
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    // Required for WebviewPanelSerializer
    async deserializeWebviewPanel(webviewPanel, state) {
        console.warn('[SpriteImporterProvider] Deserialization not fully implemented yet.');
        // This might require storing the image URI in the state during serialization
        // For now, we might just close it or show an error.
        // Or potentially re-initialize with the state if the imageUri is stored.
        if (state && state.imageUriPath) {
            this._imageUri = vscode.Uri.file(state.imageUriPath); // Reconstruct URI
            console.log('[SpriteImporterProvider] Attempting to restore panel for:', this._imageUri.fsPath);
            // Re-initialize the panel logic
            // Be careful with constructor logic - might need refactoring if deserialization is fully supported
            // Maybe call a separate init method?
            this._panel = webviewPanel; // Assign the restored panel
            this.updateWebviewContent(); // Update content based on restored state/image
            // Re-attach listeners (might be handled by VS Code?)
        }
        else {
            console.error('[SpriteImporterProvider] Cannot deserialize: Missing image URI in state.');
            webviewPanel.dispose(); // Dispose if we can't restore state
        }
    }
    // Optional: Implement for state saving on close/reload
    // public async serializeWebviewPanel(webviewPanel: vscode.WebviewPanel): Promise<any> {
    //     return { imageUriPath: this._imageUri.fsPath }; // Store URI path
    // }
    getWebviewOptions() {
        return {
            // Enable javascript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from our extension's `media` and `src/webview` directories.
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'),
                vscode.Uri.joinPath(this._extensionUri, 'src', 'webview')
            ]
        };
    }
    async updateWebviewContent() {
        this._panel.title = `${SpriteImporterProvider.title}: ${path.basename(this._imageUri.fsPath)}`;
        // Set the HTML content
        this._panel.webview.html = this.getHtmlForWebview(this._panel.webview);
        // Extract file extension to potentially show a BMP conversion button
        const fileExt = path.extname(this._imageUri.fsPath).toLowerCase();
        const isBmpFile = fileExt === '.bmp';
        if (isBmpFile) {
            // Add a slight delay to ensure the webview has loaded
            setTimeout(() => {
                this._panel.webview.postMessage({
                    command: 'showBmpConverterButton',
                    text: 'BMP files may have issues. Consider converting to PNG for better results.'
                });
            }, 500);
        }
    }
    async sendImageData() {
        try {
            const fileData = await vscode.workspace.fs.readFile(this._imageUri);
            // Get file extension to handle format-specific processing
            const fileExt = path.extname(this._imageUri.fsPath).toLowerCase();
            console.log(`[SpriteImporterProvider] Processing image of type: ${fileExt}`);
            // Check if it's a BMP file
            if (fileExt === '.bmp') {
                return await this.handleBmpWithJimp(fileData);
            }
            // Process with sharp for non-BMP files
            let pipeline = (0, sharp_1.default)(fileData, {
                // Add more detailed options for problematic formats
                pages: 1, // Only process first page/frame for multi-page formats
                limitInputPixels: false, // Don't limit input pixel count
                failOn: 'none' // Don't fail on warnings
            });
            // Complete the processing pipeline
            const { data: pixelDataBuffer, info } = await pipeline
                .ensureAlpha() // Ensure image has an alpha channel (RGBA)
                .raw() // Output raw pixel data
                .toBuffer({ resolveWithObject: true }); // Get buffer and info (width, height, channels)
            const width = info.width;
            const height = info.height;
            if (info.channels !== 4) {
                // This shouldn't happen due to ensureAlpha(), but good to check
                throw new Error(`Expected 4 channels (RGBA) but got ${info.channels}`);
            }
            const pixelDataBase64 = pixelDataBuffer.toString('base64');
            console.log(`[SpriteImporterProvider] Sending image data via sharp (width: ${width}, height: ${height}).`);
            this._panel.webview.postMessage({
                command: 'loadImageData',
                data: {
                    width: width,
                    height: height,
                    pixelDataBase64: pixelDataBase64,
                    currentImageFsPath: this._currentImageFsPath // <-- Send identifier inside data
                }
            });
        }
        catch (e) {
            console.error('[SpriteImporterProvider] Failed to read or process image file with sharp:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            // Check if this is a format issue - try Jimp as last resort
            if (errorMessage.includes('unsupported image format')) {
                try {
                    console.log('[SpriteImporterProvider] Trying fallback with Jimp for unsupported format');
                    await this.handleWithJimp();
                    return; // Exit if Jimp handled it successfully
                }
                catch (jimpError) {
                    console.error('[SpriteImporterProvider] Jimp fallback also failed:', jimpError);
                    // Continue to the error handling below
                }
            }
            // More detailed error handling
            let userErrorMessage = `Failed to process image ${path.basename(this._imageUri.fsPath)}: ${errorMessage}`;
            // Specific message for unsupported format errors
            if (errorMessage.includes('unsupported image format')) {
                const fileExt = path.extname(this._imageUri.fsPath).toLowerCase();
                userErrorMessage = `Cannot process ${fileExt} image format. Try a different image format like PNG or JPEG.`;
                // Offer to convert the file
                vscode.window.showErrorMessage(userErrorMessage, 'Convert to PNG')
                    .then(selection => {
                    if (selection === 'Convert to PNG') {
                        this.convertImageToPNG(this._imageUri);
                    }
                });
                return; // Skip the generic error message below
            }
            this._panel.webview.postMessage({ command: 'showError', text: `Failed to read or process image file: ${errorMessage}` });
            vscode.window.showErrorMessage(userErrorMessage);
        }
    }
    // --- Add Handler for Loading Target Palette ---
    async handleLoadTargetPalette() {
        try {
            // Show open dialog for palette file (PAL, NXP)
            const paletteUris = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Palette Files': ['pal', 'nxp']
                },
                title: 'Select Target Palette'
            });
            if (!paletteUris || paletteUris.length === 0) {
                return; // User cancelled
            }
            const selectedUri = paletteUris[0];
            console.log(`[SpriteImporterProvider] Loading palette from: ${selectedUri.fsPath}`);
            // Read the file data
            const fileData = await vscode.workspace.fs.readFile(selectedUri);
            // Parse the palette file
            try {
                const palette = (0, paletteUtils_1.parsePaletteFile)(fileData);
                // Extract just the hex values for the webview
                const paletteHex = palette.map(c => c.hex);
                // Send to webview using consistent key name 'paletteHex'
                this._panel.webview.postMessage({
                    command: 'updateTargetPalette',
                    paletteHex: paletteHex, // Use 'paletteHex' consistently, not 'palette'
                    filename: path.basename(selectedUri.fsPath)
                });
            }
            catch (parseError) {
                console.error('[SpriteImporterProvider] Error parsing palette file:', parseError);
                vscode.window.showErrorMessage(`Failed to parse palette file: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            }
        }
        catch (error) {
            console.error('[SpriteImporterProvider] Error loading palette:', error);
            vscode.window.showErrorMessage(`Error loading palette: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // --- NEW: Handle Request to Load a Different Image --- 
    async handleLoadImageRequest() {
        const options = {
            canSelectMany: false,
            openLabel: 'Load Image for Import',
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
            }
        };
        const fileUris = await vscode.window.showOpenDialog(options);
        if (fileUris && fileUris[0]) {
            const newImageUri = fileUris[0];
            console.log('[SpriteImporterProvider] User selected new image:', newImageUri.fsPath);
            // Update the stored URI and path
            this._imageUri = newImageUri;
            this._currentImageFsPath = newImageUri.fsPath;
            // Update the panel title
            this._panel.title = `${SpriteImporterProvider.title}: ${path.basename(this._imageUri.fsPath)}`;
            // Send the new image data (this will trigger reset logic in webview)
            await this.sendImageData();
            vscode.window.showInformationMessage(`Loaded new image: ${path.basename(newImageUri.fsPath)}`);
        }
        else {
            console.log('[SpriteImporterProvider] User cancelled loading new image.');
        }
    }
    // --- Updated Save Logic (Handles Multiple Sprites from potentially multiple sources) --- 
    async saveSpriteSheet(data) {
        console.log(`[SpriteImporterProvider] Starting sprite sheet save... Options:`, data.options);
        console.log(`[SpriteImporterProvider] Processing ${data.selections.length} sprite selections.`);
        const { selections, options } = data;
        const { format, bitDepth, targetPalette } = options;
        // Use custom sprite size if provided, otherwise default to 16x16
        const customSpriteWidth = data.spriteWidth || 16;
        const customSpriteHeight = data.spriteHeight || 16;
        const saveActualSize = data.saveActualSize !== undefined ? data.saveActualSize : true;
        if (customSpriteWidth !== 16 || customSpriteHeight !== 16) {
            console.log(`[SpriteImporterProvider] Using custom sprite size: ${customSpriteWidth}x${customSpriteHeight}, Save actual size: ${saveActualSize}`);
        }
        if (!selections || selections.length === 0) {
            vscode.window.showErrorMessage('Save failed: No sprites were selected/added to the list.');
            return;
        }
        // --- Image Data Cache (within function scope) --- 
        const imageDataCache = new Map();
        // --- Determine Target Palette for Quantization (same as before) --- 
        let paletteForQuantization;
        let targetPaletteSize = 256;
        if (bitDepth === 4) {
            targetPaletteSize = 16;
            if (!targetPalette || targetPalette.length < 16) {
                vscode.window.showErrorMessage('Import failed: A target palette with at least 16 colors must be loaded for 4-bit output.');
                return;
            }
            paletteForQuantization = targetPalette.slice(0, 16).map(hexTo8bitRgb);
        }
        else { // bitDepth === 8
            targetPaletteSize = 256;
            if (targetPalette && targetPalette.length > 0) {
                console.warn("[SpriteImporterProvider] Warning: Loaded target palette ignored for 8-bit output. Quantizing to default 256 palette.");
                paletteForQuantization = defaultPalette8bit;
                targetPaletteSize = 256;
            }
            else {
                paletteForQuantization = defaultPalette8bit;
                targetPaletteSize = 256;
            }
        }
        // --- Process Each Selection --- 
        const allPixelData = [];
        try {
            // Log the first selection rect received by the save function
            if (selections.length > 0) {
                console.log(`[SpriteImporterProvider] Save function received first selection rect:`, JSON.stringify(selections[0]));
            }
            for (const selection of selections) {
                // Determine sprite dimensions based on custom settings
                const selectionWidth = Math.max(1, Math.floor(selection.rect.w));
                const selectionHeight = Math.max(1, Math.floor(selection.rect.h));
                // If saving actual size, use custom dimensions; otherwise use selection dimensions
                const useWidth = saveActualSize ? customSpriteWidth : 16;
                const useHeight = saveActualSize ? customSpriteHeight : 16;
                const sourceFsPath = selection.sourceFsPath;
                const sourceExt = path.extname(sourceFsPath).toLowerCase();
                const isBmpFile = sourceExt === '.bmp';
                // --- Get Image Data (from cache or load) --- 
                let currentImageData = imageDataCache.get(sourceFsPath);
                if (!currentImageData) {
                    try {
                        console.log(`[SpriteImporterProvider] Loading image data for: ${sourceFsPath}`);
                        const fileData = await vscode.workspace.fs.readFile(vscode.Uri.file(sourceFsPath));
                        // Handle BMP files with Jimp, other formats with Sharp
                        if (isBmpFile) {
                            console.log(`[SpriteImporterProvider] Using Jimp to process BMP for sprite sheet`);
                            const jimpImage = await jimp_1.default.read(buffer_1.Buffer.from(fileData));
                            const rawBuffer = buffer_1.Buffer.from(jimpImage.bitmap.data);
                            currentImageData = {
                                data: rawBuffer,
                                info: {
                                    width: jimpImage.getWidth(),
                                    height: jimpImage.getHeight(),
                                    channels: 4 // Jimp always uses RGBA
                                },
                                isBmp: true
                            };
                        }
                        else {
                            const sharp_result = await (0, sharp_1.default)(fileData)
                                .ensureAlpha()
                                .raw()
                                .toBuffer({ resolveWithObject: true });
                            currentImageData = {
                                data: sharp_result.data,
                                info: sharp_result.info,
                                isBmp: false
                            };
                            if (currentImageData.info.channels !== 4) {
                                throw new Error(`Source image ${path.basename(sourceFsPath)} does not have 4 channels (RGBA).`);
                            }
                        }
                        imageDataCache.set(sourceFsPath, currentImageData);
                    }
                    catch (err) {
                        console.error(`[SpriteImporterProvider] Failed to load image ${sourceFsPath} for saving:`, err);
                        const message = err instanceof Error ? err.message : String(err);
                        // Show error and skip this sprite? Or abort whole save?
                        vscode.window.showErrorMessage(`Save failed: Could not load source image ${path.basename(sourceFsPath)}: ${message}`);
                        // Abort for now
                        return;
                    }
                }
                const sourceWidth = currentImageData.info.width;
                const sourceHeight = currentImageData.info.height;
                const sourceBuffer = currentImageData.data;
                console.log(`[SpriteImporterProvider] Processing selection from ${path.basename(sourceFsPath)}: ${selectionWidth}x${selectionHeight} at (${selection.rect.x}, ${selection.rect.y}), using dimensions: ${useWidth}x${useHeight}`);
                // Extract RGBA data for this specific selection from the sourceBuffer
                // Create a buffer for the actual sprite size (potentially different from selection size)
                const spriteRgba = buffer_1.Buffer.alloc(useWidth * useHeight * 4);
                // Fill with transparent black first (for any areas outside the selection)
                for (let i = 0; i < useWidth * useHeight * 4; i += 4) {
                    spriteRgba[i] = 0; // R
                    spriteRgba[i + 1] = 0; // G
                    spriteRgba[i + 2] = 0; // B
                    spriteRgba[i + 3] = 0; // A (transparent)
                }
                // Copy pixel data from source to sprite buffer
                for (let y = 0; y < Math.min(selectionHeight, useHeight); y++) {
                    for (let x = 0; x < Math.min(selectionWidth, useWidth); x++) {
                        const srcX = Math.floor(selection.rect.x) + x;
                        const srcY = Math.floor(selection.rect.y) + y;
                        // Check bounds of source image
                        if (srcX >= 0 && srcX < sourceWidth && srcY >= 0 && srcY < sourceHeight) {
                            const sourceIdx = (srcY * sourceWidth + srcX) * 4;
                            const destIdx = (y * useWidth + x) * 4;
                            sourceBuffer.copy(spriteRgba, destIdx, sourceIdx, sourceIdx + 4);
                        }
                    }
                }
                // Quantize THIS sprite's pixels
                const pixelIndices = new Array(useWidth * useHeight);
                for (let i = 0; i < useWidth * useHeight; i++) {
                    const r = spriteRgba[i * 4];
                    const g = spriteRgba[i * 4 + 1];
                    const b = spriteRgba[i * 4 + 2];
                    pixelIndices[i] = findClosestPaletteIndex(r, g, b, paletteForQuantization);
                }
                // Generate final pixel data buffer for THIS sprite
                let spritePixelData;
                if (bitDepth === 8) {
                    spritePixelData = buffer_1.Buffer.from(Uint8Array.from(pixelIndices));
                }
                else { // bitDepth === 4
                    // Pack the 4-bit indices tightly
                    const packed = buffer_1.Buffer.alloc(Math.ceil((useWidth * useHeight) / 2));
                    for (let i = 0; i < pixelIndices.length; i += 2) {
                        const idx1 = pixelIndices[i] & 0x0F;
                        const idx2 = (i + 1 < pixelIndices.length) ? (pixelIndices[i + 1] & 0x0F) : 0;
                        packed.writeUInt8((idx1 << 4) | idx2, i / 2);
                    }
                    spritePixelData = packed; // Use the tightly packed data directly
                }
                allPixelData.push(spritePixelData);
            } // End loop through selections
            // --- Concatenate all processed sprite data --- 
            let finalBuffer = buffer_1.Buffer.concat(allPixelData);
            console.log(`[SpriteImporterProvider] Concatenated buffer length for ${allPixelData.length} sprites: ${finalBuffer.length}`);
            // --- NEW: Pad final buffer for 4-bit if needed --- 
            const minimumFileSize = 256;
            if (bitDepth === 4 && finalBuffer.length < minimumFileSize) {
                const paddingSize = minimumFileSize - finalBuffer.length;
                console.log(`[SpriteImporterProvider] Padding 4-bit file with ${paddingSize} zero bytes to reach minimum size of ${minimumFileSize}.`);
                const padding = buffer_1.Buffer.alloc(paddingSize, 0);
                finalBuffer = buffer_1.Buffer.concat([finalBuffer, padding]);
                console.log(`[SpriteImporterProvider] Final padded buffer length: ${finalBuffer.length}`);
            }
            // --- Show Save Dialog and Write File --- 
            const saveUri = await vscode.window.showSaveDialog({
                title: `Save Imported ${format === 'til' ? 'Tile' : 'Sprite'} (${bitDepth}-bit)`,
                filters: { [format === 'til' ? 'Tile Files' : 'Sprite Files']: [format] }
            });
            if (saveUri) {
                console.log(`[SpriteImporterProvider] Attempting to write ${finalBuffer.length} bytes to ${saveUri.fsPath}`);
                await vscode.workspace.fs.writeFile(saveUri, finalBuffer);
                vscode.window.showInformationMessage(`Sprite sheet saved successfully (${allPixelData.length} sprites) to: ${path.basename(saveUri.fsPath)}. Relies on a separate palette.`);
            }
            else {
                console.log('[SpriteImporterProvider] Save cancelled by user.');
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to process or save sprite sheet: ${message}`);
            console.error('[SpriteImporterProvider] Error processing/saving sprite sheet:', error);
        }
    }
    // --- NEW: Method to Save Extracted Palette --- 
    async saveExtractedPaletteToFile(paletteHex) {
        console.log(`[SpriteImporterProvider] Received request to save extracted palette with ${paletteHex.length} colors.`);
        if (paletteHex.length === 0) {
            vscode.window.showWarningMessage('Cannot save empty palette.');
            return;
        }
        try {
            // Convert hex array to PaletteColor array (assuming no priority)
            const paletteToSave = paletteHex.map(hex => ({ hex, priority: false }));
            // Encode using the updated utility
            const saveData = (0, paletteUtils_1.encodePaletteFile)(paletteToSave);
            // Show save dialog
            const saveUri = await vscode.window.showSaveDialog({
                title: 'Save Extracted Palette As',
                filters: {
                    'Next Palette Files': ['nxp', 'pal'] // Allow both
                },
                // Suggest a default filename (optional)
                // defaultUri: vscode.Uri.joinPath(this._imageUri, '../extracted_palette.pal')
            });
            if (saveUri) {
                console.log(`[SpriteImporterProvider] Attempting to write ${saveData.length} bytes of palette data to ${saveUri.fsPath}`);
                await vscode.workspace.fs.writeFile(saveUri, saveData);
                vscode.window.showInformationMessage(`Extracted palette (${paletteHex.length} colors) saved successfully to: ${path.basename(saveUri.fsPath)}.`);
            }
            else {
                console.log('[SpriteImporterProvider] Palette save cancelled by user.');
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save extracted palette: ${message}`);
            console.error('[SpriteImporterProvider] Error saving extracted palette:', error);
        }
    }
    // --- NEW: Add saveAsBlockFile method --- 
    async saveAsBlockFile(data) {
        console.log(`[SpriteImporterProvider] Starting block file save... Grid: ${data.gridWidth}x${data.gridHeight}, Sprite size: ${data.spriteWidth}x${data.spriteHeight}, Save actual size: ${data.saveActualSize}`);
        if (!data.selections || data.selections.length === 0) {
            vscode.window.showErrorMessage('Save failed: No sprites were selected.');
            return;
        }
        // Calculate optimal grid dimensions if necessary
        let gridWidth = data.gridWidth;
        let gridHeight = data.gridHeight;
        let originalGrid = `${gridWidth}x${gridHeight}`;
        let expectedCount = gridWidth * gridHeight;
        // If we have more sprites than the grid can hold, adjust the dimensions
        if (data.selections.length > expectedCount) {
            // Try to maintain the aspect ratio while accommodating all sprites
            const aspectRatio = gridWidth / gridHeight;
            gridHeight = Math.ceil(Math.sqrt(data.selections.length / aspectRatio));
            gridWidth = Math.ceil(data.selections.length / gridHeight);
            // Ensure we have enough cells (might be slightly more than needed)
            expectedCount = gridWidth * gridHeight;
            if (expectedCount < data.selections.length) {
                gridWidth++; // Add one more column if necessary
                expectedCount = gridWidth * gridHeight;
            }
            // Ask user to confirm the adjustment
            const proceed = await vscode.window.showInformationMessage(`Adjusting grid from ${originalGrid} to ${gridWidth}x${gridHeight} to fit all ${data.selections.length} sprites. Continue?`, 'Yes', 'No');
            if (proceed !== 'Yes') {
                console.log('[SpriteImporterProvider] Block save cancelled after grid adjustment.');
                return;
            }
        }
        else if (data.selections.length < expectedCount) {
            const proceed = await vscode.window.showWarningMessage(`The selection list contains ${data.selections.length} sprites, but the grid is ${gridWidth}x${gridHeight} (${expectedCount} cells). Some cells will be empty (value 0). Continue?`, 'Yes', 'No');
            if (proceed !== 'Yes') {
                console.log('[SpriteImporterProvider] Block save cancelled due to incomplete grid.');
                return;
            }
        }
        try {
            // For a proper block file, we need to:
            // 1. First export the sprites to a sprite sheet
            // 2. Then create a block file referencing indices in that sprite sheet
            // Show save dialog for the sprite sheet first
            const spriteSheetUri = await vscode.window.showSaveDialog({
                title: `Save Sprite Sheet for Block`,
                filters: { 'Sprite Files': [data.options.format] }
            });
            if (!spriteSheetUri) {
                console.log('[SpriteImporterProvider] Block creation cancelled - no sprite sheet location selected.');
                return;
            }
            // Check if source is BMP - add special handling if needed
            const firstSourcePath = data.selections[0]?.sourceFsPath;
            const isBmpSource = firstSourcePath && path.extname(firstSourcePath).toLowerCase() === '.bmp';
            if (isBmpSource) {
                console.log(`[SpriteImporterProvider] Block creation involves BMP files - using special handling`);
            }
            // Now save the sprite sheet (reuse existing saveSpriteSheet method)
            console.log(`[SpriteImporterProvider] Saving sprite sheet to ${spriteSheetUri.fsPath} for block...`);
            await this.saveSpriteSheet({
                selections: data.selections,
                options: data.options,
                // Pass along the sprite size parameters
                spriteWidth: data.spriteWidth,
                spriteHeight: data.spriteHeight,
                saveActualSize: data.saveActualSize
            });
            // Ask for block file location
            const blockUri = await vscode.window.showSaveDialog({
                title: `Save Block File (${gridWidth}x${gridHeight})`,
                filters: { 'Block Files': ['nxb'] }
            });
            if (!blockUri) {
                console.log('[SpriteImporterProvider] Block file save cancelled.');
                return;
            }
            // Create the block file with indices
            const blockIndices = new Uint8Array(expectedCount);
            // Fill with indices (matching the sprite sheet's order)
            for (let i = 0; i < Math.min(expectedCount, data.selections.length); i++) {
                blockIndices[i] = i; // Use the index in the sprite sheet
            }
            // Fill any remaining slots with 0s (if grid is larger than selection count)
            for (let i = data.selections.length; i < expectedCount; i++) {
                blockIndices[i] = 0;
            }
            console.log(`[SpriteImporterProvider] Writing ${blockIndices.length} bytes to ${blockUri.fsPath}`);
            await vscode.workspace.fs.writeFile(blockUri, blockIndices);
            const spriteInfoText = data.saveActualSize ?
                `Sprite size: ${data.spriteWidth}x${data.spriteHeight}` :
                `Sprite size: ${data.spriteWidth}x${data.spriteHeight} (will be padded to 16px)`;
            vscode.window.showInformationMessage(`Block file saved successfully (${gridWidth}x${gridHeight} grid) to: ${path.basename(blockUri.fsPath)}\n` +
                `Using sprites from: ${path.basename(spriteSheetUri.fsPath)}\n` +
                spriteInfoText);
            // Optionally offer to open in block viewer
            const openInViewer = await vscode.window.showInformationMessage('Would you like to open this block file in the Block Viewer?', 'Yes', 'No');
            if (openInViewer === 'Yes') {
                await vscode.commands.executeCommand('vscode.openWith', blockUri, 'nextbuild-viewers.blockViewer');
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to save block file: ${message}`);
            console.error('[SpriteImporterProvider] Error saving block file:', error);
        }
    }
    // New method to handle BMP files specifically with Jimp
    async handleBmpWithJimp(fileData) {
        console.log('[SpriteImporterProvider] Processing BMP file with Jimp');
        try {
            // Read the BMP with Jimp
            const image = await jimp_1.default.read(buffer_1.Buffer.from(fileData));
            const width = image.getWidth();
            const height = image.getHeight();
            // Get raw RGBA data
            const pixelDataBuffer = buffer_1.Buffer.from(image.bitmap.data);
            const pixelDataBase64 = pixelDataBuffer.toString('base64');
            console.log(`[SpriteImporterProvider] Successfully processed BMP with Jimp (${width}x${height})`);
            this._panel.webview.postMessage({
                command: 'loadImageData',
                data: {
                    width: width,
                    height: height,
                    pixelDataBase64: pixelDataBase64,
                    currentImageFsPath: this._currentImageFsPath
                }
            });
        }
        catch (e) {
            console.error('[SpriteImporterProvider] Failed to process BMP with Jimp:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            this._panel.webview.postMessage({ command: 'showError', text: `Failed to process BMP: ${errorMessage}` });
            vscode.window.showErrorMessage(`Failed to process BMP image: ${errorMessage}`);
        }
    }
    // Generic fallback for any image format with Jimp
    async handleWithJimp() {
        console.log('[SpriteImporterProvider] Attempting to process image with Jimp fallback');
        const fileData = await vscode.workspace.fs.readFile(this._imageUri);
        const image = await jimp_1.default.read(buffer_1.Buffer.from(fileData));
        const width = image.getWidth();
        const height = image.getHeight();
        // Get raw RGBA data
        const pixelDataBuffer = buffer_1.Buffer.from(image.bitmap.data);
        const pixelDataBase64 = pixelDataBuffer.toString('base64');
        console.log(`[SpriteImporterProvider] Successfully processed with Jimp fallback (${width}x${height})`);
        this._panel.webview.postMessage({
            command: 'loadImageData',
            data: {
                width: width,
                height: height,
                pixelDataBase64: pixelDataBase64,
                currentImageFsPath: this._currentImageFsPath
            }
        });
    }
    // New utility method to convert images to PNG
    async convertImageToPNG(sourceUri) {
        try {
            // Show processing status
            vscode.window.setStatusBarMessage(`Converting ${path.basename(sourceUri.fsPath)} to PNG...`, 1000);
            // Read source file
            const fileData = await vscode.workspace.fs.readFile(sourceUri);
            // Create a destination path by changing extension to .png
            const parsedPath = path.parse(sourceUri.fsPath);
            const destPath = path.join(parsedPath.dir, parsedPath.name + '.png');
            const destUri = vscode.Uri.file(destPath);
            // Try Jimp first for BMP files
            if (path.extname(sourceUri.fsPath).toLowerCase() === '.bmp') {
                console.log('[SpriteImporterProvider] Using Jimp to convert BMP to PNG');
                const image = await jimp_1.default.read(buffer_1.Buffer.from(fileData));
                await image.writeAsync(destPath);
            }
            else {
                // Convert to PNG using sharp
                const pngData = await (0, sharp_1.default)(fileData, {
                    failOn: 'none' // Be forgiving of format issues
                }).png().toBuffer();
                // Write PNG file
                await vscode.workspace.fs.writeFile(destUri, pngData);
            }
            // Show success message with options
            const success = await vscode.window.showInformationMessage(`Successfully converted to ${path.basename(destPath)}`, 'Open in Importer', 'Open File');
            if (success === 'Open in Importer') {
                // Close current panel if open
                if (this._panel) {
                    this._panel.dispose();
                }
                // Create a new importer with the PNG file
                new SpriteImporterProvider(this.context, destUri);
            }
            else if (success === 'Open File') {
                // Just open the file in VS Code
                vscode.commands.executeCommand('vscode.open', destUri);
            }
        }
        catch (error) {
            console.error('[SpriteImporterProvider] Error converting image to PNG:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to convert image to PNG: ${errorMessage}`);
        }
    }
    async handleImageConversion(options) {
        try {
            console.log('[SpriteImporterProvider] ENTERING handleImageConversion method with options:', JSON.stringify(options)); // Log at the very start
            if (!options) {
                console.error('[SpriteImporterProvider] handleImageConversion called with no options!');
                vscode.window.showErrorMessage('Image conversion failed: No options provided.');
                return;
            }
            console.log('[SpriteImporterProvider] Received raw options for image conversion:', JSON.stringify(options));
            // Ensure bitDepth is treated as a number
            const bitDepth = parseInt(options.bitDepth, 10);
            if (isNaN(bitDepth)) {
                console.warn(`[SpriteImporterProvider] Invalid bitDepth received: ${options.bitDepth}, defaulting to 8.`);
                options.bitDepth = 8; // Default to 8 if parsing fails
            }
            else {
                options.bitDepth = bitDepth; // Use the parsed numeric value
            }
            console.log(`[SpriteImporterProvider] Starting image conversion with processed options (bitDepth type: ${typeof options.bitDepth}):`, JSON.stringify(options));
            // Read the image data
            const fileData = await vscode.workspace.fs.readFile(this._imageUri);
            console.log(`[SpriteImporterProvider] Read image data: ${fileData.length} bytes`);
            // Process the image according to the conversion options
            let pipeline = (0, sharp_1.default)(fileData);
            // Ensure we use exact dimensions for standard resolutions
            let width = options.width || 320;
            let height = options.height || 256;
            // Special case for 640x256 - always force 4-bit mode
            const is640x256 = width === 640 && height === 256;
            if (is640x256) {
                console.log('[SpriteImporterProvider] 640x256 format detected - forcing 4-bit mode');
                options.bitDepth = 4;
            }
            // Ensure standard dimensions are exactly as expected
            if ((width === 256 && height === 192) ||
                (width === 320 && height === 256) ||
                (width === 640 && height === 256)) {
                console.log(`[SpriteImporterProvider] Using exact standard dimensions: ${width}x${height}`);
                // Force exact dimensions by creating a blank canvas of the exact size
                // and then compositing the resized image onto it
                pipeline = pipeline.resize({
                    width: width,
                    height: height,
                    fit: options.preserveAspect ? 'inside' : 'fill',
                    // Don't allow dimensions to be reduced to maintain aspect ratio
                    withoutEnlargement: false,
                    withoutReduction: false
                });
            }
            else if (options.width && options.height) {
                console.log(`[SpriteImporterProvider] Resizing to custom dimensions: ${options.width}x${options.height}, preserveAspect: ${options.preserveAspect}`);
                pipeline = pipeline.resize({
                    width: options.width,
                    height: options.height,
                    fit: options.preserveAspect ? 'inside' : 'fill'
                });
            }
            // Get the image data as raw pixels
            const { data: rawPixelsBuffer, info: initialInfo } = await pipeline
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
            console.log(`[SpriteImporterProvider] Initial processed raw pixels: ${initialInfo.width}x${initialInfo.height}, channels: ${initialInfo.channels}`);
            let finalImageDataForNXI = rawPixelsBuffer;
            let finalWidth = initialInfo.width;
            let finalHeight = initialInfo.height;
            // Ensure dimensions are exact if they are standard, or use custom and potentially pad
            const requestedWidth = options.width || 320;
            const requestedHeight = options.height || 256;
            if ((requestedWidth === 256 && requestedHeight === 192) ||
                (requestedWidth === 320 && requestedHeight === 256) ||
                (requestedWidth === 640 && requestedHeight === 256) ||
                options.width && options.height) { // Also applies if custom dimensions are given
                if (initialInfo.width !== requestedWidth || initialInfo.height !== requestedHeight) {
                    console.warn(`[SpriteImporterProvider] Warning: Output dimensions (${initialInfo.width}x${initialInfo.height}) don't match requested dimensions (${requestedWidth}x${requestedHeight}). Adjusting.`);
                    const exactSizeBuffer = buffer_1.Buffer.alloc(requestedWidth * requestedHeight * 4, 0); // RGBA, fill with black/transparent
                    // Composite the resized image onto the center of the exactSizeBuffer
                    // This requires sharp to do another operation if we want good resizing into the allocated buffer
                    // For simplicity here, we will assume the previous resize was to these dimensions
                    // or that we need to take the rawPixelsBuffer and place it. 
                    // This part might need refinement if the pipeline.resize didn't hit exact dimensions
                    // and options.preserveAspect was 'inside'.
                    // Let's assume rawPixelsBuffer needs to be placed onto exactSizeBuffer
                    // This is a simplified placement, for more complex scenarios, use sharp.composite
                    const offsetX = Math.max(0, Math.floor((requestedWidth - initialInfo.width) / 2));
                    const offsetY = Math.max(0, Math.floor((requestedHeight - initialInfo.height) / 2));
                    for (let y = 0; y < initialInfo.height; y++) {
                        for (let x = 0; x < initialInfo.width; x++) {
                            const srcIdx = (y * initialInfo.width + x) * 4;
                            const destX = x + offsetX;
                            const destY = y + offsetY;
                            if (destX < requestedWidth && destY < requestedHeight) {
                                const destIdx = (destY * requestedWidth + destX) * 4;
                                rawPixelsBuffer.copy(exactSizeBuffer, destIdx, srcIdx, srcIdx + 4);
                            }
                        }
                    }
                    finalImageDataForNXI = exactSizeBuffer;
                    finalWidth = requestedWidth;
                    finalHeight = requestedHeight;
                    console.log(`[SpriteImporterProvider] Image data adjusted to exact size: ${finalWidth}x${finalHeight}`);
                }
                else {
                    // Dimensions already match
                    finalWidth = requestedWidth;
                    finalHeight = requestedHeight;
                }
            }
            // Special case for 640x256: force 4-bit if not already 9-bit. (9-bit takes precedence)
            if (finalWidth === 640 && finalHeight === 256 && options.bitDepth !== 9) {
                console.log('[SpriteImporterProvider] 640x256 format detected - forcing 4-bit mode as 9-bit is not selected.');
                options.bitDepth = 4;
            }
            // Define is640x256_4bit after final dimensions and bitDepth are set
            const is640x256_4bit = finalWidth === 640 && finalHeight === 256 && options.bitDepth === 4;
            let targetPalette = null;
            if (options.bitDepth === 9) {
                console.log(`[SpriteImporterProvider] Extracting optimal palette (up to 256 colors) for 9-bit custom mode.`);
                targetPalette = await this.extractOptimalPalette(finalImageDataForNXI, finalWidth, finalHeight, 256);
                console.log(`[SpriteImporterProvider] Extracted ${targetPalette ? targetPalette.length : '0'} colors for 9-bit custom palette. First few: ${targetPalette ? JSON.stringify(targetPalette.slice(0, 3)) : 'N/A'}`);
            }
            else if (is640x256_4bit) {
                console.log(`[SpriteImporterProvider] Extracting optimal 16-color palette for 640x256 4-bit mode.`);
                targetPalette = await this.extractOptimalPalette(finalImageDataForNXI, finalWidth, finalHeight, 16);
                console.log(`[SpriteImporterProvider] Extracted ${targetPalette ? targetPalette.length : '0'} colors for 4-bit palette.`);
            }
            else if (options.bitDepth === 4) { // Other 4-bit modes
                if (options.paletteType === 'loaded' && options.loadedPalette && options.loadedPalette.length >= 16) {
                    console.log(`[SpriteImporterProvider] Using loaded palette for 4-bit mode.`);
                    targetPalette = options.loadedPalette.slice(0, 16);
                }
                else {
                    console.log(`[SpriteImporterProvider] Extracting optimal 16-color palette for generic 4-bit mode.`);
                    targetPalette = await this.extractOptimalPalette(finalImageDataForNXI, finalWidth, finalHeight, 16);
                }
                console.log(`[SpriteImporterProvider] Using/Extracted ${targetPalette ? targetPalette.length : '0'} colors for 4-bit palette.`);
            }
            else if (options.paletteType === 'loaded' && options.loadedPalette) {
                console.log(`[SpriteImporterProvider] Using loaded palette with ${options.loadedPalette ? options.loadedPalette.length : '0'} colors for 8-bit mode.`);
                targetPalette = options.loadedPalette;
            }
            else if (options.paletteType === 'grayscale') {
                console.log(`[SpriteImporterProvider] Creating grayscale palette for ${options.bitDepth}-bit mode.`);
                const numGrays = 256; // Grayscale is typically 8-bit for NXI unless it was a 4-bit request handled above
                targetPalette = Array(numGrays).fill(0).map((_, i) => {
                    const v = Math.floor(i * 255 / (numGrays - 1)).toString(16).padStart(2, '0');
                    return `#${v}${v}${v}`;
                });
            }
            else {
                console.log(`[SpriteImporterProvider] Using default 8-bit palette logic (targetPalette will be null, createNXIFile handles this).`);
                // targetPalette remains null, createNXIFile will use its internal default for 8-bit
            }
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Converting image to NXI format...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: 'Processing pixels...' });
                console.log(`[SpriteImporterProvider] About to call createNXIFile. Final effective bitDepth: ${options.bitDepth}`);
                if (options.bitDepth === 9) {
                    console.log(`[SpriteImporterProvider] Target palette for 9-bit mode (to be passed to createNXIFile) has ${targetPalette ? targetPalette.length : 'null/0'} colors.`);
                }
                const nxiData = await this.createNXIFile(finalImageDataForNXI, finalWidth, finalHeight, options.bitDepth, targetPalette, options.dithering || 'none');
                console.log(`[SpriteImporterProvider] NXI data created: ${nxiData.length} bytes`);
                progress.report({ increment: 75, message: 'Saving file...' });
                // Save the file
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(path.join(path.dirname(this._imageUri.fsPath), `${path.basename(this._imageUri.fsPath, path.extname(this._imageUri.fsPath))}.nxi`)),
                    filters: {
                        'NXI Files': ['nxi']
                    }
                });
                if (uri) {
                    console.log(`[SpriteImporterProvider] Saving NXI file to ${uri.fsPath}`);
                    await vscode.workspace.fs.writeFile(uri, nxiData);
                    // Report dimensions and format to the user
                    const formatDescription = options.bitDepth === 4 ?
                        `${finalWidth}x${finalHeight}, 4-bit` :
                        `${finalWidth}x${finalHeight}, 8-bit`;
                    progress.report({ increment: 100, message: 'Done!' });
                    console.log(`[SpriteImporterProvider] NXI file saved successfully: ${formatDescription}`);
                    // Ask if user wants to open the new file in the image viewer
                    const openResult = await vscode.window.showInformationMessage(`NXI file created successfully (${formatDescription}). Would you like to open it in the Image Viewer?`, 'Open', 'No');
                    if (openResult === 'Open') {
                        // Open the file in the image viewer
                        await vscode.commands.executeCommand('vscode.openWith', uri, 'nextbuild-viewers.imageViewer');
                    }
                }
                else {
                    console.log(`[SpriteImporterProvider] User cancelled save dialog`);
                }
            });
            return; // Exit early since we handled this case specifically
        }
        catch (error) {
            console.error('[SpriteImporterProvider] Error during image conversion:', error);
            vscode.window.showErrorMessage(`Error converting image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // Enhanced method for optimal palette extraction with better color diversity
    async extractOptimalPalette(pixelData, width, height, maxColors) {
        console.log(`[SpriteImporterProvider] Extracting optimal palette with color diversity preservation, max ${maxColors} colors`);
        // Step 1: Collect all unique colors and their frequency
        const colorMap = new Map();
        // Scan the image and count unique colors
        for (let i = 0; i < width * height; i++) {
            const idx = i * 4;
            const r = pixelData[idx];
            const g = pixelData[idx + 1];
            const b = pixelData[idx + 2];
            const a = pixelData[idx + 3];
            // Skip transparent pixels
            if (a < 128) {
                continue;
            }
            // Create a key for this color
            const colorKey = `${r},${g},${b}`;
            // Update the color count
            if (colorMap.has(colorKey)) {
                colorMap.get(colorKey).count++;
            }
            else {
                colorMap.set(colorKey, { count: 1, r, g, b });
            }
        }
        console.log(`[SpriteImporterProvider] Found ${colorMap.size} unique colors in image`);
        // If we have fewer unique colors than maxColors, just use them all
        if (colorMap.size <= maxColors) {
            // Convert to hex format
            const palette = Array.from(colorMap.values()).map(color => {
                const rHex = color.r.toString(16).padStart(2, '0');
                const gHex = color.g.toString(16).padStart(2, '0');
                const bHex = color.b.toString(16).padStart(2, '0');
                return `#${rHex}${gHex}${bHex}`;
            });
            // Ensure we have exactly maxColors by padding with black if needed
            while (palette.length < maxColors) {
                palette.push('#000000');
            }
            return palette;
        }
        // Step 2: Always include black and white
        const finalPalette = ['#000000']; // Start with black
        // Find white or the brightest color
        const whiteThreshold = 220;
        const whiteColor = Array.from(colorMap.values()).find(c => c.r >= whiteThreshold && c.g >= whiteThreshold && c.b >= whiteThreshold);
        if (whiteColor) {
            const whiteHex = `#${whiteColor.r.toString(16).padStart(2, '0')}${whiteColor.g.toString(16).padStart(2, '0')}${whiteColor.b.toString(16).padStart(2, '0')}`;
            finalPalette.push(whiteHex);
            // Remove white from consideration
            const whiteKey = `${whiteColor.r},${whiteColor.g},${whiteColor.b}`;
            colorMap.delete(whiteKey);
        }
        else {
            finalPalette.push('#FFFFFF'); // Add pure white if no white-ish color found
        }
        // Step 3: Color Space Division (Modified Median Cut)
        // Allocate color slots for different regions of the color space
        const colorSpaceRegions = [
            {
                name: "Reds",
                test: (r, g, b) => r > 1.5 * Math.max(g, b),
                slots: 0.15,
                colors: []
            },
            {
                name: "Greens",
                test: (r, g, b) => g > 1.5 * Math.max(r, b),
                slots: 0.15,
                colors: []
            },
            {
                name: "Blues",
                test: (r, g, b) => b > 1.5 * Math.max(r, g),
                slots: 0.15,
                colors: []
            },
            {
                name: "Yellows",
                test: (r, g, b) => r > 170 && g > 170 && b < 100,
                slots: 0.125,
                colors: []
            },
            {
                name: "Cyans",
                test: (r, g, b) => b > 170 && g > 170 && r < 100,
                slots: 0.125,
                colors: []
            },
            {
                name: "Magentas",
                test: (r, g, b) => r > 170 && b > 170 && g < 100,
                slots: 0.125,
                colors: []
            },
            {
                name: "Grays",
                test: (r, g, b) => Math.abs(r - g) < 30 && Math.abs(r - b) < 30 && Math.abs(g - b) < 30,
                slots: 0.10,
                colors: []
            },
            {
                name: "Others",
                test: () => true, // Catch remaining colors
                slots: 0.075,
                colors: []
            }
        ];
        // Categorize each color into its appropriate region
        for (const color of colorMap.values()) {
            // Calculate color importance (frequency and saturation)
            const { r, g, b, count } = color;
            // Max component defines saturation intensity
            const maxComponent = Math.max(r, g, b);
            const saturation = maxComponent > 0 ? (maxComponent - Math.min(r, g, b)) / maxComponent : 0;
            // Calculate perceived brightness
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            // Find the first matching region
            for (const region of colorSpaceRegions) {
                if (region.test(r, g, b)) {
                    region.colors.push({
                        ...color,
                        importance: Math.sqrt(count) * (1 + saturation + brightness / 255) // Importance formula
                    });
                    break; // Assign to first matching region only
                }
            }
        }
        // Calculate how many slots to allocate to each region
        const remainingSlots = maxColors - finalPalette.length;
        let allocatedSlots = 0;
        // First pass: calculate slots based on percentages and actual colors available
        for (const region of colorSpaceRegions) {
            // Calculate ideal slot count based on percentage
            let slotsForRegion = Math.round(remainingSlots * region.slots);
            // Cap at the number of colors available in this region
            slotsForRegion = Math.min(slotsForRegion, region.colors.length);
            // Store the actual allocation
            region.slots = slotsForRegion;
            allocatedSlots += slotsForRegion;
        }
        // Handle any remaining slots due to rounding
        let extraSlots = remainingSlots - allocatedSlots;
        // Distribute remaining slots
        if (extraSlots > 0) {
            // Sort regions by the difference between colors available and slots allocated
            const regionsByNeed = [...colorSpaceRegions]
                .filter(r => r.colors.length > r.slots) // Only consider regions that can take more slots
                .sort((a, b) => (b.colors.length - b.slots) - (a.colors.length - a.slots));
            // Distribute extra slots
            for (let i = 0; i < extraSlots && i < regionsByNeed.length; i++) {
                regionsByNeed[i].slots += 1;
            }
        }
        // Step 4: Select colors from each region
        for (const region of colorSpaceRegions) {
            if (region.slots <= 0 || region.colors.length === 0)
                continue;
            // Sort by importance
            region.colors.sort((a, b) => b.importance - a.importance);
            // Take top colors from this region
            const selectedColors = region.colors.slice(0, region.slots);
            console.log(`[SpriteImporterProvider] Selected ${selectedColors.length} colors from ${region.name} region`);
            // Add to final palette
            for (const color of selectedColors) {
                const hex = `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`;
                finalPalette.push(hex);
            }
        }
        // Ensure we have exactly maxColors colors
        while (finalPalette.length < maxColors) {
            finalPalette.push('#000000');
        }
        // Trim if we somehow got too many
        if (finalPalette.length > maxColors) {
            finalPalette.splice(maxColors);
        }
        // Convert the palette to ZX Next's 9-bit RGB format
        const zxNextPalette = finalPalette.map(hexColor => {
            const rgb9 = (0, paletteUtils_1.hexToRgb9)(hexColor);
            return (0, paletteUtils_1.rgb9ToHex)(rgb9.r9, rgb9.g9, rgb9.b9);
        });
        console.log(`[SpriteImporterProvider] Created optimized palette with better color diversity (${zxNextPalette.length} colors)`);
        return zxNextPalette;
    }
    // Add the missing createNXIFile method
    async createNXIFile(pixelData, width, height, bitDepth, targetPalette, ditheringMode) {
        console.log(`[SpriteImporterProvider] createNXIFile CALLED with bitDepth: ${bitDepth}, targetPalette ${targetPalette ? 'exists (' + targetPalette.length + ' colors)' : 'is null/empty'}, dithering: ${ditheringMode}`);
        // Special handling for 640x256 4-bit format
        const is640x256_4bit = width === 640 && height === 256 && bitDepth === 4;
        const is320x256 = width === 320 && height === 256;
        const is9bit_custom = bitDepth === 9; // Check for 9-bit custom mode
        console.log(`[SpriteImporterProvider] createNXIFile: is9bit_custom is ${is9bit_custom}. Initial bitDepth was ${bitDepth}.`);
        // Initialize finalData here at the beginning
        let finalData = new Uint8Array(width * height);
        // Prepare the palette for quantization
        let paletteForQuantization = [];
        if (targetPalette && targetPalette.length > 0) {
            // Convert hex palette to RGB with proper ZX Next color mapping
            paletteForQuantization = targetPalette.slice(0, bitDepth === 4 ? 16 : 256).map(hex => {
                // Convert hex to 9-bit RGB (3-3-3)
                const rgb9 = this.hexToRgb9(hex);
                // Map back to 8-bit using the ZX Next's specific mapping table
                return {
                    r: RGB3_TO_8_MAP[rgb9.r9],
                    g: RGB3_TO_8_MAP[rgb9.g9],
                    b: RGB3_TO_8_MAP[rgb9.b9]
                };
            });
            console.log(`[SpriteImporterProvider] Using provided palette with ${paletteForQuantization.length} colors mapped to ZX Next 9-bit color space`);
        }
        else {
            // Use default palette - map directly from the RGB3_TO_8_MAP
            paletteForQuantization = defaultPalette8bit;
            console.log(`[SpriteImporterProvider] Using default palette with ${paletteForQuantization.length} colors in ZX Next color space`);
        }
        // Log first few colors of the palette for debugging
        if (paletteForQuantization.length > 0) {
            const firstColors = paletteForQuantization.slice(0, 5).map(c => `RGB(${c.r.toString(16)},${c.g.toString(16)},${c.b.toString(16)})`).join(', ');
            console.log(`[SpriteImporterProvider] First 5 palette colors for quantization: ${firstColors}`);
        }
        // Limit palette size based on bit depth
        const maxColors = (bitDepth === 4) ? 16 : (is9bit_custom ? (targetPalette?.length || 256) : 256);
        paletteForQuantization = paletteForQuantization.slice(0, maxColors);
        // For dithering, we need to track error diffusion
        let errors = null;
        // Choose dithering method based on mode
        if (ditheringMode === 'floydSteinberg' || ditheringMode === 'sierra') {
            // Initialize error diffusion matrix [height][width][3 channels]
            errors = Array(height).fill(0).map(() => Array(width).fill(0).map(() => [0, 0, 0]));
        }
        // Use perceptual color matching for better quality
        const usePerceptual = true; // Always use perceptual matching for better quality
        // Process each pixel using improved color matching
        console.log(`[SpriteImporterProvider] Processing image using ${usePerceptual ? 'perceptual' : 'standard'} color matching`);
        // Counter for non-zero indices to check if we're getting black images
        let nonZeroIndices = 0;
        // First pass: Quantize all pixels to their nearest palette color
        for (let y = 0; y < height; y++) {
            // Serpentine processing for Sierra dithering
            const serpentine = (ditheringMode === 'sierra') && (y % 2 === 1);
            for (let x_iter = 0; x_iter < width; x_iter++) {
                const x = serpentine ? (width - 1 - x_iter) : x_iter;
                const i = (y * width + x) * 4;
                // Skip if out of bounds
                if (i + 3 >= pixelData.length)
                    continue;
                // Get original colors
                let r = pixelData[i];
                let g = pixelData[i + 1];
                let b = pixelData[i + 2];
                const a = pixelData[i + 3];
                // Skip transparent pixels (use index 0)
                if (a < 128) {
                    finalData[y * width + x] = 0;
                    continue;
                }
                // Apply previous errors for dithering
                if (ditheringMode === 'floydSteinberg' && errors) {
                    r = Math.max(0, Math.min(255, r + errors[y][x][0]));
                    g = Math.max(0, Math.min(255, g + errors[y][x][1]));
                    b = Math.max(0, Math.min(255, b + errors[y][x][2]));
                }
                else if (ditheringMode === 'sierra' && errors) {
                    r = Math.max(0, Math.min(255, r + errors[y][x][0]));
                    g = Math.max(0, Math.min(255, g + errors[y][x][1]));
                    b = Math.max(0, Math.min(255, b + errors[y][x][2]));
                }
                // Log a sample of the input pixels for debugging
                if (y % 50 === 0 && x % 50 === 0) {
                    console.log(`[SpriteImporterProvider] Sample pixel at (${x},${y}): RGB(${r},${g},${b})`);
                }
                // Find closest color in the palette using perceptual matching if enabled
                let colorIndex;
                if (usePerceptual) {
                    // Make sure we're calling the instance method with 'this'
                    colorIndex = this.findClosestPerceptualColorIndex(r, g, b, paletteForQuantization);
                }
                else {
                    colorIndex = findClosestPaletteIndex(r, g, b, paletteForQuantization);
                }
                // Count non-zero indices to check if we're getting valid colors
                if (colorIndex > 0)
                    nonZeroIndices++;
                finalData[y * width + x] = colorIndex;
                // For dithering, distribute the error
                if ((ditheringMode === 'floydSteinberg' || ditheringMode === 'sierra') && errors) {
                    const palColor = paletteForQuantization[colorIndex];
                    const errorR = r - palColor.r;
                    const errorG = g - palColor.g;
                    const errorB = b - palColor.b;
                    if (ditheringMode === 'floydSteinberg' && errors) {
                        // Floyd-Steinberg error distribution (standard)
                        if (x < width - 1) { // Right
                            errors[y][x + 1][0] += (errorR * 7 / 16);
                            errors[y][x + 1][1] += (errorG * 7 / 16);
                            errors[y][x + 1][2] += (errorB * 7 / 16);
                        }
                        if (y < height - 1) {
                            if (x > 0) { // Bottom-left
                                errors[y + 1][x - 1][0] += (errorR * 3 / 16);
                                errors[y + 1][x - 1][1] += (errorG * 3 / 16);
                                errors[y + 1][x - 1][2] += (errorB * 3 / 16);
                            }
                            errors[y + 1][x][0] += (errorR * 5 / 16); // Bottom
                            errors[y + 1][x][1] += (errorG * 5 / 16);
                            errors[y + 1][x][2] += (errorB * 5 / 16);
                            if (x < width - 1) { // Bottom-right
                                errors[y + 1][x + 1][0] += (errorR * 1 / 16);
                                errors[y + 1][x + 1][1] += (errorG * 1 / 16);
                                errors[y + 1][x + 1][2] += (errorB * 1 / 16);
                            }
                        }
                    }
                    else if (ditheringMode === 'sierra' && errors) {
                        // Sierra-Lite error distribution with serpentine processing
                        if (!serpentine) { // Processing left-to-right
                            if (x < width - 1) { // Right pixel (2/4)
                                errors[y][x + 1][0] += (errorR * 2 / 4);
                                errors[y][x + 1][1] += (errorG * 2 / 4);
                                errors[y][x + 1][2] += (errorB * 2 / 4);
                            }
                            if (y < height - 1) {
                                if (x > 0) { // Bottom-left pixel (1/4)
                                    errors[y + 1][x - 1][0] += (errorR * 1 / 4);
                                    errors[y + 1][x - 1][1] += (errorG * 1 / 4);
                                    errors[y + 1][x - 1][2] += (errorB * 1 / 4);
                                }
                                errors[y + 1][x][0] += (errorR * 1 / 4); // Bottom pixel (1/4)
                                errors[y + 1][x][1] += (errorG * 1 / 4);
                                errors[y + 1][x][2] += (errorB * 1 / 4);
                            }
                        }
                        else { // Processing right-to-left (serpentine)
                            if (x > 0) { // Left pixel (2/4)
                                errors[y][x - 1][0] += (errorR * 2 / 4);
                                errors[y][x - 1][1] += (errorG * 2 / 4);
                                errors[y][x - 1][2] += (errorB * 2 / 4);
                            }
                            if (y < height - 1) {
                                if (x < width - 1) { // Bottom-right pixel (1/4)
                                    errors[y + 1][x + 1][0] += (errorR * 1 / 4);
                                    errors[y + 1][x + 1][1] += (errorG * 1 / 4);
                                    errors[y + 1][x + 1][2] += (errorB * 1 / 4);
                                }
                                errors[y + 1][x][0] += (errorR * 1 / 4); // Bottom pixel (1/4)
                                errors[y + 1][x][1] += (errorG * 1 / 4);
                                errors[y + 1][x][2] += (errorB * 1 / 4);
                            }
                        }
                    }
                }
            }
        }
        // Log the total non-zero indices for debugging
        console.log(`[SpriteImporterProvider] Quantization resulted in ${nonZeroIndices} non-zero pixel indices out of ${width * height} total pixels`);
        // Count frequency of each color index for debugging
        const indexCounts = new Map();
        for (let i = 0; i < finalData.length; i++) {
            const idx = finalData[i];
            indexCounts.set(idx, (indexCounts.get(idx) || 0) + 1);
        }
        console.log(`[SpriteImporterProvider] Color index distribution: ${Array.from(indexCounts.entries()).slice(0, 10).map(([idx, count]) => `${idx}:${count}`).join(', ')}...`);
        // Second pass: Pack the indexed data
        let outputData;
        // Handle different formats
        if (is640x256_4bit) {
            console.log(`[SpriteImporterProvider] Using column-oriented layout for 640x256 4-bit format`);
            // For 640x256 4-bit, we need to pack 2 pixels per byte in column-major order
            const packedSize = Math.ceil((width * height) / 2);
            const packedData = new Uint8Array(packedSize);
            // Pack pixels in column-major order (x changes fastest) with block optimization
            const blockSize = 8; // 8x8 pixel blocks for cache optimization
            let packedIndex = 0;
            // Column-major order for 640x256 format means we traverse columns first
            for (let xBlock = 0; xBlock < width; xBlock += 2) {
                for (let yBlock = 0; yBlock < height; yBlock += blockSize) {
                    // Process a vertical block of pixels
                    const blockHeight = Math.min(blockSize, height - yBlock);
                    for (let y = yBlock; y < yBlock + blockHeight; y++) {
                        // Pack two horizontal pixels (xBlock and xBlock+1)
                        const idx1 = finalData[y * width + xBlock] & 0x0F;
                        const idx2 = (xBlock + 1 < width) ? (finalData[y * width + xBlock + 1] & 0x0F) : 0;
                        packedData[packedIndex++] = (idx1 << 4) | idx2;
                    }
                }
            }
            // Append the palette (16 colors) at the end of the file
            if (targetPalette && targetPalette.length > 0) {
                // Convert the hex colors to ZX Next palette format (16-bit values)
                const paletteData = new Uint8Array(32); // 16 colors * 2 bytes per color
                console.log(`[SpriteImporterProvider] Appending palette data for 640x256 4-bit image`);
                // Log first colors for debugging
                if (targetPalette.length > 0) {
                    console.log(`  - First palette color: ${targetPalette[0]}`);
                }
                for (let i = 0; i < 16 && i < targetPalette.length; i++) {
                    const hex = targetPalette[i];
                    const rgb9 = this.hexToRgb9(hex);
                    const bytes = this.rgb9ToBytes(rgb9.r9, rgb9.g9, rgb9.b9);
                    if (i < 3) {
                        console.log(`  - Palette[${i}]: ${hex} -> R9:${rgb9.r9} G9:${rgb9.g9} B9:${rgb9.b9} -> Bytes:${bytes[0].toString(16).padStart(2, '0')}${bytes[1].toString(16).padStart(2, '0')}`);
                    }
                    // Write bytes in correct order for ZX Next hardware format
                    paletteData[i * 2] = bytes[0]; // RRRGGGBB (first byte)
                    paletteData[i * 2 + 1] = bytes[1]; // P000000B (second byte)
                }
                // Append the palette data to the image data
                const result = new Uint8Array(packedData.length + paletteData.length);
                result.set(packedData);
                result.set(paletteData, packedData.length);
                console.log(`[SpriteImporterProvider] Created 640x256 4-bit image with appended 16-color palette (${result.length} bytes)`);
                outputData = buffer_1.Buffer.from(result);
            }
            else {
                console.log(`[SpriteImporterProvider] Created 640x256 4-bit image (raw data, ${packedData.length} bytes)`);
                outputData = buffer_1.Buffer.from(packedData);
            }
        }
        else if (is320x256 && bitDepth === 8) {
            // Special handling for 320x256 8-bit format - column-major order
            console.log(`[SpriteImporterProvider] Using column-major layout for 320x256 8-bit format`);
            // For 320x256 8-bit, we use 1 byte per pixel in column-major order
            const outputSize = width * height;
            const columnMajorData = new Uint8Array(outputSize);
            // Pack pixels in column-major order (x changes fastest)
            // This is critical for 320x256 Layer 2 format to display correctly
            let outputIndex = 0;
            // Loop through columns first, then rows (column-major order)
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                    // Get the pixel index from the quantized data (which is in row-major order)
                    const rowMajorIndex = y * width + x;
                    // Copy to column-major output
                    columnMajorData[outputIndex++] = finalData[rowMajorIndex];
                }
            }
            // Debug: log a sample of the packed data
            let nonZeroBytes = 0;
            for (let i = 0; i < Math.min(columnMajorData.length, 1000); i++) {
                if (columnMajorData[i] > 0)
                    nonZeroBytes++;
            }
            console.log(`[SpriteImporterProvider] Column-major data first 1000 bytes: ${nonZeroBytes} non-zero values`);
            console.log(`[SpriteImporterProvider] Created 320x256 8-bit image in column-major order (${columnMajorData.length} bytes)`);
            outputData = buffer_1.Buffer.from(columnMajorData);
        }
        else if (is9bit_custom) {
            // 9-bit custom palette mode
            console.log(`[SpriteImporterProvider] createNXIFile: ENTERING 9-bit custom palette mode logic for ${width}x${height}`);
            console.log(`[SpriteImporterProvider] createNXIFile: 9-bit mode received targetPalette with ${targetPalette ? targetPalette.length : 'null/0'} colors. First few: ${targetPalette ? JSON.stringify(targetPalette.slice(0, 3)) : 'N/A'}`);
            // Apply column-major transformation for 320x256 images in 9-bit mode
            if (width === 320 && height === 256) {
                console.log(`[SpriteImporterProvider] Applying column-major layout to pixel data for 320x256 9-bit format`);
                const outputSize = width * height;
                const columnMajorData = new Uint8Array(outputSize);
                let outputIndex = 0;
                for (let x_col = 0; x_col < width; x_col++) {
                    for (let y_row = 0; y_row < height; y_row++) {
                        const rowMajorIndex = y_row * width + x_col;
                        columnMajorData[outputIndex++] = finalData[rowMajorIndex];
                    }
                }
                finalData = columnMajorData; // Replace finalData with the column-major version
                console.log(`[SpriteImporterProvider] Pixel data transformed to column-major for 320x256 9-bit.`);
            }
            // finalData now contains 8-bit indices (either row-major or column-major for 320x256)
            // into the custom paletteForQuantization.
            // Now, append or prepend the custom 9-bit targetPalette (which contains hex strings)
            if (targetPalette && targetPalette.length > 0) {
                const customPaletteData = new Uint8Array(targetPalette.length * 2); // Each 9-bit color is 2 bytes
                console.log(`[SpriteImporterProvider] Appending/Prepending custom 9-bit palette with ${targetPalette.length} colors (${customPaletteData.length} bytes)`);
                for (let i = 0; i < targetPalette.length; i++) {
                    const hex = targetPalette[i];
                    const rgb9 = this.hexToRgb9(hex); // Convert hex to {r9, g9, b9}
                    const bytes = this.rgb9ToBytes(rgb9.r9, rgb9.g9, rgb9.b9); // Convert {r9, g9, b9} to 2-byte hardware format
                    if (i < 5) { // Log first few conversions
                        console.log(`  - CustomPalette[${i}]: ${hex} -> R9:${rgb9.r9} G9:${rgb9.g9} B9:${rgb9.b9} -> Bytes:${bytes[0].toString(16).padStart(2, '0')}${bytes[1].toString(16).padStart(2, '0')}`);
                    }
                    customPaletteData[i * 2] = bytes[0];
                    customPaletteData[i * 2 + 1] = bytes[1];
                }
                // Combine pixel data and custom palette data
                const result = new Uint8Array(finalData.length + customPaletteData.length);
                if (width === 256) {
                    console.log(`[SpriteImporterProvider] Prepending custom 9-bit palette for ${width}x${height} image.`);
                    result.set(customPaletteData); // Palette data first
                    result.set(finalData, customPaletteData.length); // Pixel indices after palette
                    outputData = buffer_1.Buffer.from(result);
                    console.log(`[SpriteImporterProvider] Created ${width}x${height} 9-bit image with prepended custom palette (${outputData.length} bytes)`);
                }
                else {
                    console.log(`[SpriteImporterProvider] Appending custom 9-bit palette for ${width}x${height} image.`);
                    result.set(finalData); // Pixel indices first
                    result.set(customPaletteData, finalData.length); // Appended palette data
                    outputData = buffer_1.Buffer.from(result);
                    console.log(`[SpriteImporterProvider] Created ${width}x${height} 9-bit image with appended custom palette (${outputData.length} bytes)`);
                }
            }
            else {
                // Should not happen if 9-bit mode is selected, as palette extraction is expected
                console.warn(`[SpriteImporterProvider] createNXIFile: 9-bit custom mode, but targetPalette is null or empty. Will output raw 8-bit indexed data without appended palette (this results in an 8-bit like file).`);
                outputData = buffer_1.Buffer.from(finalData); // Fallback to just pixel data
            }
        }
        else if (bitDepth === 4) {
            // For other 4-bit modes (not 640x256), use standard row-major packing (2 pixels per byte)
            console.log(`[SpriteImporterProvider] Using standard row-major packing for ${width}x${height} 4-bit format`);
            const packedSize = Math.ceil((width * height) / 2);
            const packedData = new Uint8Array(packedSize);
            // Row-major order (standard layout)
            for (let i = 0; i < finalData.length; i += 2) {
                const idx1 = finalData[i] & 0x0F;
                const idx2 = (i + 1 < finalData.length) ? (finalData[i + 1] & 0x0F) : 0;
                packedData[i / 2] = (idx1 << 4) | idx2;
            }
            outputData = buffer_1.Buffer.from(packedData);
        }
        else {
            // For other 8-bit modes, use data as-is in row-major order
            console.log(`[SpriteImporterProvider] Using standard row-major format for ${width}x${height} 8-bit image`);
            outputData = buffer_1.Buffer.from(finalData);
        }
        // Debug info for the first few bytes of output data
        if (outputData.length > 16) {
            const debugBytes = Array.from(outputData.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
            console.log(`[SpriteImporterProvider] First 16 bytes of output: ${debugBytes}`);
            // Count non-zero bytes in output
            let nonZeroOutputBytes = 0;
            for (let i = 0; i < Math.min(outputData.length, 1000); i++) {
                if (outputData[i] > 0)
                    nonZeroOutputBytes++;
            }
            console.log(`[SpriteImporterProvider] Output data first 1000 bytes: ${nonZeroOutputBytes} non-zero values`);
        }
        return outputData;
    }
    getHtmlForWebview(webview) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'spriteImporter.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        // Local path to css styles
        const stylesPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'spriteImporter.css');
        const stylesUri = webview.asWebviewUri(stylesPathOnDisk);
        // Use a nonce to only allow specific scripts to be run
        const nonce = Date.now().toString();
        // Use backticks for the template literal, ensure internal strings use single/double quotes correctly
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${stylesUri}" rel="stylesheet">
                <title>${SpriteImporterProvider.title}</title>
            </head>
            <body>
                <h1>Sprite Importer</h1>
                <p>Select an area of the image below to import.</p>
                <p class="tips" style="font-size: 0.9em; color: var(--vscode-descriptionForeground); margin-bottom: 10px;">
                    <b>Tips:</b> Left-click to select with predefined size. Right-click and drag to create a custom selection.<br>
                    <b>Keyboard:</b> Arrows move selection, Numpad 4/6 adjust width, 8/5 adjust height. Space captures, A adds, C centers, S squares.
                </p>

                <!-- MOVED CONTROLS TO TOP -->
                <div id="controls">
                    <div class="control-group">
                         <button id="loadNewImageButton">Load New Image...</button>
                         <button id="convertToNxiButton" style="margin-left: 10px;">Convert to NXI...</button>
                         <button id="helpButton" style="margin-left: 10px;" title="Show keyboard shortcuts">?</button>
                    </div>
                    <div id="output-options">
                        <h3>Output Options</h3>
                        <div class="control-group">
                            <label for="outputFormat">Format:</label>
                            <select id="outputFormat">
                                <option value="spr" selected>Sprite (.spr)</option>
                                <option value="til">Tile (.til)</option>
                                <!-- <option value="fnt">Font (.fnt)</option> -->
                                <!-- <option value="nxi">Raw Pixels (.nxi)</option> -->
                            </select>
                        </div>
                        <div class="control-group">
                            <label for="outputBitDepth">Bit Depth:</label>
                            <select id="outputBitDepth">
                                <option value="8" selected>8-bit (256 colors)</option>
                                <option value="4">4-bit (16 colors)</option>
                            </select>
                        </div>
                        <!-- NEW Grid Size Inputs -->
                        <div class="control-group">
                            <label for="cutterGridWidth">Grid W:</label>
                            <input type="number" id="cutterGridWidth" value="1" min="1" max="16"> 
                        </div>
                         <div class="control-group">
                            <label for="cutterGridHeight">Grid H:</label>
                            <input type="number" id="cutterGridHeight" value="1" min="1" max="16">
                        </div>
                        
                        <!-- NEW Custom Sprite Size Controls -->
                        <div class="control-group">
                            <h4 style="margin: 8px 0 4px 0;">Sprite Size</h4>
                        </div>
                        <div class="control-group">
                            <label for="spriteWidth">Width:</label>
                            <input type="number" id="spriteWidth" value="16" min="1" max="256">
                        </div>
                        <div class="control-group">
                            <label for="spriteHeight">Height:</label>
                            <input type="number" id="spriteHeight" value="16" min="1" max="256">
                        </div>
                        <div class="control-group">
                            <input type="checkbox" id="saveActualSize" checked>
                            <label for="saveActualSize">Save actual size (unchecked = pad to 16px)</label>
                        </div>

                        <!-- NEW Source Grid Controls -->
                        <div class="control-group">
                            <input type="checkbox" id="showSourceGrid">
                            <label for="showSourceGrid">Show Grid</label>
                        </div>
                        <div class="control-group">
                            <label for="gridCellWidth">Cell W:</label>
                            <input type="number" id="gridCellWidth" value="16" min="8" max="128">
                        </div>
                        <div class="control-group">
                            <label for="gridCellHeight">Cell H:</label>
                            <input type="number" id="gridCellHeight" value="16" min="8" max="128">
                        </div>
                        <!-- REMOVED Palette Bank Input -->
                        <div class="control-group">
                            <button id="loadTargetPaletteButton">Load Target Palette...</button>
                            <span id="targetPaletteInfo" style="font-size: 0.9em; margin-left: 5px;"></span>
                        </div>
                    </div>

                    <!-- Actions div is now removed from here -->
                    <!-- <div id="actions" style="margin-top: 10px; display: flex; gap: 10px;"> -->
                    <!--    <button id="addSelectionButton" style="margin-top: 5px;">Add Selection to List</button> -->
                    <!--    <button id="importSheetButton">Import Sprite Sheet</button> -->
                    <!-- </div> -->
                </div>
                <!-- END CONTROLS AT TOP (excluding actions) -->
                
                <div id="image-area">
                    <canvas id="sourceCanvas"></canvas>
                </div>

                <!-- MOVED ACTIONS TO BELOW CANVAS -->
                 <div id="actions" style="margin-top: 10px; display: flex; gap: 10px; justify-content: flex-start;">
                    <button id="addSelectionButton">Add Selection to List</button> <!-- Removed inline margin-top -->
                    <button id="importSheetButton">Export Sprite Sheet</button> <!-- Changed Text -->
                </div>
                
                <div id="preview-area">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <h3>Selection Preview</h3>
                    </div>
                     <canvas id="previewCanvas"></canvas>

                   <!-- NEW container for Show Grid checkbox -->
                   <div class="control-group" style="margin-top: 8px;">
                       <input type="checkbox" id="showPreviewGrid">
                       <label for="showPreviewGrid" style="font-size: 11px;">Show Grid</label>
                   </div>

                     <div id="selectionInfo"></div>
                </div>

                <div id="sprite-list-area">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3>Selected Sprites (<span id="spriteCount">0</span>)</h3>
                        <button id="clearSpriteListButton" style="font-size: 11px; padding: 2px 5px;">Clear List</button>
                    </div>
                    <div id="spriteList"></div>
                </div>

                <div id="palette-preview-area">
                    <h3>Extracted Palette</h3>
                    <div id="paletteSwatches"></div>
                    <!-- NEW Button to Save Extracted Palette -->
                    <button id="saveExtractedPaletteButton" style="margin-top: 8px;" disabled>Save Extracted Palette...</button>
                </div>
                
                <!-- Help Modal -->
                <div id="keyboardHelpModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); z-index: 1000;">
                    <div style="position: relative; background-color: var(--vscode-editor-background); margin: 10% auto; padding: 20px; width: 80%; max-width: 600px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px;">
                        <h2>Keyboard Shortcuts</h2>
                        <button id="closeHelpButton" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 18px; cursor: pointer;">✕</button>
                        <div style="margin-top: 15px;">
                            <h3>Navigation</h3>
                            <ul>
                                <li><b>Arrow keys</b>: Move selection (hold Shift for larger steps)</li>
                                <li><b>C</b>: Center selection in view</li>
                                <li><b>Tab</b>: In block mode, auto-capture and advance to next position</li>
                            </ul>
                            <h3>Selection Size</h3>
                            <ul>
                                <li><b>Numpad 4</b>: Decrease width</li>
                                <li><b>Numpad 6</b>: Increase width</li>
                                <li><b>Numpad 8</b>: Decrease height</li>
                                <li><b>Numpad 5/2</b>: Increase height</li>
                                <li><b>S</b>: Make square (width = height)</li>
                            </ul>
                            <h3>Grid Control</h3>
                            <ul>
                                <li><b>Numpad *</b>: Increase grid width</li>
                                <li><b>Shift + Numpad *</b>: Increase grid height</li>
                                <li><b>Numpad /</b>: Decrease grid width</li>
                                <li><b>Shift + Numpad /</b>: Decrease grid height</li>
                            </ul>
                            <h3>Actions</h3>
                            <ul>
                                <li><b>Space</b>: Capture current selection</li>
                                <li><b>A</b>: Add selection to list</li>
                                <li><b>Escape</b>: Cancel current capture</li>
                                <li><b>Shift+Space</b>: Capture and add to list in one step</li>
                            </ul>
                            <h3>Mouse</h3>
                            <ul>
                                <li><b>Left-click</b>: Select with current sprite size</li>
                                <li><b>Right-click + drag</b>: Create custom selection</li>
                                <li><b>Scroll wheel</b>: Zoom in/out</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <!-- NXI Conversion Modal -->
                <div id="nxiConversionModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); z-index: 1000;">
                    <div style="position: relative; background-color: var(--vscode-editor-background); margin: 5% auto; padding: 20px; width: 90%; max-width: 800px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px;">
                        <h2>Convert to NXI Format</h2>
                        <button id="closeConversionButton" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 18px; cursor: pointer;">✕</button>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                            <!-- Left side - Options -->
                            <div style="flex: 1; min-width: 300px; gap: 5px; max-height: 400px ">
                                <h3>Conversion Options</h3>
                                
                                <div class="control-group">
                                    <label for="conversionResolution">Resolution:</label>
                                    <select id="conversionResolution">
                                        <option value="custom" selected>Custom</option>
                                        <option value="320x256">320x256 (Layer 2 Full)</option>
                                        <option value="256x192">256x192 (Layer 2 Standard)</option>
                                        <option value="640x256">640x256 (Layer 2 16 Colours)</option>
                                    </select>
                                </div>
                                
                                <div class="control-group-2" id="customResolutionControls">
                                    <label for="conversionWidth">Width:</label>
                                    <input type="number" id="conversionWidth" value="320" min="1" max="640">
                                    
                                    <label for="conversionHeight" style="margin-left: 10px;">Height:</label>
                                    <input type="number" id="conversionHeight" value="256" min="1" max="512">
                                </div>
                                
                                <div class="control-group">
                                    <input type="checkbox" id="preserveAspectRatio" checked>
                                    <label for="preserveAspectRatio">Preserve aspect ratio</label>
                                </div>
                                
                                <div class="control-group">
                                    <label for="conversionBitDepth">Bit Depth:</label>
                                    <select id="conversionBitDepth">
                                        <option value="8" selected>8-bit (256 colors)</option>
                                        <option value="4">4-bit (16 colors)</option>
                                        <option value="9">9-bit (Custom Palette)</option>
                                    </select>
                                </div>
                                
                                <div class="control-group">
                                    <label for="conversionDithering">Dithering:</label>
                                    <select id="conversionDithering">
                                        <option value="none" selected>None</option>
                                        <option value="floydSteinberg">Floyd-Steinberg</option>
                                        <option value="sierra">Sierra (Best Quality)</option>
                                        <option value="ordered">Ordered (Bayer)</option>
                                    </select>
                                </div>
                                
                                <div class="control-group">
                                    <label for="paletteSelection">Palette:</label>
                                    <select id="paletteSelection">
                                        <option value="default" selected>Default Palette</option>
                                        <option value="grayscale">Grayscale</option>
                                        <option value="loaded">Loaded Palette</option>
                                    </select>
                                    <button id="loadPaletteForConversion" style="margin-left: 5px;">Load...</button>
                                </div>
                                
                                <div class="control-group" id="conversionPaletteInfo" style="font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                                    Using default palette
                                </div>
                                
                                <div class="control-group" style="margin-top: 20px;">
                                    <button id="previewConversionButton">Preview Conversion</button>
                                    <button id="applyConversionButton" style="margin-left: 10px;">Convert & Save</button>
                                </div>
                            </div>
                            
                            <!-- Right side - Preview -->
                            <div style="flex: 1; min-width: 300px;">
                                <h3>Preview</h3>
                                <div style="border: 1px solid var(--vscode-editorWidget-border); overflow: auto; max-height: 350px; display: flex; justify-content: center; align-items: center; background-color: var(--vscode-editor-background);">
                                    <canvas id="conversionPreviewCanvas"></canvas>
                                </div>
                                <div id="conversionPreviewInfo" style="margin-top: 10px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                                    Adjust options and click "Preview Conversion" to see the result.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
    // Utility functions for color conversion
    hexTo8bitRgb(hex) {
        // Convert hex color (#RRGGBB) to 8-bit RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    hexToRgb9(hex) {
        // Convert hex color (#RRGGBB) to 9-bit RGB (3-3-3)
        const hexClean = hex.startsWith('#') ? hex.substring(1) : hex;
        if (hexClean.length !== 6) {
            return { r9: 0, g9: 0, b9: 0 };
        } // Invalid format
        // Parse hex to 8-bit RGB
        const r8 = parseInt(hexClean.substring(0, 2), 16);
        const g8 = parseInt(hexClean.substring(2, 4), 16);
        const b8 = parseInt(hexClean.substring(4, 6), 16);
        // Use findClosest3BitValue to get 3-bit RGB values (ZX Next's 9-bit color space)
        const r9 = this.findClosest3BitValue(r8);
        const g9 = this.findClosest3BitValue(g8);
        const b9 = this.findClosest3BitValue(b8);
        return { r9, g9, b9 };
    }
    rgb9ToBytes(r9, g9, b9) {
        // Convert 9-bit RGB (3-3-3) to ZX Next palette format (2 bytes)
        // Format: RRRGGGBB P000000B
        // First byte: RRRGGGBB - top 3 bits of red, 3 bits of green, high 2 bits of blue
        // Second byte: P000000B - priority flag (0) and low bit of blue
        // Ensure inputs are within 0-7 range
        const r3 = Math.min(7, Math.max(0, r9));
        const g3 = Math.min(7, Math.max(0, g9));
        const b3 = Math.min(7, Math.max(0, b9));
        // Extract components
        const rrr = r3 & 0x07;
        const ggg = g3 & 0x07;
        const bb_high = (b3 >> 1) & 0x03; // High 2 bits of blue (bits 1-2)
        const b_low = b3 & 0x01; // Low bit of blue (bit 0)
        // Construct bytes in ZX Next format
        const byte1 = (rrr << 5) | (ggg << 2) | bb_high; // RRRGGGBB
        const byte2 = b_low << 1; // 0000000B (no priority)
        return [byte1, byte2];
    }
    // Helper to find closest 3-bit value (0-7) for an 8-bit value (0-255) using ZX Next mapping
    findClosest3BitValue(value8bit) {
        // ZX Next RGB mapping: specific mapping from 3-bit (0-7) to 8-bit (0-255) 
        const rgb3to8Map = [0x00, 0x24, 0x49, 0x6D, 0x92, 0xB6, 0xDB, 0xFF];
        let closestValue = 0;
        let minDifference = Infinity;
        for (let i = 0; i < rgb3to8Map.length; i++) {
            const difference = Math.abs(value8bit - rgb3to8Map[i]);
            if (difference < minDifference) {
                minDifference = difference;
                closestValue = i;
            }
        }
        return closestValue;
    }
    // Add a new method for better perceptual color matching
    findClosestPerceptualColorIndex(r, g, b, palette) {
        // Convert input RGB directly to ZX Next's 3-bit-per-channel space (9-bit total)
        const r3bit = Math.min(7, Math.max(0, Math.round(r * 7 / 255)));
        const g3bit = Math.min(7, Math.max(0, Math.round(g * 7 / 255)));
        const b3bit = Math.min(7, Math.max(0, Math.round(b * 7 / 255)));
        // Use ZX Next's specific mapping to get the actual colors it can produce
        const mappedR = RGB3_TO_8_MAP[r3bit];
        const mappedG = RGB3_TO_8_MAP[g3bit];
        const mappedB = RGB3_TO_8_MAP[b3bit];
        // Calculate in LAB space for better perceptual matching
        const labInput = this.rgbToLab(mappedR, mappedG, mappedB);
        let minDistance = Infinity;
        let closestIndex = 0;
        for (let i = 0; i < palette.length; i++) {
            const palColor = palette[i];
            // Convert palette color to 3-bit space (0-7 for each component)
            const pr3bit = Math.min(7, Math.max(0, Math.round(palColor.r * 7 / 255)));
            const pg3bit = Math.min(7, Math.max(0, Math.round(palColor.g * 7 / 255)));
            const pb3bit = Math.min(7, Math.max(0, Math.round(palColor.b * 7 / 255)));
            // Use the actual hardware RGB values (more accurate)
            const mappedPR = RGB3_TO_8_MAP[pr3bit];
            const mappedPG = RGB3_TO_8_MAP[pg3bit];
            const mappedPB = RGB3_TO_8_MAP[pb3bit];
            // Calculate in LAB space
            const labPalette = this.rgbToLab(mappedPR, mappedPG, mappedPB);
            // Use CIEDE2000 color difference (better than Euclidean)
            const distance = this.deltaE2000(labInput, labPalette);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = i;
                // Optimization: if very close match found, return immediately
                if (minDistance < 0.1) {
                    break;
                }
            }
        }
        return closestIndex;
    }
    // Helper function to convert RGB to XYZ color space
    rgbToXyz(r, g, b) {
        // Normalize RGB values based on ZX Next's 9-bit color space
        // First convert to 0-7 range for each component
        const r3bit = Math.min(7, Math.max(0, Math.round(r * 7 / 255)));
        const g3bit = Math.min(7, Math.max(0, Math.round(g * 7 / 255)));
        const b3bit = Math.min(7, Math.max(0, Math.round(b * 7 / 255)));
        // Then convert back to 0-255 using ZX Next's specific mapping
        // This ensures we're working in the actual color space of the hardware
        const rMapped = Math.round(r3bit * 255 / 7);
        const gMapped = Math.round(g3bit * 255 / 7);
        const bMapped = Math.round(b3bit * 255 / 7);
        // Now normalize to 0-1 range for XYZ conversion
        let rNorm = rMapped / 255;
        let gNorm = gMapped / 255;
        let bNorm = bMapped / 255;
        // Apply gamma correction
        rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
        gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
        bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;
        // Scale
        rNorm *= 100;
        gNorm *= 100;
        bNorm *= 100;
        // Convert to XYZ
        const x = rNorm * 0.4124 + gNorm * 0.3576 + bNorm * 0.1805;
        const y = rNorm * 0.2126 + gNorm * 0.7152 + bNorm * 0.0722;
        const z = rNorm * 0.0193 + gNorm * 0.1192 + bNorm * 0.9505;
        return { x, y, z };
    }
    // Helper function to convert XYZ to LAB color space
    xyzToLab(x, y, z) {
        // Using D65 reference white
        const xRef = 95.047;
        const yRef = 100.0;
        const zRef = 108.883;
        let xNorm = x / xRef;
        let yNorm = y / yRef;
        let zNorm = z / zRef;
        xNorm = xNorm > 0.008856 ? Math.pow(xNorm, 1 / 3) : (7.787 * xNorm) + (16 / 116);
        yNorm = yNorm > 0.008856 ? Math.pow(yNorm, 1 / 3) : (7.787 * yNorm) + (16 / 116);
        zNorm = zNorm > 0.008856 ? Math.pow(zNorm, 1 / 3) : (7.787 * zNorm) + (16 / 116);
        const l = (116 * yNorm) - 16;
        const a = 500 * (xNorm - yNorm);
        const b = 200 * (yNorm - zNorm);
        return { l, a, b };
    }
    // Convert RGB to LAB directly
    rgbToLab(r, g, b) {
        const xyz = this.rgbToXyz(r, g, b);
        return this.xyzToLab(xyz.x, xyz.y, xyz.z);
    }
    // CIEDE2000 color difference formula (simplified version)
    deltaE2000(lab1, lab2) {
        // Calculate differences
        const deltaL = lab2.l - lab1.l;
        const deltaA = lab2.a - lab1.a;
        const deltaB = lab2.b - lab1.b;
        // Calculate CIEDE2000 (simplified)
        const C1 = Math.sqrt(lab1.a * lab1.a + lab1.b * lab1.b);
        const C2 = Math.sqrt(lab2.a * lab2.a + lab2.b * lab2.b);
        const deltaC = C2 - C1;
        let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
        deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
        // Weighting factors
        const kL = 1.0;
        const kC = 1.0;
        const kH = 1.0;
        // Compute the final color difference
        const L_term = (deltaL / kL) ** 2;
        const C_term = (deltaC / kC) ** 2;
        const H_term = (deltaH / kH) ** 2;
        return Math.sqrt(L_term + C_term + H_term);
    }
}
exports.SpriteImporterProvider = SpriteImporterProvider;
// Helper to convert hex to {r,g,b} 0-255
function hexTo8bitRgb(hex) {
    hex = hex.startsWith('#') ? hex.slice(1) : hex;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
}
//# sourceMappingURL=spriteImporterProvider.js.map