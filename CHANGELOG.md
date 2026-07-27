# Changelog

All notable changes to `hawk-sdk-typescript` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-07-25

### Added
- Initial release of the TypeScript SDK for the Hawk daemon API.
- `HawkClient` with `chat`, `chatStream`, `chatWithTools`, `sessions`, `session`, `messages`, `graph`, `deleteSession`, `stats`, and `health` methods.
- `Agent` class for declarative multi-turn conversations with automatic session tracking.
- Streaming support via `chatStream` with SSE event iteration.
- Tool execution loop with `chatWithTools`.
- Typed error hierarchy (`APIError`, `NotFoundError`, `RateLimitError`, etc.).
- Retry configuration with exponential backoff and `Retry-After` support.
- Portable graph models (`GraphExport`, `GraphNode`, `GraphEdge`, `GraphEvent`) with `parseGraphExport` validation.
- Zero-dependency runtime build for Node 18+.
