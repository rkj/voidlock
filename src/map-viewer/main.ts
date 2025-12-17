import { MapRenderer } from './MapRenderer';
import { MapDefinition } from '../shared/types';

const mapInput = document.getElementById('map-input') as HTMLTextAreaElement;
const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
const errorMsg = document.getElementById('error-msg') as HTMLDivElement;
const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
const zoomValue = document.getElementById('zoom-value') as HTMLSpanElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const canvas = document.getElementById('map-canvas') as HTMLCanvasElement;

const renderer = new MapRenderer(canvas);
let currentMap: MapDefinition | null = null;

function loadMap() {
    errorMsg.textContent = '';
    const jsonStr = mapInput.value;
    if (!jsonStr.trim()) {
        errorMsg.textContent = 'Please paste JSON content.';
        return;
    }

    try {
        const map = JSON.parse(jsonStr) as MapDefinition;
        // Basic validation
        if (!map.width || !map.height || !Array.isArray(map.cells)) {
            throw new Error("Invalid MapDefinition: Missing width, height, or cells array.");
        }
        currentMap = map;
        render();
    } catch (e: any) {
        errorMsg.textContent = `Error: ${e.message}`;
    }
}

function render() {
    if (!currentMap) return;
    renderer.render(currentMap);
}

loadBtn.addEventListener('click', loadMap);

zoomSlider.addEventListener('input', () => {
    const size = parseInt(zoomSlider.value, 10);
    zoomValue.textContent = `${size}px`;
    renderer.setCellSize(size);
    render();
});

downloadBtn.addEventListener('click', () => {
    if (!currentMap) return;
    const link = document.createElement('a');
    link.download = 'map-render.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Load initial example if empty (optional, but good for testing)
// For now, leave empty.
