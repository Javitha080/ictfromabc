## What

<!-- one line: what changed and why -->

## Checks

- [ ] `node --test "ict-toolkit/tests/node/*.test.mjs"` → 40/40
- [ ] `python colab-mcp/server.py selftest` → 17/17
- [ ] `python colab/build_notebook.py` + `git diff --exit-code -- colab/ICT_TUI_Colab.ipynb` → clean
- [ ] No credentials/PII in the diff (tokens as `ID|***`, `REDACTED_*` placeholders)
- [ ] Files staged by name; repo stays private

## Evidence

<!-- command output / screenshot links -->
