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
exports.getWebviewHtml = getWebviewHtml;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const mapWebviewLogic_1 = require("./mapWebviewLogic");
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
function getWebviewHtml(webview, context, blockMapData, spriteData, blockFileName, spriteFileName, viewState, customPalette, customPaletteName, defaultPalette) {
    const webviewUri = (relativePath) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', relativePath));
    const scriptUri = webviewUri('blockWebview.js');
    const mapRendererScriptUri = webviewUri('mapRenderer.js');
    const blockListRendererScriptUri = webviewUri('blockListRenderer.js');
    const cssUri = webviewUri('blockWebview.css');
    const nonce = getNonce();
    const htmlTemplateUri = vscode.Uri.joinPath(context.extensionUri, 'src', 'webview', 'blockWebview.html');
    const htmlTemplatePath = htmlTemplateUri.fsPath;
    let html = fs.readFileSync(htmlTemplatePath, 'utf8');
    html = html.replace(/{{cspSource}}/g, webview.cspSource);
    html = html.replace('{{nonce}}', nonce);
    html = html.replace('{{cssUri}}', cssUri.toString());
    const initialState = {
        blockData: blockMapData,
        spriteData: spriteData,
        viewState: viewState,
        customPalette: customPalette,
        customPaletteName: customPaletteName,
        defaultPalette: defaultPalette
    };
    const initialStateHtml = `
        <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const initialState = ${JSON.stringify(initialState)};
            const isMapMode = ${JSON.stringify(blockMapData.isMapFile)};
        </script>
        <script nonce="${nonce}" src="${mapRendererScriptUri}"></script>
        <script nonce="${nonce}" src="${blockListRendererScriptUri}"></script>
    `;
    html = html.replace('<!-- INITIAL_STATE_AND_RENDERER_SCRIPTS -->', initialStateHtml);
    html = html.replace('{{scriptUri}}', scriptUri.toString());
    // --- Inject :root styles --- 
    const defaultSpriteWidth = 16;
    const defaultSpriteHeight = 16;
    const rootStyleContent = `
        :root {
            --sprite-width: ${spriteData?.width ?? defaultSpriteWidth};
            --sprite-height: ${spriteData?.height ?? defaultSpriteHeight};
            --sprite-scale: ${viewState.scale};
        }
    `;
    // Find the closing </head> tag
    const headEndTag = '</head>';
    const headEndIndex = html.indexOf(headEndTag);
    if (headEndIndex >= 0) {
        // Inject the new style tag *before* the closing </head> tag
        const styleTag = `\n<style nonce="${nonce}">${rootStyleContent}</style>\n`;
        html = html.slice(0, headEndIndex) + styleTag + html.slice(headEndIndex);
        console.log("[getWebviewHtml] Successfully injected :root styles into head.");
    }
    else {
        console.error("[getWebviewHtml] Could not find </head> tag to inject :root variables.");
    }
    // --- End Inject :root styles --- 
    const title = `ZX Next ${blockMapData.isMapFile ? 'Map' : 'Block'} Viewer`;
    html = html.replace('<!-- TITLE -->', title);
    const blockTypeDescription = blockMapData.isMapFile
        ? `Map (${viewState.mapWidth}x${viewState.mapHeight} tiles)`
        : `Blocks (${blockMapData.blocks.length} defined)`;
    const spriteTypeDescription = spriteData ? `${spriteData.width}x${spriteData.height} ${viewState.spriteMode}` : 'No Sprite Data';
    // Simple file info section - direct HTML
    const fileInfoHtml = `<strong>${blockMapData.isMapFile ? 'Map' : 'Block'} File:</strong> ${blockFileName} (${blockTypeDescription})<br>
        <strong>Sprite File:</strong> ${spriteFileName} ${spriteData ? `(${spriteTypeDescription})` : ''}<br>
        <strong>Palette:</strong> ${customPaletteName || 'Default'}
        ${spriteData && ('paletteOffset' in spriteData || ['sprite4', 'tile8x8', 'font8x8'].includes(viewState.spriteMode)) ? `| Palette Offset: ${viewState.paletteOffset}` : ''}`;
    html = html.replace('<!-- FILE_INFO -->', fileInfoHtml);
    const generateBlockToolbarControlsHtml = (viewState) => {
        const blockWidthValue = viewState.blockWidth || 1;
        const blockHeightValue = viewState.blockHeight || 1;
        return `
           <div class="control-group">
               <label for="blockWidth">Block Width:</label>
               <input type="number" id="blockWidth" min="1" max="32" value="${blockWidthValue}">
           </div>
            <div class="control-group">
               <label for="blockHeight">Block Height:</label>
               <input type="number" id="blockHeight" min="1" max="32" value="${blockHeightValue}">
           </div>
           `;
    };
    // Generate the toolbar HTML directly
    const toolbarHtml = generateToolbarHtml(viewState, customPaletteName, blockMapData.isMapFile, !!spriteData, generateBlockToolbarControlsHtml);
    html = html.replace('<!-- TOOLBAR_CONTENT -->', toolbarHtml);
    let contentAreaHtml = '';
    if (blockMapData.isMapFile) {
        contentAreaHtml = (0, mapWebviewLogic_1.generateMapCanvasHtml)();
        console.log(`[getWebviewHtml] Generated map canvas HTML for map file mode.`);
    }
    else {
        contentAreaHtml = `<div id="block-list-container">
                               <canvas id="blockListCanvas"></canvas>
                           </div>`;
        console.log(`[getWebviewHtml] Generated block list HTML for block file mode.`);
    }
    html = html.replace('<!-- CONTENT_AREA -->', contentAreaHtml);
    // Simple toggle functionality script
    const toggleScript = `
        <script nonce="${nonce}">
            function toggleSection(id) {
                const section = document.getElementById(id);
                if (section) {
                    if (section.style.display === 'none') {
                        section.style.display = 'flex';
                        event.currentTarget.textContent = '▼';
                    } else {
                        section.style.display = 'none';
                        event.currentTarget.textContent = '▶';
                    }
                }
            }
        </script>
    `;
    // Insert toggle script before the closing </body> tag
    const bodyEndTag = '</body>';
    const bodyEndIndex = html.indexOf(bodyEndTag);
    if (bodyEndIndex >= 0) {
        html = html.slice(0, bodyEndIndex) + toggleScript + html.slice(bodyEndIndex);
        console.log("[getWebviewHtml] Successfully injected toggle script before body end tag.");
    }
    else {
        console.error("[getWebviewHtml] Could not find </body> tag to inject toggle script.");
        // Append it to the end as a fallback
        html += toggleScript;
    }
    return html;
}
function generateToolbarHtml(viewState, customPaletteName, isMapFile, hasSpriteData, generateBlockControlsFunc) {
    const scale = viewState.scale;
    const paletteStatusText = customPaletteName ? `Using: ${customPaletteName}` : 'Using: Default';
    const spriteControlsDisabled = !hasSpriteData;
    const mapControlsHtml = isMapFile ? (0, mapWebviewLogic_1.generateMapToolbarControlsHtml)(viewState) : '';
    const blockControlsHtml = !isMapFile ? generateBlockControlsFunc(viewState) : '';
    return `
        <div class="control-group">
            <label for="spriteMode">Sprite Mode:</label>
            <select id="spriteMode" ${spriteControlsDisabled ? 'disabled' : ''}>
                <option value="sprite8" ${viewState.spriteMode === 'sprite8' ? 'selected' : ''}>8-bit Sprites (16x16)</option>
                <option value="sprite4" ${viewState.spriteMode === 'sprite4' ? 'selected' : ''}>4-bit Sprites (16x16)</option>
                <option value="font8x8" ${viewState.spriteMode === 'font8x8' ? 'selected' : ''}>8x8 Font</option>
                <option value="tile8x8" ${viewState.spriteMode === 'tile8x8' ? 'selected' : ''}>8x8 Tiles</option>
            </select>
        </div>
        <div class="control-group">
            <label for="paletteOffset">Offset:</label>
            <input type="number" id="paletteOffset" min="0" max="240" step="16" value="${viewState.paletteOffset}" ${spriteControlsDisabled || !['sprite4', 'tile8x8', 'font8x8'].includes(viewState.spriteMode) ? 'disabled' : ''}>
        </div>
        <div class="control-group">
            <label for="scaleSlider">Scale:</label>
            <input type="range" id="scaleSlider" min="1" max="8" value="${scale}">
            <span id="scaleValue">${scale}x</span>
        </div>
        <div class="control-group">
            <label><input type="checkbox" id="showGrid" ${viewState.showGrid ? 'checked' : ''}> Grid</label>
        </div>
        ${mapControlsHtml}
        ${blockControlsHtml}
        <div class="control-group">
            <button id="loadPalette">Load Palette</button>
            <button id="useDefaultPalette">Default</button>
            <span id="paletteStatus" title="${customPaletteName || ''}">${paletteStatusText}</span>
        </div>
        <div class="control-group">
            <button id="loadSpriteFile">Load Sprites</button>
            <button id="reloadSpriteButton" ${!hasSpriteData ? 'disabled' : ''}>Reload</button>
            <button id="saveChangesButton" ${viewState.isDirty ? '' : 'disabled'}>Save</button>
        </div>
        <div class="control-group">
            <button id="analyzeSpritesDuplicatesButton" ${!hasSpriteData ? 'disabled' : ''}>Analyze Duplicates</button>
        </div>
    `;
}
//# sourceMappingURL=blockWebview.js.map