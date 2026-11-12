# Contributing

Private research repo — do not share links or artifacts outside the repo.

## Hard rules (violations = immediate revert)

1. **Repo stays private.** It documents a bypass for a named production site.
2. **Zero credentials / PII in commits or cell outputs.** Phone/password via
   environment vars (`ICT_PHONE`/`ICT_PASS`) or transient runtime cells that
   are deleted right after running; tokens always written as `ID|***`;
   account data uses the `REDACTED_*` placeholders.
3. **Stage files by name** (`git add path1 path2`). Never `git add -A` — the
   worktree legitimately holds gitignored local artifacts, and accidental
   staging is the #1 leak path.
4. Never retry a 422 device-check against the live API; never log in raw.

## Branch model

| Branch | Purpose | Rules |
|---|---|---|
| `main` | stable; releases are tagged here | no force-push, no deletion; CI must be green |
| `develop` | integration branch | feature work lands here via PR first |
| `feature/<topic>` | short-lived work branches | squash-merged into `develop`, deleted after merge |

Hotfixes may land directly on `main` and are merged forward into `develop`.

## Commits

Conventional-prefix style matching the existing history: `docs:`, `ci:`,
`colab:`, `analysis:`, `userscript:`, `repo:`. Imperative subject line, body
explains the why. One logical change per commit.

## Before every push (same as CI)

```powershell
node --test "ict-toolkit\tests\node\*.test.mjs"     # 40/40
python colab-mcp/server.py selftest                  # 17/17 scenarios
python colab/build_notebook.py                       # then:
git diff --exit-code -- colab/ICT_TUI_Colab.ipynb    # builder must be a no-op
```

## Releases

1. Bump the component versions that changed (`__version__` in
   `colab/ict_tui.py`, `@version` in userscripts, `package.json`).
2. Run the three checks above; push to `main`.
3. Tag: `git tag -a vX.Y.Z -m "..."` and `git push origin vX.Y.Z`.
4. `gh release create vX.Y.Z <assets> --title ... --notes-file ...` — assets
   are extracted from the committed tree (`git show HEAD:<path>`), never from
   a dirty worktree.
