# Provenance Cleaner Safe Editor — Chrome

This Manifest V3 extension provides in-place protected rewriting for selected text.

## What it does

- Uses the same `/api/v1/transform` endpoint as other developer clients.
- Supports mode, purpose, and rewrite intensity.
- Replaces selected text in `input`, `textarea`, and `contenteditable` surfaces.
- Keeps a single in-memory undo record for the last page edit.
- Shows a copyable result for read-only selections.
- Stores only the developer API key, API base URL, and preferences in `chrome.storage.local`.
- Does **not** store selected source text or generated output.

## Local installation

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select `extension/chrome`.
4. Create a developer API key from the Provenance Cleaner Account page.
5. Paste that key into the extension popup and save settings.

The production host permission is limited to `https://provenance-cleaner.vercel.app/*`; localhost is also allowed for development.
