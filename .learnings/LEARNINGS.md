# Learnings Log

## [LRN-20261119-001] best_practice

**Logged**: 2026-11-19T16:55:00+08:00
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
Editing freeflow with apply_patch requires matching the repo's mixed 1-space/2-space indentation exactly; test data URIs must be built by concatenation, never typed into PowerShell here-strings.

### Details
The freeflow source files mix indentation styles (module-level blocks with 1 leading space, 2-space bodies), so apply_patch context lines must reproduce the exact leading whitespace — a context line with one space too many fails verification ("Failed to find expected lines"). CRLF line endings are handled fine by apply_patch.

Separately, literal data: / base64 URLs typed inside the @'...'@ here-strings passed through exec_command get mangled (verified: the same regex matched a concatenated string but not the here-string literal). When writing Node test scripts that need data: URIs or /materials/ paths, always build them with 'data:' + 'image/png;base64,' + ... concatenation inside the JS file. Also beware the classic g-flag regex + repeated exec() lastIndex trap when debugging replace-based logic.

**See Also**: ERRORS.md for the GitHub PAT failure recorded the same day.
