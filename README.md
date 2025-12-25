# Xenopurge

Deterministic Real-Time with Pause (RTwP) tactical squad combat in a claustrophobic spaceship environment.

## Overview

Xenopurge is a web-based tactical game built with Vanilla TypeScript and Vite. It features a deterministic simulation engine running in a Web Worker, ensuring consistent gameplay and perfect replays.

## Key Features

- **Deterministic Simulation:** Seed-based PRNG ensures every run is reproducible.
- **RTwP Combat:** Methodical tactical management with real-time resolution.
- **Procedural Generation:** Unique ship layouts using tree-structured acyclic graphs.
- **Fog of War:** Claustrophobic visibility determined by edge-based "thin" walls.

## Tech Stack

- **Language:** TypeScript
- **Build Tool:** Vite
- **Rendering:** HTML5 Canvas
- **Engine:** Web Workers (background simulation)
- **Testing:** Vitest

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Testing

```bash
npx vitest run
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - Deep dive into the engine, communication protocol, and simulation logic.
- [Specification](./spec.md) - Detailed game design document.
