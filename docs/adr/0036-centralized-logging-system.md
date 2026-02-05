# ADR 0036: Centralized Logging System

## Status

Accepted

## Context

Currently, the application relies on raw `console.log`, `console.warn`, and `console.error` calls scattered throughout the codebase. This leads to several issues:
1.  **Noise**: High-frequency logs (e.g., from AI behaviors or replay ticking) spam the console, making it difficult to spot critical errors.
2.  **Production Safety**: Debug logs often leak into production builds, potentially exposing internal logic or impacting performance.
3.  **Inconsistency**: There is no standard format or filtering mechanism for logs.

## Decision

We will implement a centralized `Logger` utility to manage all application logging.

### 1. Log Levels
We will define strict log levels:
-   `DEBUG`: detailed tracing (AI decisions, pathfinding steps).
-   `INFO`: High-level events (Mission Start, Unit Death).
-   `WARN`: Non-critical issues (Missing assets, recoverable state errors).
-   `ERROR`: Critical failures (Exceptions, undefined states).
-   `NONE`: Silence.

### 2. Configuration
The `Logger` will be configurable globally:
-   **Development**: Default to `INFO` (or `DEBUG` via a specific toggle).
-   **Production**: Default to `ERROR` (strictly enabled only for critical failures).
-   **Runtime**: The log level can be adjusted at runtime via the browser console (e.g., `window.GameAppInstance.setLogLevel('DEBUG')`) to assist with debugging live production issues if necessary.

### 3. Implementation
-   The `Logger` class will wrap the native `console` API.
-   It will support styled output for better readability.
-   It will be exposed as a singleton or static utility class.

## Consequences

-   **Positive**: Drastically reduced console noise. Better performance in production. consistent debugging experience.
-   **Negative**: Requires refactoring existing `console.log` calls to use the new `Logger`.
-   **Maintenance**: Developers must discipline themselves to use `Logger` instead of `console`.
