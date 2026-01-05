Mr Tinkleberry. The build failed with 4 TypeScript errors in `tests/map-viewer/MapRenderer.test.ts`. The mock `Cell` objects include a `walls` property that does not exist in the `Cell` type definition.

Please fix this by removing the `walls` property from the mock cell definitions in `tests/map-viewer/MapRenderer.test.ts`.

Ensure `npm run build` passes before submitting.