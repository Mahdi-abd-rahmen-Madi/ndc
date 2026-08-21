---
name: robot-rgl-patcher
description: >-
  Bypasses Robot Structural Analysis COM API limitations by safely backing up and patching the underlying .RGL regulation files. Use when the COM API fails to apply partial combinations or custom coefficients.
---

# Robot RGL Config Patcher

## Overview
When generating code combinations using the Robot Structural Analysis COM API, the engine often ignores partial selections (e.g., turning off `sismique` while keeping `accidentelle`). The API lacks the ability to set the `[-]` (indeterminate) checkbox state, causing it to forcibly generate unwanted templates from the default regulation.

This skill instructs you to completely bypass the COM API by programmatically patching the underlying `.RGL` configuration file in the user's `CfgUsr` directory. By dropping the offending templates from the `.RGL` file natively, Robot is mathematically forced to generate perfect combinations.

## When to Use
- When `params.SelectCombinationType` or `combos.Remove(i)` fail to achieve the desired generation output.
- When the user asks to drop specific hardcoded combinations (like `ALS:SEI`) without touching the rest of the file.

## Utility Scripts
This skill provides a Python CLI script located at `scripts/rgl_patcher.py`. It safely handles the required `utf-16le` encoding and automatically updates the `COMBINATIONS:` count, preventing Robot crashes.

### 1. Create a Backup (Required)
You must ALWAYS create a backup before modifying an `.RGL` file.
```bash
uv run scripts/rgl_patcher.py backup --file "C:\Users\...\CfgUsr\EC-NF.RGL" --output results.json
```

### 2. Remove Specific Lines
Removes lines matching a prefix and automatically decrements the `COMBINATIONS:X` counter. If it fails, it will automatically restore the backup.
```bash
uv run scripts/rgl_patcher.py remove-lines --file "C:\Users\...\CfgUsr\EC-NF.RGL" --prefix "ALS:SEI" --output results.json
```

### 3. Restore Backup
In case of catastrophic failure or if the user requests a rollback.
```bash
uv run scripts/rgl_patcher.py restore --file "C:\Users\...\CfgUsr\EC-NF.RGL" --output results.json
```

## Common Mistakes
1. **Forgetting UTF-16LE:** Do not try to read or write `.RGL` files using standard python `open()` or `cat` without specifying `utf-16le`. You will corrupt the file. Always use `rgl_patcher.py`.
2. **Forgetting to update the COMBINATIONS count:** If you manually delete a line like `ALS:SEI:5 + 22 + 0 + 17`, you must decrement the `COMBINATIONS:8` header to `COMBINATIONS:7`. The `rgl_patcher.py` script does this automatically.
3. **Skipping backups:** Never patch a file without calling the `backup` command first. Robot configuration files are critical.
