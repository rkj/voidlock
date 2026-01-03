Tests failed with error in `src/renderer/tests/EnemyLOSVisibility.test.ts`:
`TypeError: Cannot read properties of undefined (reading 'calls')` at line 153.

Investigation shows that `vi.mock` uses `../../VisibilityPolygon` while the import uses `../VisibilityPolygon`. These must match for the mock to be correctly applied.

Please fix this and any other similar discrepancies in the moved test files.
Then run all tests to ensure they pass.
Also verify that `npm run build` still passes.