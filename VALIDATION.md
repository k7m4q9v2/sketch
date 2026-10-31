# Validation — 2026-10-31

- 79 automated checks pass: actual WASM audio, MIDI/WAV encoding, loops, envelopes, delay, touch gestures, snapping, copy/paste, octave edits, large-bank subsetting, bundled-bank caching, immediate warm previews, preview cancellation, and context recovery.
- Warm note previews dispatch immediately without calling resume or loading unrelated channel banks. Cold previews load their own bank; full loop playback still prepares all channels. Channel selection prepares its audio before note entry.
- A local-only browser harness suspended the real AudioContext while playing. The app showed Resume playback at position 02:04:92, restored AUDIO READY and continued at 03:01:38 when focus returned, and also resumed with a single manual tap. Returning to Projects during interruption kept audio suspended when focus returned. The harness is outside the deployed site.
- All 13 bundled banks decode and produce finite, non-silent PCM with their first preset in the actual WASM engine. This includes all 12 newly supplied files, using selected-preset subsetting for the 65.66 MiB GenesiSF bank.
- Catalog integrity checks compare all bank sizes, content IDs, sample lengths, and all 1,975 preset records against the shipped files. SF2 audio is excluded from the service worker installation cache.
- Cache tests verify lazy download, concurrent request deduplication, offline reuse after storage restoration, retry after download/storage failure, correct asset routing, and rejection of corrupted downloads.
- Browser verification lists all 13 banks. Selected GenesiSF, entered a note, saved, stopped the HTTP server, reloaded, and resumed playback with AUDIO READY from the saved bank. No server was available for a second download.
- All 275 GeneralUser GS preset names are compared with the original SF2 headers. Embedded NUL plus line-break/binary padding is excluded. Existing names are repaired on restore.
- Static package check passes: module references, service-worker assets, the GM bank SHA-256, and no server/account/upload API dependency.
- Browser preview runs at a repository subpath (`/sketch/`), matching GitHub Pages routing. No sign-in is required.
- Created a project, changed instrument, entered three notes, reloaded, restored the project and reached AUDIO READY with the saved bank.
- Stopped the QA HTTP server, reloaded from the app cache, restored the project, and started playback without the server.
- Browser WAV export completed: stereo, 44.1 kHz, 16-bit PCM, 1.8 MB.
- The public `site/` directory contains only app assets and the 13 explicitly bundled banks. It contains no user projects, server code, account database, or credentials. Test fixtures remain outside the deployed directory. SoundFonts imported by visitors stay on their devices.
- Physical iPhone Safari recording performance is not verified. The reported delayed output and silent/distorted saved recording are not claimed resolved on device. The app no longer stops/reset its sequencer on a temporary audio-context interruption. Low-latency playback is requested, but hardware/browser capture latency is outside the app's direct control.
- Data from the previous chatgpt.site origin is retained there and is not automatically transferred to the new domain.
