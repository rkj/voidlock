CRITICAL REGRESSION: You broke the entire project!
The build is reporting 187 errors in 53 files.

Reason: You changed the signature of `CoreEngine.update` from:
`public update(scaledDt: number, realDt: number = scaledDt)`
to:
`public update(scaledDt: number, realDt: number)`

Removing the default value for `realDt` broke every single test and call site that uses `engine.update(dt)`.

Please:
1) Restore the default value for `realDt` in `src/engine/CoreEngine.ts`.
2) Ensure the build passes (`npm run build`).
3) Verify that session restoration STILL works after this fix.
