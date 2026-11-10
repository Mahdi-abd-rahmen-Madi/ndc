---
name: ndc-equipment-wind-recalculation
description: "Rule and guide ensuring that each equipment type (Antenna, RRH, RRU, TD, FH) has its own independent wind load and roughness calculations based on its specific mounting height and parameters, rather than inheriting sector antenna calculations."
---

# NDC Equipment Wind Recalculation Rule

## 1. Core Rule: No Base Wind Inheritance
- **NEVER** reuse the antenna sector's wind parameters ($z$, $k_r$, $c_r(z)$, $V_m$, $I_v(z)$, $q_p$) for auxiliary equipment (RRH, RRU, TD, FH).
- Each equipment type has its own physical dimensions, mast height, and plot height. Its wind characteristics must be computed independently from its own total effective height:
  $$z_{\text{equipment}} = h_{\text{bâtiment}} + h_{\text{plot, eq}} + h_{\text{mât, eq}}$$

## 2. Calculation Rules (Eurocode 1 / EN 1991-1-4)
- **Terrain Roughness Length ($z_0, z_{\min}$)**:
  Obtained strictly from the project terrain category (`0`, `II`, `IIIa`, `IIIb`, `IV`).
- **Roughness Factor ($k_r$)**:
  $$k_r = 0.19 \cdot \left(\frac{z_0}{0.05}\right)^{0.07}$$
- **Roughness Coefficient ($c_r(z)$)**:
  $$c_r(z) = k_r \cdot \ln\left(\frac{\max(z, z_{\min})}{z_0}\right)$$
- **Mean Velocity ($V_m$)**:
  $$V_m = c_r(z) \cdot c_0(z) \cdot V_b \quad (\text{with } c_0 = 1.0)$$
- **Turbulence Intensity ($I_v(z)$)**:
  $$I_v(z) = \frac{1}{\ln(z / z_0)}$$
- **Peak Dynamic Velocity Pressure ($q_p$)**:
  $$q_p(z) = (1 + 7 \cdot I_v(z)) \cdot \frac{1}{2} \cdot \rho_{\text{air}} \cdot V_m^2 \quad (\rho_{\text{air}} = 1.25\text{ kg/m}^3)$$

## 3. Worker Results & Consistency Rule
- When the structural worker computes RRH/equipment forces with a specific $q_p$ (e.g., $123.57\text{ daN/m}^2$):
  - The displayed $c_r(z)$ and $V_m$ must match that specific $q_p$ (e.g. $c_r(z) = 1.25$, $V_m = 32.48\text{ m/s}$).
  - Never allow page templates to show a mismatched combination (e.g. $c_r(z) = 1.31$ from antenna at $13.5\text{ m}$ alongside $q_p = 123.57\text{ daN/m}^2$ from RRH at $\sim 9\text{ m}$).
- In `ndc_generator.py`:
  - When rendering equipment auxiliary PDFs (`_render_and_save('rrh', ...)`), explicitly pass equipment-specific wind values (`cr_z`, `vm_z`, `iv_z`, `kr_z`, `qp_z`) in the context override dictionary.

