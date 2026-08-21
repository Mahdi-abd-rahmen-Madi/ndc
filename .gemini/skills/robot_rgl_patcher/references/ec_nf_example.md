# Reference: Robot Structural Analysis `.RGL` File Structure

This document serves as a structural reference for Robot's Regulation (.RGL) files, specifically demonstrating how the `ACTIONS` and `COMBINATIONS` sections are laid out.

> [!WARNING]
> RGL files use **UTF-16LE** encoding. Standard UTF-8 tools will corrupt the file.

## Example File: `EC-NF.RGL`
Below is a snippet of a typical `EC-NF.RGL` file found in `C:\Users\cometa\AppData\Roaming\Autodesk\Robot Structural Analysis Professional 2027\CfgUsr\`.

```text
|##############################################################################
CODE:NF EN 1990/NA Décembre 2011
MATERIAL:
VERSION:32.0
|##############################################################################
|
| Factors:
| ========
| gu_max        - unfavorable (supremum) ULS partial factor 
| gu_min        - favorable (infimum) ULS partial factor
| gs            - SLS partial factor
| ga            - ULS partial factor for accidental actions
| Psi0,1        - coincidence factor for primary load
| ...
|
ACTIONS:22
|         gu,max gu,min  gs  ga  Psi0,1  Psi0,2  Psi0,3  Psi0,n  Psi1  Psi2,1  Psi2,n PsiK
|                         gu,max gu,min  gs  ga  Psi0,1  Psi0,2  Psi0,3  Psi0,n  Psi1  Psi2,1  Psi2,n PsiK
  DEAD:STRC:1.35  1      1   1   1       1       1       1       1     1       1      1      // Dead
  DEAD:NSTR:1.35  1      1   1   1       1       1       1       0.85  1       1      1      // Dead
  ...
  SEIS:    :1     1      1   1   1       1       1       1       1     1       1      1      // Seismic
|
| Components:
| ===========
|  0. not exists
|  1. DEAD(1,n)* gs(i)
|  2. DEAD(1,n)* gu_max(i)
| ...
| 17. SEI(1,n)*ga(i)
| 18. ACC(1,n)*ga(i)
| ...
|
COMBINATIONS:8
ULS:STR:4 + 19 + 0 + 0
SLS:RAR:1 + 21 + 0 + 0
SLS:FRE:1 + 20 + 0 + 0
SLS:QPR:1 + 22 + 0 + 0
ALS:ACC:5 + 22 + 18 + 0
ALS:SEI:5 + 22 + 0 + 17
ALS:SEI:5 + 22 + 0 + 0
SPC:FEU:5 + 20 + 18 + 0
```

### Parsing Rules
- The `CODE:` line dictates the name shown in the Job Preferences dropdown.
- `ACTIONS:X` and `COMBINATIONS:X` specify the exact number of entries below them. If you add or remove lines programmatically, you **must** increment or decrement this count, otherwise Robot will fail to parse the file and crash.
- `ALS:SEI` rules dictate seismic combinations. Removing these lines effectively blinds the Robot calculation engine to seismic generation.
