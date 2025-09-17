# Solution Overview

## Backend

### Items API
- Replaced blocking I/O with non-blocking `fs/promises` and made route handlers `async`.
- Introduced an in-memory cache to avoid re-reading and re-parsing on every request.
  - Coalesced concurrent first-loads via `loadingPromise`.
  - Serialized writes via a `writeChain` to prevent races under concurrent POSTs.
  - Precomputed `_nameLower` for fast case-insensitive substring search. This helper field is stripped from responses and disk.
- Path awareness: cache is tied to a data path so tests (or env changes) can swap files safely.
- Validation: minimal check for `name` on POST; returns 400 on invalid input.
- Helper: `asyncHandler` centralizes async error propagation.

### Stats API
- Previously recomputed on every request; now caches computed stats with mtime-based invalidation:
  - On each request, stat the data file (cheap) and recompute only if `mtime` changed.
  - Coalesces concurrent recomputes using a `computing` promise.
  - Handles empty arrays: returns `{ total: 0, averagePrice: 0 }`.

### Shared utilities
- `src/utils/dataPath.js`: `getDataPath()` resolves the items JSON path at call-time, supporting `ITEMS_DATA_PATH` for tests and overrides.
- `src/app.js`: constructs the Express app (routes + middleware) without starting the HTTP server; used by tests.
- `src/index.js`: production entry that starts the server.

### Trade-offs
- Kept JSON file storage (per assignment). For multi-process or higher write rates, a DB or file locking would be needed.
- ID uses `Date.now()` for simplicity; a UUID would be stronger.
- Cache is process-local and authoritative; no TTL or file watch to keep code lean. Easy to add if requirements expand.

## Frontend
### Items page improvements
- Fixed memory leak: all fetches use `AbortController`; in-flight requests are aborted on re-query/unmount.
- Server-side pagination and search: uses `offset`, `limit`, and `q`; reads `X-Total-Count` for page count.
- Virtualization: integrated `react-window` (`FixedSizeList`) to render only visible rows.
- UX: loading state, accessible pagination (`aria-label`), loading skeletons and keyboard-friendly controls.

## Testing
- Backend: Jest + Supertest tests cover:
  - Items: list/search (`q`), `limit`, detail 200/404, create + persistence.
  - Stats: computes and caches; invalidates when the data file changes; handles empty data.
- Frontend: Testing Library integration tests verify initial load, pagination, search, virtualization, and request aborts.


