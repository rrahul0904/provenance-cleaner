# Security and content-handling rules

- Do not log raw pasted text or uploaded file contents.
- Do not persist raw content by default.
- Validate file type by magic bytes, not only filename or MIME headers.
- Bound text length, upload size, decompression ratio, parser time, and rewrite retries.
- Treat DOCX/PDF/SVG/ZIP-like formats as hostile input.
- Run file parsers in an isolated worker with no unnecessary network access.
- Receipts should contain metrics, finding types, hashes, and operation metadata—not document bodies.
- Never label output "undetectable", "detector-proof", or "watermark removed" when no first-party verification exists.
