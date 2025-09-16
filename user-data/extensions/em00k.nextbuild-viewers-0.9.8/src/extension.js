// Force-bundle these modules so esbuild picks them up
import webidlConversions from 'webidl-conversions';
import { URL }            from 'whatwg-url';
import fetchNode          from 'node-fetch';       // if still missing
// (add any others it complains about)

;(function __bundleStubs() {
  // reference them so they’re not tree-shaken away
  console.log(webidlConversions, URL, fetchNode);
})();

import anyBase     from 'any-base';
import csj         from 'csj';
import matter      from 'gray-matter';
import highlight   from 'highlight.js';
const Jimp = require('jimp/browser/lib/jimp.js');
import MarkdownIt  from 'markdown-it';
// sharp is external, so keep it as require if you like:
const sharp       = require('sharp');

// prevent tree-shaking
;(function __bundleStubs() {
    console.log(anyBase, csj, fsExtra, matter, hljs, MarkdownIt);
  })();

/* eslint-disable curly */
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
        if (mod !== null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;

// The module 'vscode' contains the VS Code extensibility API
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs")); // Import fs for path checking
const path = __importStar(require("path")); // Import path for resolving
const crypto = __importStar(require("crypto"));
const vscode_1 = require("vscode"); // Import MarkdownString and CompletionItem
const paletteViewerProvider_1 = require("./paletteViewerProvider");
const spriteViewerProvider_1 = require("./spriteViewerProvider");
const blockViewerProvider_1 = require("./blockViewerProvider");
const imageViewerProvider_1 = require("./imageViewerProvider");
const spriteImporterProvider_1 = require("./spriteImporterProvider"); // Uncommented
const spriteDedupUtils_1 = require("./spriteDedupUtils");
const spriteDataHandler_1 = require("./spriteDataHandler");
const optimizedBlockViewerProvider_1 = require("./optimizedBlockViewerProvider");
// License key validation secret - this would ideally be more securely stored
const LICENSE_SECRET = 'nextbuild-zxspectrum-2023';
let keywordHelp = {};
let nextbuildConstants = {}; // For our constants
// License system
class LicenseManager {
    static instance;
    context;
    _licenseType = 'free';
    _featureFlags = {
        spriteImporter: false,
        cspectIntegration: false,
        optimizedBlocks: false,
        deduplicationTools: false,
    };
    constructor(context) {
        this.context = context;
        this.loadLicenseState();
    }
    static getInstance(context) {
        if (!LicenseManager.instance) {
            LicenseManager.instance = new LicenseManager(context);
        }
        return LicenseManager.instance;
    }
    get licenseType() {
        return this._licenseType;
    }
    get featureFlags() {
        return this._featureFlags;
    }
    loadLicenseState() {
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        this._licenseType = config.get('licenseType', 'free');
        // If premium, enable all premium features
        if (this._licenseType === 'premium') {
            this._featureFlags = {
                spriteImporter: true,
                cspectIntegration: true,
                optimizedBlocks: true,
                deduplicationTools: true,
            };
        }
        else {
            // Free version has limited feature set
            this._featureFlags = {
                spriteImporter: true,
                cspectIntegration: true, // Basic feature available in free
                optimizedBlocks: true,
                deduplicationTools: true,
            };
        }
    }
    async activateLicense(licenseKey) {
        if (!licenseKey || licenseKey.trim() === '') {
            vscode.window.showErrorMessage('Please enter a valid license key.');
            return false;
        }
        // Simple validation (hash-based)
        const isValid = this.validateLicenseKey(licenseKey);
        if (isValid) {
            // Store the license info
            await vscode.workspace.getConfiguration('nextbuild-viewers').update('licenseType', 'premium', vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration('nextbuild-viewers').update('licenseKey', licenseKey, vscode.ConfigurationTarget.Global);
            this._licenseType = 'premium';
            this.loadLicenseState(); // Refresh feature flags
            vscode.window.showInformationMessage('Premium license activated successfully! Please reload VS Code to enable all premium features.', 'Reload Now').then(selection => {
                if (selection === 'Reload Now') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
            return true;
        }
        else {
            vscode.window.showErrorMessage('Invalid license key. Please check and try again.');
            return false;
        }
    }
    checkFeatureAccess(feature) {
        if (!this._featureFlags[feature]) {
            vscode.window.showInformationMessage(`This feature requires a premium license. Would you like to upgrade?`, 'Learn More', 'Activate License').then(selection => {
                if (selection === 'Learn More') {
                    vscode.env.openExternal(vscode.Uri.parse('https://github.com/em00k/nextbuild-viewers#premium-features'));
                }
                else if (selection === 'Activate License') {
                    vscode.commands.executeCommand('nextbuild-viewers.activateLicense');
                }
            });
            return false;
        }
        return true;
    }
    // Very basic license validation (this is just for demonstration)
    // In a real scenario, you'd want a more secure validation method
    validateLicenseKey(key) {
        // Simple validation - check if the key contains a valid hash
        try {
            // Format should be: username-code
            const parts = key.split('-');
            if (parts.length !== 2) {
                return false;
            }
            const username = parts[0];
            const providedHash = parts[1];
            // Create hash from username and secret
            const expectedHash = crypto
                .createHash('md5')
                .update(`${username}-${LICENSE_SECRET}`)
                .digest('hex')
                .substring(0, 8);
            return expectedHash === providedHash;
        }
        catch (err) {
            console.error('License validation error:', err);
            return false;
        }
    }
}
// Helper function for creating files
async function createNewSpriteFile() {
    // 1. Define Types
    const fileTypes = {
        'Sprite 8-bit (16x16)': { ext: '.spr', w: 16, h: 16, bpp: 8, defaultCount: 256 },
        'Sprite 4-bit (16x16)': { ext: '.spr', w: 16, h: 16, bpp: 4, defaultCount: 256 },
        'Font 8x8 (8-bit)': { ext: '.fnt', w: 8, h: 8, bpp: 8, defaultCount: 512 }, // Common ASCII range
        'Tile 8x8 (4-bit)': { ext: '.til', w: 8, h: 8, bpp: 4, defaultCount: 512 },
        'Map 32x24 (8-bit)': { ext: '.nxm', w: 32, h: 24, bpp: 8, defaultCount: 32 * 24 },
    };
    const typeNames = Object.keys(fileTypes);
    // 2. Get Type
    const selectedType = await vscode.window.showQuickPick(typeNames, {
        placeHolder: 'Select the type of file to create',
        title: 'Create New Sprite/Font/Block File'
    });
    if (!selectedType) {
        return;
    } // User cancelled
    // Assert type to satisfy TypeScript
    const typeInfo = fileTypes[selectedType];
    // 3. Get Filename
    const filename = await vscode.window.showInputBox({
        prompt: `Enter filename (extension ${typeInfo.ext} will be added)`,
        value: `new_file${typeInfo.ext}`,
        title: 'Create New Sprite/Font/Map File'
    });
    if (!filename) {
        return;
    } // User cancelled
    let mapWidth = typeInfo.w;
    let mapHeight = typeInfo.h;
    let count = typeInfo.defaultCount;
    if (selectedType === 'Map 32x24 (8-bit)') {
        const mapSize = await vscode.window.showInputBox({
            prompt: 'Enter the size of the map (e.g. 32x24)',
            value: '32x24',
            title: 'Create New Map File'
        });
        if (!mapSize) {
            return;
        } // User cancelled
        const mapSizeParts = mapSize.split('x');
        if (mapSizeParts.length !== 2) {
            vscode.window.showErrorMessage('Invalid map size. Please enter a valid size (e.g. 32x24).');
            return;
        }
        mapWidth = parseInt(mapSizeParts[0], 10);
        mapHeight = parseInt(mapSizeParts[1], 10);
        if (isNaN(mapWidth) || isNaN(mapHeight) || mapWidth <= 0 || mapHeight <= 0) {
            vscode.window.showErrorMessage('Invalid map size. Please enter a valid size (e.g. 32x24).');
            return;
        }
        const bytesPerByte = 1;
        count = mapWidth * mapHeight;
        const totalSize = bytesPerByte * count;
        if (totalSize > 1024 * 1024) {
            vscode.window.showErrorMessage(`Map size is too large. Maximum map size is 1024*1024 bytes.`);
            return;
        }
        // Skip the count step for maps as we've already determined the size
    }
    else {
        // 4. Get Count (for non-map files)
        const countStr = await vscode.window.showInputBox({
            prompt: `Enter number of ${selectedType.split(' (')[0]}s`,
            value: typeInfo.defaultCount.toString(),
            title: 'Create New Sprite/Font/Block File',
            validateInput: text => {
                const num = parseInt(text, 10);
                return (!isNaN(num) && num > 0) ? null : 'Please enter a positive number.';
            }
        });
        if (!countStr) {
            return;
        } // User cancelled
        count = parseInt(countStr, 10);
    }
    const finalFilename = filename.endsWith(typeInfo.ext) ? filename : `${filename}${typeInfo.ext}`;
    // 5. Calculate Size & Create Buffer
    let totalSize;
    let buffer;
    if (selectedType === 'Map 32x24 (8-bit)') {
        // For maps, we just need one byte per cell
        totalSize = mapWidth * mapHeight;
        buffer = Buffer.alloc(totalSize, 0); // Initialize with zeroes
        // Additional information for user
        console.log(`Creating map file with dimensions ${mapWidth}x${mapHeight} (${totalSize} bytes)`);
    }
    else {
        // For sprites, fonts, etc.
        const bytesPerPixel = typeInfo.bpp / 8;
        const pixelsPerItem = typeInfo.w * typeInfo.h;
        const bytesPerItem = pixelsPerItem * bytesPerPixel;
        totalSize = bytesPerItem * count;
        buffer = Buffer.alloc(totalSize); // Filled with zeros by default
    }
    let targetDirectoryUri;
    if (vscode.window.activeTextEditor) {
        const documentUri = vscode.window.activeTextEditor.document.uri;
        targetDirectoryUri = vscode.Uri.joinPath(documentUri, '..');
    }
    else {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Cannot create file: No workspace folder open and no active editor.');
            return;
        }
        targetDirectoryUri = workspaceFolders[0].uri;
    }
    // 6. Get Save Location (use workspace root)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const documentUri = activeEditor.document.uri;
        targetDirectoryUri = vscode.Uri.joinPath(documentUri, '..');
        try {
            const saveUri = await vscode.window.showSaveDialog({
                filters: { 'Next Palette Files': ['nxp'] }, // Prefer .nxp for saving
                title: 'Save Default Palette As'
            });
        }
        catch (error) {
            vscode.window.showErrorMessage('Failed to save default palette: ' + error.message);
        }
    }
    else {
        // Fallback to workspace root if no active editor, or show an error
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('Cannot create file: No workspace folder open and no active editor.');
            return;
        }
        targetDirectoryUri = workspaceFolders[0].uri;
        vscode.window.showInformationMessage('No active editor, saving to workspace root.');
    }
    const fileUri = vscode.Uri.joinPath(targetDirectoryUri, finalFilename);
    // 7. Write File
    try {
        await vscode.workspace.fs.writeFile(fileUri, buffer);
        let successMessage = `Successfully created ${finalFilename} (${totalSize} bytes).`;
        if (selectedType === 'Map 32x24 (8-bit)') {
            successMessage = `Successfully created map ${finalFilename} with dimensions ${mapWidth}x${mapHeight} (${totalSize} bytes).`;
        }
        vscode.window.showInformationMessage(successMessage);
        // 8. Ask if user wants to open the file
        const openFile = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Open the created file?'
        });
        if (openFile === 'Yes') {
            // Determine the appropriate viewer based on file type
            let viewerCommand = '';
            if (typeInfo.ext === '.spr' || typeInfo.ext === '.til' || typeInfo.ext === '.fnt') {
                viewerCommand = 'nextbuild-viewers.openWithSpriteViewer';
            }
            else if (typeInfo.ext === '.nxm') {
                viewerCommand = 'nextbuild-viewers.openWithBlockViewer';
            }
            if (viewerCommand) {
                await vscode.commands.executeCommand(viewerCommand, fileUri);
            }
            else {
                // Fallback to regular file open
                await vscode.commands.executeCommand('vscode.open', fileUri);
            }
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to create file: ${error.message}`);
    }
}
// --- Function to load constants data ---
async function loadConstantsData(context) {
    try {
        const constantsPath = path.join(context.extensionPath, "data", "nextbuild_constants.json");
        if (!fs.existsSync(constantsPath)) {
            console.warn(`Constants file not found at: ${constantsPath}`);
            return false; // Not an error, just no constants to load
        }
        const fileContent = fs.readFileSync(constantsPath, "utf8");
        nextbuildConstants = JSON.parse(fileContent);
        console.log('NextBuild constants data loaded successfully');
        return Object.keys(nextbuildConstants).length > 0;
    }
    catch (error) {
        console.error('Error loading NextBuild constants data:', error);
        vscode.window.showErrorMessage('Error loading NextBuild constants data. Check format.');
        return false;
    }
}
// --- Hover Provider for NextBuild Keywords ---
class NextBuildHoverProvider {
    provideHover(document, position, token) {
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        if (!config.get('hoverHelp.enable', true)) {
            return undefined;
        }
        const wordRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_\.]+/);
        if (!wordRange) {
            return undefined;
        }
        const word = document.getText(wordRange).toUpperCase();
        // Return undefined if keyword doesn't exist or is marked as manual-only
        if (!keywordHelp[word] ||
            (typeof keywordHelp[word] === 'object' && keywordHelp[word].isManualOnly === true)) {
            return undefined;
        }
        // Extract content from either object format or direct string
        let content = typeof keywordHelp[word] === 'object' ? keywordHelp[word].content : keywordHelp[word];
        // Process the markdown to make links work properly in hover
        const mdString = new vscode.MarkdownString(this.processMarkdownLinks(content));
        mdString.isTrusted = true; // Enable command URIs
        mdString.supportHtml = true; // Support HTML
        return new vscode.Hover(mdString);
    }
    // Helper function to process markdown links in hover help
    processMarkdownLinks(content) {
        // Process markdown links to transform references based on link type
        return content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, linkTarget) => {
            // Get a possible keyword from the linkTarget - handle both with and without .md extension
            let keywordCandidate;
            if (linkTarget.endsWith('.md')) {
                keywordCandidate = linkTarget.replace(/\.md$/, '').toUpperCase();
            } else {
                // Handle links without .md extension - just use the linkTarget directly
                keywordCandidate = linkTarget.toUpperCase(); 
            }
            
            // Check if the extracted keyword exists in our keyword database
            if (keywordHelp[keywordCandidate]) {
                // Create a command URI for the link
                const commandUri = vscode.Uri.parse(`command:nextbuild-viewers.showKeywordHelp?${encodeURIComponent(JSON.stringify([keywordCandidate]))}`);
                return `[${linkText}](${commandUri})`;
            }
            
            // Case 2: Explicit web link (using web:// prefix)
            if (linkTarget.startsWith('web://')) {
                const webUrl = linkTarget.substring(6);
                return `[${linkText}](${webUrl})`;
            }
            // Case 3: Regular web link
            else if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
                return `[${linkText}](${linkTarget})`;
            }
            
            // Default case: Return the original link
            return match;
        });
    }
}
// --- Completion Item Provider for NextBuild Keywords and Constants ---
class NextBuildCompletionItemProvider {
    provideCompletionItems(document, position, token, context) {
        const completions = [];
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        // Add keywords from keywordHelp if enabled
        if (config.get('completion.enableKeywords', true)) {
            for (const keyword in keywordHelp) {
                if (Object.prototype.hasOwnProperty.call(keywordHelp, keyword)) {
                    const item = new vscode_1.CompletionItem(keyword, vscode_1.CompletionItemKind.Keyword);
                    const helpText = keywordHelp[keyword];
                    if (helpText) {
                        item.documentation = new vscode_1.MarkdownString(helpText);
                    }
                    item.detail = "NextBuild Keyword";
                    completions.push(item);
                }
            }
        }
        // Add constants from nextbuildConstants if enabled
        if (config.get('completion.enableConstants', true)) {
            for (const constantName in nextbuildConstants) {
                if (Object.prototype.hasOwnProperty.call(nextbuildConstants, constantName)) {
                    const constantEntry = nextbuildConstants[constantName];
                    const item = new vscode_1.CompletionItem(constantName, vscode_1.CompletionItemKind.Constant);
                    let detail = "NextBuild Constant";
                    if (constantEntry.value !== undefined) {
                        detail += ` = ${constantEntry.value}`;
                    }
                    item.detail = detail;
                    item.documentation = new vscode_1.MarkdownString(constantEntry.description);
                    completions.push(item);
                }
            }
        }
        return completions;
    }
}
// This method is called when your extension is activated
function activate(context) {
    console.log('Extension "nextbuild-viewers" is now active!');
    // Initialize license manager
    const licenseManager = LicenseManager.getInstance(context);
    // Load keyword help data
    loadKeywordHelp(context).then(success => {
        if (success) {
            console.log('Keyword help data loaded successfully');
        }
        else {
            console.warn('Failed to load keyword help data');
        }
    });
    // Load constants data
    loadConstantsData(context).then(success => {
        if (success)
            console.log('Constants data loaded successfully');
        else
            console.warn('Failed to load constants data');
    });
    // Register the keyword help command (F1)
    context.subscriptions.push(vscode.commands.registerCommand("nextbuild-viewers.showKeywordHelp", (keyword) => {
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        if (config.get('keywordHelp', true)) {
            if (typeof keyword === 'string') {
                // Direct call with a keyword parameter
                showKeywordHelp(keyword);
            }
            else if (Array.isArray(keyword) && keyword.length > 0) {
                // Handle when the parameter is passed as an array (from command URIs)
                showKeywordHelp(keyword[0]);
            }
            else {
                // Traditional F1 call - determine keyword from cursor position
                showHelp();
            }
        }
        else {
            vscode.window.showInformationMessage('NextBuild F1 Keyword Help is disabled in settings.');
        }
    }));
    // Register the edit keywords file command
    context.subscriptions.push(vscode.commands.registerCommand("nextbuild-viewers.editKeywordsFile", () => editKeywordsFile(context)));
    // Register Hover Provider for 'nextbuild' language
    context.subscriptions.push(vscode.languages.registerHoverProvider({ language: 'nextbuild', scheme: 'file' }, new NextBuildHoverProvider()));
    // Register Completion Item Provider for 'nextbuild' language
    // Trigger completions on typical characters or by invoking IntelliSense (Ctrl+Space)
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ language: 'nextbuild', scheme: 'file' }, new NextBuildCompletionItemProvider()
    // No specific trigger characters by default, relies on Ctrl+Space or typing
    ));
    // Register the license activation command
    let activateLicenseCommand = vscode.commands.registerCommand('nextbuild-viewers.activateLicense', async () => {
        const licenseKey = await vscode.window.showInputBox({
            prompt: 'Enter your NextBuild Viewers premium license key',
            placeHolder: 'username-licensekey',
            ignoreFocusOut: true
        });
        if (licenseKey) {
            await licenseManager.activateLicense(licenseKey);
        }
    });
    // Check for license expiration
    const expirationDate = new Date('2025-09-25'); // Set your desired expiration date
    const currentDate = new Date();
    if (currentDate > expirationDate) {
        // Extension has expired
        vscode.window.showErrorMessage('This version of NextBuild Viewers has expired. Please download the latest version.', 'Get Update').then(selection => {
            if (selection === 'Get Update') {
                vscode.env.openExternal(vscode.Uri.parse('https://nextbuildstudio.itch.io'));
            }
        });

        // return;
    }
    // Check for first install or update
    const extensionId = 'em00k.nextbuild-viewers';
    const extension = vscode.extensions.getExtension(extensionId);
    if (extension) {
        const packageJSON = extension.packageJSON;
        const currentVersion = packageJSON.version;
        const previousVersion = context.globalState.get('nextbuild-viewers.version');
        // First install or update
        if (!previousVersion || previousVersion !== currentVersion) {
            // Show sponsor page on install/update
            showSponsorPage();
            // Save version to globalState
            context.globalState.update('nextbuild-viewers.version', currentVersion);
        }
    }
    // Add information about file icon themes
    const currentIconTheme = vscode.workspace.getConfiguration('workbench').get('iconTheme');
    const respectExistingTheme = vscode.workspace.getConfiguration('nextbuild-viewers').get('respectExistingIconTheme');
    if (currentIconTheme && currentIconTheme !== 'nextbuild-icons' && !respectExistingTheme) {
        // Use a status bar item instead of a notification to be less intrusive
        const iconThemeItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        iconThemeItem.text = "NextBuild Icons Available";
        iconThemeItem.tooltip = "ZX Next file icons are available. Click to switch from your current icon theme.";
        iconThemeItem.command = 'workbench.action.selectIconTheme';
        iconThemeItem.show();
        // Add to subscriptions to be cleaned up when extension deactivates
        context.subscriptions.push(iconThemeItem);
    }
    // Register the palette viewer first to ensure it's available immediately
    const paletteViewerProvider = new paletteViewerProvider_1.PaletteViewerProvider(context);
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(paletteViewerProvider_1.PaletteViewerProvider.viewType, paletteViewerProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
    }));
    // Register the sprite viewer
    const spriteViewerProvider = new spriteViewerProvider_1.SpriteViewerProvider(context);
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(spriteViewerProvider_1.SpriteViewerProvider.viewType, spriteViewerProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
    }));
    // Register the block viewer
    const blockViewerProvider = new blockViewerProvider_1.BlockViewerProvider(context);
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(blockViewerProvider_1.BlockViewerProvider.viewType, blockViewerProvider, {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
    }));
    // Register the image viewer
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(imageViewerProvider_1.ImageViewerProvider.viewType, new imageViewerProvider_1.ImageViewerProvider(context), {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
    }));
    // Register the optimized block viewer
    context.subscriptions.push(vscode.window.registerCustomEditorProvider(optimizedBlockViewerProvider_1.OptimizedBlockViewerProvider.viewType, new optimizedBlockViewerProvider_1.OptimizedBlockViewerProvider(context), {
        webviewOptions: {
            retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
    }));
    // Register a command that opens a palette file with our custom editor
    let openWithPaletteViewer = vscode.commands.registerCommand('nextbuild-viewers.openWithPaletteViewer', async (uri) => {
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (uri) {
            // Force open with our custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, paletteViewerProvider_1.PaletteViewerProvider.viewType);
        }
    });
    // Register a command that opens a sprite file with our custom editor
    let openWithSpriteViewer = vscode.commands.registerCommand('nextbuild-viewers.openWithSpriteViewer', async (uri) => {
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (uri) {
            // Force open with our custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, spriteViewerProvider_1.SpriteViewerProvider.viewType);
        }
    });
    // Register a command that opens a block file with our custom editor
    let openWithBlockViewer = vscode.commands.registerCommand('nextbuild-viewers.openWithBlockViewer', async (uri) => {
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (uri) {
            // Force open with our custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, blockViewerProvider_1.BlockViewerProvider.viewType);
        }
    });
    // Register a command that opens an image file with our custom editor
    let openWithImageViewer = vscode.commands.registerCommand('nextbuild-viewers.openWithImageViewer', async (uri) => {
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (uri) {
            // Force open with our custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, imageViewerProvider_1.ImageViewerProvider.viewType);
        }
    });
    // Register a simple command that shows a notification
    let showMessage = vscode.commands.registerCommand('nextbuild-viewers.showMessage', () => {
        vscode.window.showInformationMessage('Hello from NextBuild Viewers!');
    });
    // Register the "Create New" command
    let createCommand = vscode.commands.registerCommand('nextbuild-viewers.createSpriteFile', createNewSpriteFile);
    // Register the "Play PT3" command
    let playPT3Command = vscode.commands.registerCommand('nextbuild-viewers.playPT3File', async (uri) => {
        const filePath = uri?.fsPath;
        if (!filePath) {
            vscode.window.showWarningMessage('Could not determine the PT3 file path.');
            return;
        }
        const fileName = path.basename(filePath);
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        const playpt3Path = config.get('playpt3Path');
        if (!playpt3Path) {
            const result = await vscode.window.showErrorMessage('Path to playpt3.exe is not configured. Please set it in settings.', 'Open Settings', 'Cancel');
            if (result === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'nextbuild-viewers.playpt3Path');
            }
            return;
        }
        try {
            await fs.promises.access(playpt3Path, fs.constants.X_OK);
        }
        catch (err) {
            const result = await vscode.window.showErrorMessage(`Configured playpt3.exe path not found or not executable: ${playpt3Path}`, 'Open Settings', 'Cancel');
            if (result === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'nextbuild-viewers.playpt3Path');
            }
            return;
        }
        // --- Launch in Integrated Terminal ---
        // Create or get a terminal named "PT3 Playback"
        // Reuse existing terminal if one with the same name exists
        let terminal = vscode.window.terminals.find(t => t.name === 'PT3 Playback');
        if (!terminal) {
            terminal = vscode.window.createTerminal(`PT3 Playback`);
        }
        // Construct the command for PowerShell using the call operator '&'
        const command = `& "${playpt3Path}" "${filePath}"`;
        // Send the command to the terminal
        terminal.sendText(command);
        // Show the terminal panel
        terminal.show();
        vscode.window.showInformationMessage(`Sent play command for ${fileName} to terminal.`);
    });
    // Register the sprite importer command with license check
    let importSpriteCommand = vscode.commands.registerCommand('nextbuild-viewers.importSpriteFromImage', async () => {
        // Check if this premium feature is accessible
        if (!licenseManager.checkFeatureAccess('spriteImporter')) {
            return; // Exit if user doesn't have access
        }
        // Original implementation
        const imageUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Images': ['png', 'bmp', 'jpg', 'jpeg', 'gif'] // Add more as needed
            },
            title: 'Select Image to Import Sprite From'
        });
        if (imageUris && imageUris[0]) {
            const selectedImageUri = imageUris[0];
            console.log('[Extension] Image selected for import:', selectedImageUri.fsPath);
            new spriteImporterProvider_1.SpriteImporterProvider(context, selectedImageUri);
        }
        else {
            console.log('[Extension] No image selected for import.');
        }
    });
    // Register the icon theme toggle command
    let toggleIconTheme = vscode.commands.registerCommand('nextbuild-viewers.toggleIconTheme', async () => {
        const config = vscode.workspace.getConfiguration('workbench');
        const currentIconTheme = config.get('iconTheme');
        if (currentIconTheme === 'nextbuild-icons') {
            // Currently using NextBuild icons, switch to VS Code default
            await config.update('iconTheme', 'vs-seti', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Switched to VS Code default icons');
        }
        else {
            // Not using NextBuild icons, switch to them
            await config.update('iconTheme', 'nextbuild-icons', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Switched to NextBuild ZX Next file icons');
        }
    });
    // Register a command for sprite deduplication analysis with license check
    let analyzeDuplicatesCommand = vscode.commands.registerCommand('nextbuild-viewers.analyzeSpritesDuplicates', async (uri) => {
        // Check if this premium feature is accessible
        if (!licenseManager.checkFeatureAccess('deduplicationTools')) {
            return; // Exit if user doesn't have access
        }
        // Get the file URI if not provided
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (!uri) {
            vscode.window.showErrorMessage('No file selected for sprite duplication analysis.');
            return;
        }
        try {
            // Read the file
            const fileData = await vscode.workspace.fs.readFile(uri);
            const buffer = Buffer.from(fileData);
            const fileExt = path.extname(uri.fsPath).toLowerCase();
            // Determine file type and parse sprites
            let spriteData;
            let paletteOffset = 0;
            // Prompt for palette offset if needed
            if (fileExt === '.til' || fileExt === '.nxt') {
                const offsetStr = await vscode.window.showInputBox({
                    prompt: 'Enter palette offset for 4-bit sprites (0-240)',
                    value: '0',
                    validateInput: text => {
                        const num = parseInt(text, 10);
                        return (!isNaN(num) && num >= 0 && num <= 240) ? null : 'Please enter a number between 0 and 240.';
                    }
                });
                if (offsetStr === undefined) {
                    return; // User cancelled
                }
                paletteOffset = parseInt(offsetStr, 10);
            }
            // Parse file based on extension
            if (fileExt === '.spr') {
                try {
                    spriteData = (0, spriteDataHandler_1.parse8BitSprites)(buffer);
                }
                catch (e) {
                    // If 8-bit parsing fails, try 4-bit
                    const offsetStr = await vscode.window.showInputBox({
                        prompt: 'Could not parse as 8-bit. Enter palette offset for 4-bit sprites (0-240)',
                        value: '0',
                        validateInput: text => {
                            const num = parseInt(text, 10);
                            return (!isNaN(num) && num >= 0 && num <= 240) ? null : 'Please enter a number between 0 and 240.';
                        }
                    });
                    if (offsetStr === undefined) {
                        return; // User cancelled
                    }
                    paletteOffset = parseInt(offsetStr, 10);
                    spriteData = (0, spriteDataHandler_1.parse4BitSprites)(buffer, paletteOffset);
                }
            }
            else if (fileExt === '.fnt') {
                spriteData = (0, spriteDataHandler_1.parse8x8Font)(buffer);
            }
            else if (fileExt === '.til' || fileExt === '.nxt') {
                spriteData = (0, spriteDataHandler_1.parse8x8Tiles)(buffer, paletteOffset);
            }
            else {
                vscode.window.showErrorMessage('Unsupported file type for sprite duplication analysis.');
                return;
            }
            // Configure deduplication options
            const options = {
                ...spriteDedupUtils_1.defaultOptions
            };
            // Ask for detection options
            const detectFlippedH = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Detect horizontally flipped sprites as duplicates?'
            });
            if (detectFlippedH === undefined) {
                return; // User cancelled
            }
            options.detectFlippedHorizontal = detectFlippedH === 'Yes';
            const detectFlippedV = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Detect vertically flipped sprites as duplicates?'
            });
            if (detectFlippedV === undefined) {
                return; // User cancelled
            }
            options.detectFlippedVertical = detectFlippedV === 'Yes';
            const detectRotated = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Detect 180° rotated sprites as duplicates?'
            });
            if (detectRotated === undefined) {
                return; // User cancelled
            }
            options.detectRotated = detectRotated === 'Yes';
            // Find duplicates
            const duplicates = (0, spriteDedupUtils_1.detectDuplicates)(spriteData, options);
            if (duplicates.length === 0) {
                vscode.window.showInformationMessage('No duplicate sprites found.');
                return;
            }
            // Group duplicates for better reporting
            const groups = (0, spriteDedupUtils_1.groupDuplicates)(duplicates);
            // Create a simple report
            const fileName = path.basename(uri.fsPath);
            const totalSprites = spriteData.sprites.length;
            const uniqueSprites = totalSprites - duplicates.length;
            const savingPercentage = Math.round((duplicates.length / totalSprites) * 100);
            // Create and show output channel for the report
            const outputChannel = vscode.window.createOutputChannel('Sprite Duplication Analysis');
            outputChannel.clear();
            outputChannel.appendLine(`=== Sprite Duplication Analysis: ${fileName} ===`);
            outputChannel.appendLine('');
            outputChannel.appendLine(`Total sprites: ${totalSprites}`);
            outputChannel.appendLine(`Unique sprites: ${uniqueSprites}`);
            outputChannel.appendLine(`Duplicate sprites: ${duplicates.length} (${savingPercentage}% of total)`);
            outputChannel.appendLine('');
            outputChannel.appendLine('=== Duplicate Groups ===');
            groups.forEach((group, index) => {
                outputChannel.appendLine('');
                outputChannel.appendLine(`Group ${index + 1}:`);
                outputChannel.appendLine(`  Original: Sprite #${group.originalIndex}`);
                outputChannel.appendLine('  Duplicates:');
                group.duplicates.forEach(dupe => {
                    outputChannel.appendLine(`    Sprite #${dupe.index} (${dupe.matchType})`);
                });
            });
            // Show the report
            outputChannel.show();
            // Ask if user wants to save a deduplicated version
            const saveDeduplicated = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Save a deduplicated version of this sprite file?'
            });
            if (saveDeduplicated === 'Yes') {
                try {
                    // Create deduplicated sprite data
                    const deduplicatedSpriteData = (0, spriteDedupUtils_1.removeDuplicates)(spriteData, duplicates);
                    // Create a mapping from old indices to new indices
                    const spriteMapping = (0, spriteDedupUtils_1.createSpriteMapping)(spriteData.sprites.length, duplicates);
                    // Calculate savings
                    const originalSize = buffer.length;
                    const deduplicatedBuffer = (0, spriteDataHandler_1.encodeSpriteData)(deduplicatedSpriteData);
                    const newSize = deduplicatedBuffer.length;
                    const bytesSaved = originalSize - newSize;
                    const percentSaved = Math.round((bytesSaved / originalSize) * 100);
                    // Get output filename
                    const dirName = path.dirname(uri.fsPath);
                    const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
                    const fileExt = path.extname(uri.fsPath);
                    const defaultOutputName = `${baseName}_dedup${fileExt}`;
                    const outputFilename = await vscode.window.showInputBox({
                        prompt: 'Enter filename for deduplicated sprite file',
                        value: defaultOutputName
                    });
                    if (!outputFilename) {
                        return; // User cancelled
                    }
                    // Create output URI
                    const outputUri = vscode.Uri.file(path.join(dirName, outputFilename));
                    // Write the file
                    await vscode.workspace.fs.writeFile(outputUri, deduplicatedBuffer);
                    // Report success
                    vscode.window.showInformationMessage(`Deduplicated file saved successfully! Reduced from ${originalSize} bytes to ${newSize} bytes (${percentSaved}% smaller).`);
                    // Update output channel with the results
                    outputChannel.appendLine('');
                    outputChannel.appendLine('=== Deduplication Results ===');
                    outputChannel.appendLine(`Original file size: ${originalSize} bytes`);
                    outputChannel.appendLine(`Deduplicated file size: ${newSize} bytes`);
                    outputChannel.appendLine(`Bytes saved: ${bytesSaved} (${percentSaved}%)`);
                    outputChannel.appendLine(`Saved to: ${outputFilename}`);
                    // Find and update block/map files that reference this sprite file
                    const updateReferences = await vscode.window.showQuickPick(['Yes', 'No'], {
                        placeHolder: 'Update references in block/map files?'
                    });
                    if (updateReferences === 'Yes') {
                        outputChannel.appendLine('');
                        outputChannel.appendLine('=== Updating References ===');
                        // Find block/map files that reference this sprite file
                        const referencingFiles = await (0, spriteDedupUtils_1.findBlockFilesThatReferenceSprite)(uri.fsPath);
                        if (referencingFiles.length === 0) {
                            outputChannel.appendLine('No block or map files found that reference this sprite file.');
                            vscode.window.showInformationMessage('No block or map files found that reference this sprite file.');
                        }
                        else {
                            outputChannel.appendLine(`Found ${referencingFiles.length} block/map files that may reference this sprite file:`);
                            // Ask which files to update
                            const fileItems = referencingFiles.map(fileUri => ({
                                label: path.basename(fileUri.fsPath),
                                description: fileUri.fsPath,
                                uri: fileUri
                            }));
                            const selectedFiles = await vscode.window.showQuickPick(fileItems, {
                                canPickMany: true,
                                placeHolder: 'Select block/map files to update'
                            });
                            if (!selectedFiles || selectedFiles.length === 0) {
                                outputChannel.appendLine('No files selected for update.');
                            }
                            else {
                                // Update each selected file
                                let updatedFileCount = 0;
                                for (const item of selectedFiles) {
                                    try {
                                        // Read the file
                                        const fileUri = item.uri;
                                        const fileData = await vscode.workspace.fs.readFile(fileUri);
                                        const isMapFile = fileUri.fsPath.toLowerCase().endsWith('.nxm');
                                        // Apply the sprite mapping
                                        const updatedData = (0, spriteDedupUtils_1.applySpriteMappingToBlockData)(fileData, spriteMapping, isMapFile);
                                        // Create backup filename
                                        const backupName = `${path.basename(fileUri.fsPath, path.extname(fileUri.fsPath))}_backup${path.extname(fileUri.fsPath)}`;
                                        const backupUri = vscode.Uri.file(path.join(path.dirname(fileUri.fsPath), backupName));
                                        // Create backup
                                        await vscode.workspace.fs.writeFile(backupUri, fileData);
                                        // Write the updated file
                                        await vscode.workspace.fs.writeFile(fileUri, updatedData);
                                        outputChannel.appendLine(`Updated: ${fileUri.fsPath} (backup: ${backupName})`);
                                        updatedFileCount++;
                                    }
                                    catch (err) {
                                        outputChannel.appendLine(`Error updating ${item.label}: ${err.message}`);
                                    }
                                }
                                if (updatedFileCount > 0) {
                                    vscode.window.showInformationMessage(`Updated ${updatedFileCount} block/map files. See output panel for details.`);
                                }
                            }
                        }
                    }
                    // Ask if user wants to open the file
                    const openFile = await vscode.window.showQuickPick(['Yes', 'No'], {
                        placeHolder: 'Open the deduplicated file?'
                    });
                    if (openFile === 'Yes') {
                        // Open with appropriate viewer
                        vscode.commands.executeCommand('vscode.openWith', outputUri, spriteViewerProvider_1.SpriteViewerProvider.viewType);
                    }
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Error creating deduplicated file: ${error.message}`);
                }
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error analyzing sprite duplicates: ${error.message}`);
        }
    });
    // Register the "Convert to Optimized Block Format" command with license check
    let convertToOptimizedBlockCommand = vscode.commands.registerCommand('nextbuild-viewers.convertToOptimizedBlock', async (uri) => {
        // Check if this premium feature is accessible
        if (!licenseManager.checkFeatureAccess('optimizedBlocks')) {
            return; // Exit if user doesn't have access
        }
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (!uri) {
            // Prompt the user to select a file instead of showing an error
            const fileOptions = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select Block File for Conversion',
                filters: {
                    'Block Files': ['nxb']
                }
            });
            if (!fileOptions || fileOptions.length === 0) {
                vscode.window.showInformationMessage('Conversion cancelled: No block file selected.');
                return;
            }
            uri = fileOptions[0];
        }
        try {
            // Check if it's a block file
            if (!uri.fsPath.toLowerCase().endsWith('.nxb')) {
                vscode.window.showErrorMessage('Only .nxb files can be converted to optimized format.');
                return;
            }
            // Read the block file
            const blockData = await vscode.workspace.fs.readFile(uri);
            console.log(`Read ${blockData.length} bytes from block file.`);
            // Ask user for sprite file
            const spriteFileOptions = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                openLabel: 'Select Sprite File',
                filters: {
                    'Sprite Files': ['spr', 'til', 'nxt']
                }
            });
            if (!spriteFileOptions || spriteFileOptions.length === 0) {
                vscode.window.showInformationMessage('Conversion cancelled: No sprite file selected.');
                return;
            }
            const spriteFileUri = spriteFileOptions[0];
            const spriteData = await vscode.workspace.fs.readFile(spriteFileUri);
            console.log(`Read ${spriteData.length} bytes from sprite file.`);
            // Ask if user wants to deduplicate sprites
            const shouldDeduplicate = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Deduplicate sprites to optimize storage?'
            });
            // Parse sprite file based on extension
            const spriteFileExt = path.extname(spriteFileUri.fsPath).toLowerCase();
            let parsedSpriteData;
            // Import sprite handlers
            const { parse8BitSprites, parse4BitSprites, parse8x8Tiles } = require('./spriteDataHandler');
            if (spriteFileExt === '.spr') {
                parsedSpriteData = parse8BitSprites(Buffer.from(spriteData));
            }
            else if (spriteFileExt === '.nxt') {
                parsedSpriteData = parse4BitSprites(Buffer.from(spriteData), 0);
            }
            else if (spriteFileExt === '.til') {
                parsedSpriteData = parse8x8Tiles(Buffer.from(spriteData), 0);
            }
            else {
                // Default to 8-bit sprites if unknown
                parsedSpriteData = parse8BitSprites(Buffer.from(spriteData));
            }
            console.log(`Parsed sprite file with ${parsedSpriteData.sprites.length} sprites`);
            // Initialize sprite mapping
            let spriteIndices = Array.from({ length: 256 }, (_, i) => i);
            // Perform deduplication if requested
            if (shouldDeduplicate === 'Yes') {
                // Import deduplication utilities
                const { detectDuplicates, defaultOptions, createSpriteMapping } = require('./spriteDedupUtils');
                // Detect duplicates
                const duplicates = detectDuplicates(parsedSpriteData, defaultOptions);
                console.log(`Found ${duplicates.length} duplicate sprites`);
                // Create mapping from original indices to deduplicated indices
                if (duplicates.length > 0) {
                    spriteIndices = createSpriteMapping(parsedSpriteData.sprites.length, duplicates);
                    console.log(`Created sprite mapping for ${spriteIndices.length} sprites`);
                }
            }
            // Ask user for block dimensions
            const blockWidthInput = await vscode.window.showInputBox({
                prompt: 'Enter block width (in sprites)',
                value: '1'
            });
            if (!blockWidthInput) {
                vscode.window.showInformationMessage('Conversion cancelled: No block width provided.');
                return;
            }
            const blockHeightInput = await vscode.window.showInputBox({
                prompt: 'Enter block height (in sprites)',
                value: '1'
            });
            if (!blockHeightInput) {
                vscode.window.showInformationMessage('Conversion cancelled: No block height provided.');
                return;
            }
            const blockWidth = parseInt(blockWidthInput);
            const blockHeight = parseInt(blockHeightInput);
            if (isNaN(blockWidth) || blockWidth <= 0 || isNaN(blockHeight) || blockHeight <= 0) {
                vscode.window.showErrorMessage('Invalid block dimensions. Please enter positive numbers.');
                return;
            }
            // Default sprite dimensions for ZX Next
            const spriteWidth = 16;
            const spriteHeight = 16;
            // Import the optimizer
            const { createOptimizedBlockFormat, serializeOptimizedBlockFile } = require('./optimizedBlockUtils');
            const optimizedBlockData = createOptimizedBlockFormat(blockData, spriteIndices, blockWidth, blockHeight, spriteWidth, spriteHeight);
            console.log(`Created optimized block format with ${optimizedBlockData.blocks.length} blocks.`);
            // Serialize the optimized block data
            const serializedData = serializeOptimizedBlockFile(optimizedBlockData);
            console.log(`Serialized optimized block data: ${serializedData.length} bytes.`);
            // Create output URI
            const outputPath = uri.fsPath.replace('.nxb', '.oxb');
            const outputUri = vscode.Uri.file(outputPath);
            // Write the file
            await vscode.workspace.fs.writeFile(outputUri, serializedData);
            console.log(`Wrote optimized block file to ${outputPath}`);
            // Show success message
            vscode.window.showInformationMessage(`Successfully converted to optimized block format: ${outputPath}`);
            // Ask if user wants to open the file
            const openFile = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: 'Open the optimized block file?'
            });
            if (openFile === 'Yes') {
                // Open with the optimized block viewer
                vscode.commands.executeCommand('vscode.openWith', outputUri, optimizedBlockViewerProvider_1.OptimizedBlockViewerProvider.viewType);
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error converting to optimized block format: ${error.message}`);
            console.error('Error details:', error);
        }
    });
    // Register the "Open with Optimized Block Viewer" command
    let openWithOptimizedBlockViewer = vscode.commands.registerCommand('nextbuild-viewers.openWithOptimizedBlockViewer', async (uri) => {
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (uri) {
            // Force open with our custom editor
            await vscode.commands.executeCommand('vscode.openWith', uri, optimizedBlockViewerProvider_1.OptimizedBlockViewerProvider.viewType);
        }
    });
    // Register Open with Sprite Importer with license check
    let openWithSpriteImporter = vscode.commands.registerCommand('nextbuild-viewers.openWithSpriteImporter', async (uri) => {
        // Check if this premium feature is accessible
        if (!licenseManager.checkFeatureAccess('spriteImporter')) {
            return; // Exit if user doesn't have access
        }
        // Original implementation
        if (!uri && vscode.window.activeTextEditor) {
            uri = vscode.window.activeTextEditor.document.uri;
        }
        if (!uri) {
            vscode.window.showErrorMessage('No image file selected to open in Sprite Importer.');
            return;
        }
        // Check if it's a supported image format
        const supportedFormats = ['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp'];
        const fileExt = path.extname(uri.fsPath).toLowerCase();
        if (!supportedFormats.includes(fileExt)) {
            vscode.window.showErrorMessage(`Unsupported image format: ${fileExt}. Supported formats are: ${supportedFormats.join(', ')}`);
            return;
        }
        // Open the image in the sprite importer
        new spriteImporterProvider_1.SpriteImporterProvider(context, uri);
    });
    // Register the "Open with CSpect" command
    let openWithCSpectCommand = vscode.commands.registerCommand('nextbuild-viewers.openWithCSpect', async (uri) => {
        const filePath = uri?.fsPath;
        if (!filePath) {
            vscode.window.showWarningMessage('Could not determine the NEX file path.');
            return;
        }
        const fileName = path.basename(filePath);
        const fileDir = path.dirname(filePath);
        const config = vscode.workspace.getConfiguration('nextbuild-viewers');
        const cspectPath = config.get('cspectPath');
        if (!cspectPath) {
            const result = await vscode.window.showErrorMessage('Path to CSpect.exe is not configured. Please set it in settings.', 'Open Settings', 'Cancel');
            if (result === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'nextbuild-viewers.cspectPath');
            }
            return;
        }
        try {
            await fs.promises.access(cspectPath, fs.constants.X_OK);
        }
        catch (err) {
            const result = await vscode.window.showErrorMessage(`Configured CSpect.exe path not found or not executable: ${cspectPath}`, 'Open Settings', 'Cancel');
            if (result === 'Open Settings') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'nextbuild-viewers.cspectPath');
            }
            return;
        }
        // Get the arguments and replace {directory} with the actual directory
        let cspectArgs = config.get('cspectArgs', '-w3 -esc -r -basickeys -brk -zxnext -16bit');
        cspectArgs = cspectArgs.replace('{directory}', fileDir);
        // Create or get a terminal named "CSpect Emulator"
        let terminal = vscode.window.terminals.find(t => t.name === 'CSpect Emulator');
        if (!terminal) {
            terminal = vscode.window.createTerminal(`CSpect Emulator`);
        }
        // Construct the command for the terminal
        const command = `"${cspectPath}" ${cspectArgs} "${filePath}"`;
        // Send the command to the terminal
        terminal.sendText(command);
        // Show the terminal panel
        terminal.show();
        //vscode.window.showInformationMessage(`Launched CSpect with ${fileName}`);
    });
    // Register all commands
    context.subscriptions.push(showMessage, openWithPaletteViewer, openWithSpriteViewer, openWithBlockViewer, openWithImageViewer, createCommand, playPT3Command, importSpriteCommand, toggleIconTheme, analyzeDuplicatesCommand, convertToOptimizedBlockCommand, openWithOptimizedBlockViewer, openWithSpriteImporter, openWithCSpectCommand, activateLicenseCommand);
    // Display activation message
    vscode.window.showInformationMessage('NextBuild Viewers extension has been activated!');
}
// Function to show the sponsor page
async function showSponsorPage() {
    const showPageSetting = vscode.workspace.getConfiguration('nextbuild-viewers').get('showSponsorPage', true);
    if (showPageSetting) {
        const selection = await vscode.window.showInformationMessage('Thanks for installing NextBuild Viewers! Would you like to support development on Patreon?', 'Open Patreon', 'Don\'t Show Again', 'Close');
        if (selection === 'Open Patreon') {
            // Open the Patreon page
            vscode.env.openExternal(vscode.Uri.parse('https://patreon.com/user?u=27217558'));
        }
        else if (selection === 'Don\'t Show Again') {
            await vscode.workspace.getConfiguration('nextbuild-viewers').update('showSponsorPage', false, vscode.ConfigurationTarget.Global);
        }
    }
}
// This method is called when your extension is deactivated
function deactivate() {
    console.log('Extension "nextbuild-viewers" is now deactivated.');
}
// --- Keyword Help 
// Modified: Load keyword help with metadata processing for manual-only entries
async function loadKeywordHelp(context) {
    try {
        const keywordPath = path.join(context.extensionPath, "data", "keywords.json");
        // Check if the file exists
        if (!fs.existsSync(keywordPath)) {
            console.error(`Keyword help file not found at: ${keywordPath}`);
            return false;
        }
        const fileContent = fs.readFileSync(keywordPath, "utf8");
        keywordHelp = JSON.parse(fileContent);
        // Normalize all keys to uppercase for case-insensitive lookup
        const normalizedHelp = {};
        Object.keys(keywordHelp).forEach(key => {
            const upperKey = key.toUpperCase();
            if (typeof keywordHelp[key] === 'object' && keywordHelp[key] !== null) {
                // Entry is an object with metadata
                normalizedHelp[upperKey] = keywordHelp[key];
            }
            else {
                // Old format - just a string content
                normalizedHelp[upperKey] = { content: keywordHelp[key], isManualOnly: false };
            }
        });
        keywordHelp = normalizedHelp;
        return Object.keys(keywordHelp).length > 0;
    }
    catch (error) {
        console.error('Error loading keyword help:', error);
        return false;
    }
}
async function showHelp() {
    console.log('[NextBuild Viewers] showHelp command triggered.');
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage("No active editor found");
        console.log('[NextBuild Viewers] No active editor.');
        return;
    }
    const languageId = editor.document.languageId;
    console.log(`[NextBuild Viewers] Current languageId: ${languageId}`);
    const isNextbuildFile = languageId === 'nextbuild';
    const position = editor.selection.active;
    const wordPattern = isNextbuildFile
        ? /[A-Za-z0-9_\.]+/
        : /[A-Za-z0-9_\.]+/;
    const wordRange = editor.document.getWordRangeAtPosition(position, wordPattern);
    let word = "";
    if (!wordRange) {
        //vscode.window.showInformationMessage("No keyword found at cursor position");
        console.log('[NextBuild Viewers] No wordRange found. Opening Index.');
        //return;
        word = "INDEX";
    }
    else {
        word = editor.document.getText(wordRange).toUpperCase();
        console.log(`[NextBuild Viewers] Detected word: ${word}`);
    }
    if (!word) {
        vscode.window.showInformationMessage("No keyword found at cursor position");
        console.log('[NextBuild Viewers] Empty word detected.');
        return;
    }
    await showKeywordHelp(word, isNextbuildFile);
}
// Modified: Get help content considering the new structure
async function showKeywordHelp(keyword, isNextbuildFile = false) {
    console.log('[NextBuild Viewers] Keyword help object:', keywordHelp);
    const keywordUpper = keyword.toUpperCase();
    let helpEntry = keywordHelp[keywordUpper];
    let helpContent;
    // Extract the content from the help entry, handling both formats
    if (helpEntry) {
        helpContent = typeof helpEntry === 'object' ? helpEntry.content : helpEntry;
    }
    if (!helpContent && Object.keys(keywordHelp).length > 0) {
        console.log(`[NextBuild Viewers] No exact match for ${keyword}. Searching similar...`);
        const similarKeywords = Object.keys(keywordHelp).filter(key => key.includes(keywordUpper) || keywordUpper.includes(key));
        if (similarKeywords.length > 0) {
            console.log(`[NextBuild Viewers] Similar keywords found: ${similarKeywords.join(', ')}`);
            const selected = await vscode.window.showQuickPick(similarKeywords, {
                placeHolder: `No exact match for "${keyword}". Select a similar keyword:`,
            });
            if (selected) {
                helpEntry = keywordHelp[selected];
                helpContent = typeof helpEntry === 'object' ? helpEntry.content : helpEntry;
                keyword = selected; // Update the keyword for the panel title
                console.log(`[NextBuild Viewers] User selected similar keyword: ${selected}`);
            }
        }
    }
    if (helpContent) {
        console.log(`[NextBuild Viewers] Displaying help for ${keyword}`);
        // Create a new panel - we'll always create a new one
        // since we can't reliably reuse existing panels
        const panel = vscode.window.createWebviewPanel('nextbuildKeywordHelp', `NextBuild Help: ${keyword}`, vscode.ViewColumn.Beside, {
            enableScripts: true, // Enable scripts to handle inter-keyword navigation
            localResourceRoots: [],
            retainContextWhenHidden: true
        });
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'showKeywordHelp' && message.keyword) {
                console.log(`[NextBuild Viewers] Received request to show help for: ${message.keyword}`);
                // Update the panel title
                panel.title = `NextBuild Help: ${message.keyword}`;
                // Show the new keyword help in the same panel
                await updatePanelContent(panel, message.keyword, isNextbuildFile);
            }
            else if (message.command === 'openExternalLink' && message.url) {
                // Open external links in the default browser
                vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
        }, undefined, []);
        // Update the panel content
        await updatePanelContent(panel, keyword, isNextbuildFile);
    }
    else {
        vscode.window.showInformationMessage(`No help found for keyword "${keyword}".`);
        console.log(`[NextBuild Viewers] No help content found for ${keyword}`);
    }
}
// Modified: Update panel content to support the new structure
async function updatePanelContent(panel, keyword, isNextbuildFile) {
    const keywordUpper = keyword.toUpperCase();
    const helpEntry = keywordHelp[keywordUpper];
    if (!helpEntry) {
        panel.webview.html = `<html><body><h1>Error</h1><p>No help content found for "${keyword}"</p></body></html>`;
        return;
    }
    // Extract content based on the entry type
    const helpContent = typeof helpEntry === 'object' ? helpEntry.content : helpEntry;
    const isManualEntry = typeof helpEntry === 'object' && helpEntry.isManualOnly === true;
    const entryType = isManualEntry ? 'Manual' : 'Keyword';
    // Create markdown content
    const markdownContent = `# NextBuild Help: ${keyword}
${isManualEntry ? '*Documentation entry*' : ''}
${isNextbuildFile ? '*Context: NextBuild Studio language*' : ''}

${helpContent}`;
    // Convert markdown to HTML
    const html = markdownToHtml(markdownContent);
    // Set the HTML content
    panel.webview.html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>NextBuild Help: ${keyword}</title>
			<style>
				body {
					font-family: var(--vscode-editor-font-family);
					font-size: var(--vscode-editor-font-size);
					padding: 0 20px;
					line-height: 1.0;
					color: var(--vscode-editor-foreground);
					background-color: var(--vscode-editor-background);
				}
				
				pre {
					background-color: var(--vscode-textCodeBlock-background);
					padding: 1em;
					border-radius: 3px;
					padding: 16px;
					overflow: auto;
					font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
				}
				code {
					font-family: var(--vscode-editor-font-family);
					background-color: var(--vscode-textCodeBlock-background);
					padding: 0.2em 0.4em;
					font-family: Consolas, "Liberation Mono", Menlo, Courier, monospace;
				}
				
				blockquote {
					border-left: 5px solid var(--vscode-textBlockQuote-border);
					margin: 0;
					padding-left: 1em;
				}
				
				a {
					color: var(--vscode-textLink-foreground);
					text-decoration: underline;
					cursor: pointer;
				}
				
				a:hover {
					color: var(--vscode-textLink-activeForeground);
				}
				
				h1, h2, h3 {
					font-weight: 600;
					margin-top: 24px;
					margin-bottom: 16px;
					line-height: 1.25;
				}
				
				h1 {
					font-size: 2em;
					border-bottom: 1px solid var(--vscode-panel-border);
					padding-bottom: 0.3em;
				}
				
				h2 {
					font-size: 1.5em;
				}
				
				h3 {
					font-size: 1.25em;
				}
				
				ul, ol {
					padding-left: 2em;
				}
				
				img {
					max-width: 100%;
				}
				
				p, li {
					margin: 0 0 16px 0;
				}
				
				hr {
					height: 1px;
					background-color: var(--vscode-panel-border);
					border: none;
				}
				
				.navigation {
					margin-top: 20px;
					padding-top: 10px;
					border-top: 1px solid var(--vscode-panel-border);
				}
				
				.keywords-list {
					display: flex;
					flex-wrap: wrap;
					gap: 10px;
				}
				
				.keyword-chip {
					background-color: var(--vscode-badge-background);
					color: var(--vscode-badge-foreground);
					border-radius: 3px;
					padding: 2px 8px;
					font-size: 0.9em;
					cursor: pointer;
				}
				
				.keyword-chip:hover {
					background-color: #0366d6;
					color: white;
				}
				.manual-entry {
					background-color: var(--vscode-editor- );
				}
				.keyword-link {
					color: #0366d6;
					text-decoration: none;
				}
				.keyword-link:hover {
					text-decoration: underline;
				}
				.entry-type {
					color: #6a737d;
					margin-bottom: 20px;
				}
			</style>
		</head>
		<body>
			<div class="entry-type">${entryType}</div>
			${html}
			
			<div class="navigation">
				<h3>All Available Keywords</h3>
				<div class="keywords-list">
					${Object.keys(keywordHelp).map(key => {
        const isManual = typeof keywordHelp[key] === 'object' && keywordHelp[key].isManualOnly === true;
        return `<span class="keyword-chip ${isManual ? 'manual-entry' : ''}" data-keyword="${key}">${key}</span>`;
    }).join('')}
				</div>
			</div>
			
			<script>
				// Use VS Code API for sending messages
				const vscode = acquireVsCodeApi();
				
				// Function to navigate to another keyword
				function showKeyword(keyword) {
					// Send a message to the extension
					vscode.postMessage({
						command: 'showKeywordHelp',
						keyword: keyword
					});
				}
				
				// Add click handlers to all keyword links
				document.querySelectorAll('.keyword-link').forEach(link => {
					link.addEventListener('click', (event) => {
						event.preventDefault();
						const keyword = link.getAttribute('data-keyword');
						if (keyword) {
							showKeyword(keyword);
						}
					});
				});
				
				// Add click handlers to all keyword chips
				document.querySelectorAll('.keyword-chip').forEach(chip => {
					chip.addEventListener('click', (event) => {
						const keyword = chip.getAttribute('data-keyword');
						if (keyword) {
							showKeyword(keyword);
						}
					});
				});
				
				// Handle external links
				document.querySelectorAll('.external-link').forEach(link => {
					link.addEventListener('click', (event) => {
						event.preventDefault();
						// Request the VS Code extension to open this URL
						vscode.postMessage({
							command: 'openExternalLink',
							url: link.getAttribute('href')
						});
					});
				});
			</script>
		</body>
		</html>
	`;
}
// Simple markdown to HTML converter
function markdownToHtml(markdown) {
    // Split the markdown into lines
    const lines = markdown.split('\n');
    let html = '';
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeContent = '';
    let inOrderedList = false;
    let inUnorderedList = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Handle code blocks
        if (line.trim().startsWith('```')) {
            if (!inCodeBlock) {
                // Start of code block
                inCodeBlock = true;
                codeLanguage = line.trim().substring(3).trim();
                codeContent = '';
            }
            else {
                // End of code block
                html += `<pre><code class="language-${codeLanguage}">${escapeHtml(codeContent)}</code></pre>`;
                inCodeBlock = false;
            }
            continue;
        }
        if (inCodeBlock) {
            codeContent += line + '\n';
            continue;
        }
        // Handle headings
        if (line.startsWith('# ')) {
            html += `<h1>${formatInlineMarkdown(line.substring(2))}</h1>`;
        }
        else if (line.startsWith('## ')) {
            html += `<h2>${formatInlineMarkdown(line.substring(3))}</h2>`;
        }
        else if (line.startsWith('### ')) {
            html += `<h3>${formatInlineMarkdown(line.substring(4))}</h3>`;
        }
        // Handle lists
        else if (line.trim().match(/^\d+\.\s/)) {
            // Ordered list item
            const content = line.replace(/^\d+\.\s/, '');
            if (!inOrderedList) {
                html += '<ol>';
                inOrderedList = true;
            }
            html += `<li>${formatInlineMarkdown(content)}</li>`;
            // Check if the next line is not a list item
            if (i === lines.length - 1 || !lines[i + 1].trim().match(/^\d+\.\s/)) {
                html += '</ol>';
                inOrderedList = false;
            }
        }
        else if (line.trim().startsWith('* ')) {
            // Unordered list item
            const content = line.replace(/^\*\s/, '');
            if (!inUnorderedList) {
                html += '<ul>';
                inUnorderedList = true;
            }
            html += `<li>${formatInlineMarkdown(content)}</li>`;
            // Check if the next line is not a list item
            if (i === lines.length - 1 || !lines[i + 1].trim().startsWith('* ')) {
                html += '</ul>';
                inUnorderedList = false;
            }
        }
        // Handle blockquotes
        else if (line.startsWith('> ')) {
            html += `<blockquote>${formatInlineMarkdown(line.substring(2))}</blockquote>`;
        }
        // Handle horizontal rule
        else if (line.trim() === '---') {
            html += '<hr>';
        }
        // Empty line becomes paragraph break
        else if (line.trim() === '') {
            html += '<br>';
        }
        // Regular paragraph
        else {
            html += `<p>${formatInlineMarkdown(line)}</p>`;
        }
    }
    // Close any open lists
    if (inOrderedList) {
        html += '</ol>';
    }
    if (inUnorderedList) {
        html += '</ul>';
    }
    return html;
}
// Format inline markdown elements
function formatInlineMarkdown(text) {
    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Handle links with special processing
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, linkTarget) => {
        // Get a possible keyword from the linkTarget - handle both with and without .md extension
        let keywordCandidate;
        if (linkTarget.endsWith('.md')) {
            keywordCandidate = linkTarget.replace(/\.md$/, '').toUpperCase();
        } else {
            // Handle links without .md extension - just use the linkTarget directly
            keywordCandidate = linkTarget.toUpperCase();
        }
        
        // Check if the extracted keyword exists in our keyword database
        if (keywordHelp[keywordCandidate]) {
            // It's a keyword link - create a command link to show that keyword's help
            return `<a href="#" data-keyword="${keywordCandidate}" class="keyword-link">${linkText}</a>`;
        }
        
        // Case 2: External link with explicit web:// prefix
        if (linkTarget.startsWith('web://')) {
            const actualUrl = linkTarget.substring(6); // Remove the web:// prefix
            return `<a href="${actualUrl}" target="_blank" class="external-link">${linkText}</a>`;
        }
        // Case 3: Standard http/https URLs
        if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
            return `<a href="${linkTarget}" target="_blank" class="external-link">${linkText}</a>`;
        }
        // Case 4: Default handling for other links (could be file paths or unknown types)
        return `<a href="${linkTarget}" class="unknown-link">${linkText}</a>`;
    });
    return text;
}
// Escape HTML special characters
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
// Add after the showHelp function
async function editKeywordsFile(context) {
    try {
        const keywordPath = path.join(context.extensionPath, "data", "keywords.json");
        // Check if the directory exists, if not create it
        const dataDir = path.join(context.extensionPath, "data");
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Check if the file exists, if not create a template
        if (!fs.existsSync(keywordPath)) {
            const template = {
                "IF": {
                    "content": "```z80\nIF … THEN … [ELSE …] END IF\n```\nBranches based on condition.",
                    "isManualOnly": false
                },
                "FOR": {
                    "content": "```z80\nFOR var = start TO end [STEP s] … NEXT\n```\nCreates a loop from start to end.",
                    "isManualOnly": false
                },
                "SPRITES": {
                    "content": "# Sprite System\n\n## Overview\nThis manual page describes how to use sprites in NextBuild.\n\n## Formats\nSprites can be defined in various formats...",
                    "isManualOnly": true
                },
                "EXAMPLE_KEYWORD": "For backwards compatibility, you can still use simple strings for content.",
                "FORMAT_NOTE": {
                    "content": "For more control, use object format with 'content' and 'isManualOnly' properties.\nSet isManualOnly to true for manual-only pages that won't show in hover help.",
                    "isManualOnly": true
                }
            };
            fs.writeFileSync(keywordPath, JSON.stringify(template, null, 2), "utf8");
        }
        // Open the file in the editor
        const uri = vscode.Uri.file(keywordPath);
        await vscode.commands.executeCommand('vscode.open', uri);
        // Show info message
        vscode.window.showInformationMessage('Edit keywords.json file. For standard keywords, use "KEYWORD": { "content": "markdown content" }. ' +
            'For manual-only entries, add "isManualOnly": true to prevent them from appearing in hover help.');
        return true;
    }
    catch (error) {
        console.error('Error editing keywords file:', error);
        vscode.window.showErrorMessage(`Error opening keywords file: ${error}`);
        return false;
    }
}
//# sourceMappingURL=extension.js.map