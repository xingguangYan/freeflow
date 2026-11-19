# Errors Log

## [ERR-20261119-001] integration

**Logged**: 2026-11-19T16:55:00+08:00
**Priority**: high
**Status**: open
**Area**: infra

### Summary
GitHub deployment blocked: user-provided fine-grained PAT returns 401 Bad credentials; github.com git endpoint is unreachable from this host (api.github.com is reachable).

### Details
During the v1.9.6 release: git push to github.com hung (>40s, no output), while api.github.com responded promptly. GET /user and GET /repos/... both returned 401 "Bad credentials" for the PAT (tried both Bearer and token auth styles), so the token is expired or revoked — it worked in an earlier session. GitCode (token in the gitcode remote URL) still pushes normally, and GitCode API v5 releases work via POST /api/v5/repos/qq_31988139/freeflow/releases?access_token=...

Resolution requires the user to regenerate the PAT with Contents: Read and write + Releases: Read and write scopes, then either git push origin fix/platform-publish-and-ui && git push origin v1.9.6 (if github.com becomes reachable) or run GITHUB_TOKEN=<pat> node tools/push-github-api.js xingguangYan/freeflow fix/platform-publish-and-ui v1.9.6 (REST API path, keeps history).
