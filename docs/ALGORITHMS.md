# Voidlock Algorithmic Documentation

This document provides high-level explanations of the complex algorithms used in the Voidlock game engine.

## 1. Map Generation

Voidlock uses several procedural generation strategies to create diverse and tactical map layouts.

### 1.1 Spaceship Generator (Constructive Spanning Tree)
Generates spaceship-like layouts using a constructive approach that guarantees connectivity.
1. **Grid Partitioning**: Divides the map into a grid of potential room nodes.
2. **Key Node Selection**: Picks nodes for spawn points, extraction, and objectives in different quadrants.
3. **Prim's Algorithm**: Finds a spanning tree connecting all key nodes using random weights.
4. **Cycle Injection**: Adds additional edges to create tactical loops and reduce bottlenecks.
5. **Realization**: Carves rooms and 1-cell wide corridors.

### 1.2 Tree-Ship Generator (Recursive Growth)
Generates maps with a strict tree structure (no cycles), creating a claustrophobic feel.
1. **Skeleton**: Creates a central spine (Fishbone or Cross pattern) of corridors.
2. **Growth Frontier**: Initializes potential room locations adjacent to the skeleton.
3. **Recursive Placement**: Iteratively places rooms from the frontier, ensuring no cycles or collisions.
4. **Connectivity**: Uses doors to connect rooms back to their parent cells.

### 1.3 Dense-Ship Generator (Greedy Filling)
Generates high-density layouts for maximum exploration depth.
1. **Frame**: Builds a primary backbone of corridors.
2. **Greedy Filling**: Iteratively places rooms of various shapes adjacent to existing floors until the map is packed.
3. **High Connectivity**: Ensures every room connects to its parent via a door.

## 2. Tactical Systems

### 2.1 Escort Formation Logic (`FormationManager`)
Handles dynamic unit positioning when protecting a VIP.
- **Heading-Based Rotation**: The entire formation rotates based on the target's movement direction.
- **Roles**:
  - **Vanguard**: Front protection and path clearing.
  - **Rearguard**: Rear security and flanking prevention.
  - **Bodyguard**: Close-range side protection.
- **Speed Synchronization**: Escorts match the target's speed when in position to maintain formation integrity.

### 2.2 Geometric LOS and LOF (`LineOfSight`)
Uses high-precision raycasting to determine visibility and combat opportunities.
- **Amanatides-Woo Raycasting**: Efficiently traverses the grid cell-by-cell.
- **Fat Ray Sampling**: Samples three parallel rays (center + offsets) to account for unit physical radius.
- **LOS (Line of Sight)**: "At least one ray" logic. Allows seeing through opening doors.
- **LOF (Line of Fire)**: "All rays" logic. Requires fully open doors and clear paths for the entire unit width.
- **Door Struts**: The outer 1/3 of every door boundary always blocks LOS/LOF to simulate structural frames.

### 2.3 Pathfinder (`Pathfinder`)
Implements Breadth-First Search (BFS) for grid navigation.
- **Connectivity-Aware**: Respects shared-wall boundaries and door states.
- **Intent-Based Pathing**: Supports finding paths through closed (but unlocked) doors by treating them as traversable during the search.

## 3. Utility Algorithms

### 3.1 Fisher-Yates Shuffle
Used throughout the engine (e.g., `MissionManager`, `PRNG`) to provide unbiased random permutations of arrays. This is critical for fair objective placement and random event selection.

### 3.2 Spatial Partitioning (`SpatialGrid`)
Optimizes coordinate-based entity queries (loot, enemies) by partitioning the map into a grid. Reduces O(N²) visibility and proximity checks to O(1) or O(K) where K is the number of entities in nearby cells.
