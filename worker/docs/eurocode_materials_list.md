# Robot API Exact Material Labels (EU/Eurocode)

I've extracted the exact, literal string names expected by the Robot API directly from the SDK's internal XML databases. Depending on whether your Robot instance is set to pure Eurocode or the French National Annex, you will need to use the exact labels listed below for your frontend dropdown menu.

## 1. Pure Eurocode Database (`Eurocode.xml`)

If your project is using the standard European database template, these are the exact labels you must pass via the API:

### Concrete (Eurocode EN 1992-1-1)
* C12/15
* C16/20
* C20/25
* C25/30
* C30/37
* C35/45
* C40/50
* C45/55
* C50/60
* C55/67
* C60/75
* C70/85
* C80/95
* C90/105

### Steel (Eurocode EN 1993-1-1)
* Steel *(Note: This is the default base material, corresponds to S235)*
* S 235
* S 275
* S 355
* S 420
* S 460
* S 500
* S 550
* S 600
* S 620
* S 650
* S 690
* S 700

*(Note the exact spacing in `S 235` compared to `S235`)*

---

## 2. French Regional Database (`Rmat033.xml`)

If your Robot installation is localized for France (which is very common even when calculating via Eurocode, as it includes French National Annexes), you will use these labels. Based on your earlier mention of wanting to pass `"beton"`, this is likely the database your Robot instance is defaulting to.

### Concrete (French DB)
* BETON *(Default base concrete)*
* BETON20
* BETON25
* BETON30
* BETON35
* BETON40
* BETON45
* BETON50
* BETON55
* BETON60

### Steel (French DB)
* ACIER *(Default base steel)*
* ACIER E24
* ACIER E28
* ACIER E30
* ACIER E36
* ACIER E42
* S 355 M
* S 420 M
* S 460 M
* INOX

> [!TIP]
> **Dropdown Recommendation:** I recommend adding both the **Eurocode** labels (e.g., `C25/30`, `S 355`) and the **French** labels (e.g., `BETON25`, `ACIER`) to your frontend dropdown. Our updated `robot_worker.py` script validates against *whatever is active*, so if a user selects `C25/30` and it's active, it works perfectly. If it's not active, the script will reject it and cleanly log the valid options for debugging!
