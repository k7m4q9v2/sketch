# Validation — 2026-10-31

- 58 automated checks pass: actual WASM audio, MIDI/WAV encoding, loops, envelopes, delay, touch gestures, snapping, copy/paste, octave edits, and large-bank subsetting.
- All 275 GeneralUser GS preset names are compared with the original SF2 headers. Embedded NUL plus line-break/binary padding is excluded. Existing names are repaired on restore.
- Static package check passes: module references, service-worker assets, the GM bank SHA-256, and no server/account/upload API dependency.
- Browser preview runs at a repository subpath (`/sketch/`), matching GitHub Pages routing. No sign-in is required.
- Created a project, changed instrument, entered three notes, reloaded, restored the project and reached AUDIO READY with the saved bank.
- Stopped the QA HTTP server, reloaded from the app cache, restored the project, and started playback without the server.
- Browser WAV export completed: stereo, 44.1 kHz, 16-bit PCM, 1.8 MB.
- The public `site/` directory contains no user projects, personal imported SF2 files, server code, account database, or credentials. Test fixtures remain outside the deployed directory.
- Physical iPhone Safari recording performance is not verified. Screen-recording crackle has mitigation but no confirmed device-level resolution.
- Data from the previous chatgpt.site origin is retained there and is not automatically transferred to the new domain.
