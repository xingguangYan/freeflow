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

## [LRN-20261119-002] pitfall

**Logged**: 2026-11-19T18:30:00+08:00
**Priority**: high
**Status**: pending
**Area**: ci/release

### Summary
Never hardcode tag_name in a release workflow (all builds silently land on one Release), and never hash files captured through PowerShell pipes (`git show ... | ...`) — pipe capture truncates large content and fabricates hash mismatches.

### Details
The release workflow had four hardcoded `tag_name: v1.9.4` upload steps, so every later CI build overwrote the v1.9.4 Release assets while v1.9.5/v1.9.6 releases stayed empty. Fix: `tag_name: ${{ github.event.inputs.tag || github.ref_name }}` plus `ref: ${{ github.event.inputs.tag || github.ref }}` on checkout, so workflow_dispatch with a `tag` input rebuilds any historical version into its own Release (workflow_dispatch uses the workflow file from the dispatch branch, not the checkout ref, so old tags get the fixed workflow too).

While auditing the rebuilt mobile artifacts, `git show <tag>:public/app.js` captured into a PowerShell variable yielded a 1.5KB string for an 82,975-byte blob, which looked like the APKs embedded a stale web bundle. Verify blob sizes with `git cat-file -s` and hash via `cmd /c "git cat-file blob <ref>:<path> > file"` + `Get-FileHash`; only then compare against ZipFile-extracted APK/IPA entries. Verified final state: v1.9.4 (292C8572...), v1.9.5 and v1.9.6 (71C39545...; the front-end app.js is identical between those two because the v1.9.6 image fix lives server-side in adapters/automation/runner).

**See Also**: ERRORS.md; tools/push-github-api.js for the git-port-blocked REST API push path.
