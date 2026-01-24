import { MapRenderer } from "./MapRenderer";
import { MapDefinition } from "../shared/types";

const mapInput = document.getElementById("map-input") as HTMLTextAreaElement;
const loadBtn = document.getElementById("load-btn") as HTMLButtonElement;
const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const zoomSlider = document.getElementById("zoom-slider") as HTMLInputElement;
const zoomValue = document.getElementById("zoom-value") as HTMLSpanElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const downloadBtn = document.getElementById(
  "download-btn",
) as HTMLButtonElement;
const downloadSvgBtn = document.getElementById(
  "download-svg-btn",
) as HTMLButtonElement;
const coordsCheckbox = document.getElementById(
  "coords-checkbox",
) as HTMLInputElement;
const canvas = document.getElementById("map-canvas") as HTMLCanvasElement;
const canvasWrapper = document.getElementById(
  "canvas-wrapper",
) as HTMLDivElement;

const renderer = new MapRenderer(canvas);
let currentMap: MapDefinition | null = null;

// Panning state
let isPanning = false;
let startX = 0;
let startY = 0;
let scrollLeft = 0;
let scrollTop = 0;

function loadMap() {
  errorMsg.textContent = "";
  const jsonStr = mapInput.value;
  if (!jsonStr.trim()) {
    errorMsg.textContent = "Please paste JSON content.";
    return;
  }

  try {
    const map = JSON.parse(jsonStr) as MapDefinition;
    // Basic validation
    if (!map.width || !map.height || !Array.isArray(map.cells)) {
      throw new Error(
        "Invalid MapDefinition: Missing width, height, or cells array.",
      );
    }
    currentMap = map;
    render();
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    errorMsg.textContent = `Error: ${message}`;
  }
}

function render() {
  if (!currentMap) return;
  renderer.setShowCoordinates(coordsCheckbox.checked);
  renderer.render(currentMap);
}

loadBtn.addEventListener("click", loadMap);

zoomSlider.addEventListener("input", () => {
  const size = parseInt(zoomSlider.value, 10);
  zoomValue.textContent = `${size}px`;
  renderer.setCellSize(size);
  render();
});

resetBtn.addEventListener("click", () => {
  zoomSlider.value = "64";
  zoomValue.textContent = "64px";
  renderer.setCellSize(64);
  render();
  // Center map
  if (currentMap) {
    const width = currentMap.width * 64;
    const height = currentMap.height * 64;
    canvasWrapper.scrollLeft = (width - canvasWrapper.clientWidth) / 2;
    canvasWrapper.scrollTop = (height - canvasWrapper.clientHeight) / 2;
  }
});

coordsCheckbox.addEventListener("change", render);

downloadBtn.addEventListener("click", () => {
  if (!currentMap) return;
  const link = document.createElement("a");
  link.download = `map-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

downloadSvgBtn.addEventListener("click", () => {
  if (!currentMap) return;
  const svgData = renderer.toSVG(currentMap);
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `map-${Date.now()}.svg`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
});

// Interactive Pan
canvasWrapper.addEventListener("mousedown", (e) => {
  isPanning = true;
  canvasWrapper.style.cursor = "grabbing";
  startX = e.pageX - canvasWrapper.offsetLeft;
  startY = e.pageY - canvasWrapper.offsetTop;
  scrollLeft = canvasWrapper.scrollLeft;
  scrollTop = canvasWrapper.scrollTop;
});

canvasWrapper.addEventListener("mouseleave", () => {
  isPanning = false;
  canvasWrapper.style.cursor = "default";
});

canvasWrapper.addEventListener("mouseup", () => {
  isPanning = false;
  canvasWrapper.style.cursor = "default";
});

canvasWrapper.addEventListener("mousemove", (e) => {
  if (!isPanning) return;
  e.preventDefault();
  const x = e.pageX - canvasWrapper.offsetLeft;
  const y = e.pageY - canvasWrapper.offsetTop;
  const walkX = (x - startX) * 2;
  const walkY = (y - startY) * 2;
  canvasWrapper.scrollLeft = scrollLeft - walkX;
  canvasWrapper.scrollTop = scrollTop - walkY;
});

// Interactive Zoom (Mouse Wheel)
canvasWrapper.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -16 : 16;
      const currentSize = parseInt(zoomSlider.value, 10);
      const newSize = Math.min(256, Math.max(32, currentSize + delta));

      if (newSize !== currentSize) {
        zoomSlider.value = newSize.toString();
        zoomValue.textContent = `${newSize}px`;
        renderer.setCellSize(newSize);
        render();
      }
    }
  },
  { passive: false },
);

// Load initial example if empty (optional, but good for testing)
// For now, leave empty.
