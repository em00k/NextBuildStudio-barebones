"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMapCanvasHtml = generateMapCanvasHtml;
exports.generateMapToolbarControlsHtml = generateMapToolbarControlsHtml;
/**
 * Generates the HTML for the map canvas container.
 */
function generateMapCanvasHtml() {
    // For now, this is static as it relies on the JS to draw,
    // but having it in a separate function is good practice.
    // Adding an outer container for scrolling and viewport rendering
    return `<div id="map-canvas-outer-container" style="max-height: 600px; overflow: auto; border: 2px solid var(--vscode-editorWidget-border); border-radius: 4px;"> 
                <div id="map-container" style="position: relative;">
                    <canvas id="mapCanvas"></canvas>
                </div>
            </div>
            <div id="map-info" style="margin-top: 10px; font-size: 0.9em; color: var(--vscode-descriptionForeground);">
                <span id="map-size-info"></span>
                <span id="map-viewport-info" style="margin-left: 10px;"></span>
            </div>`;
}
/**
 * Generates the HTML for map-specific toolbar controls (width, height, update button).
 * @param viewState The current view state containing map dimensions.
 */
function generateMapToolbarControlsHtml(viewState) {
    // Assumes viewState contains mapWidth and mapHeight when isMapFile is true
    return `
       <div class="control-group">
           <label for="mapWidth">W:</label>
           <input type="number" id="mapWidth" min="1" max="512" value="${viewState.mapWidth}"> 
       </div>
        <div class="control-group">
           <label for="mapHeight">H:</label>
           <input type="number" id="mapHeight" min="1" max="512" value="${viewState.mapHeight}">
           <button id="updateMapDims">Update</button>
           <input type="checkbox" id="reshapeData" style="margin-left: 4px">
           <label for="reshapeData">Reshape</label>
       </div>
       `;
}
//# sourceMappingURL=mapWebviewLogic.js.map