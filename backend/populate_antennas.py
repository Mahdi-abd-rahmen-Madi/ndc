import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')
django.setup()

from geodata.models import CatalogueConfig

config = CatalogueConfig.objects.get(pk=1)

antennas = [
    # 4G Antennas
    {
        "id": "4G_COM_RRZZV4-65D-R8N43",
        "name": "COMMSCOPE RRZZV4-65D-R8N43",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZV4-65D-R8N43", "height": 2769, "width": 430, "thickness": 197, "weight": 49.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AOC4518R30v06",
        "name": "HUAWEI AOC4518R30v06",
        "montageId": "Custom",
        "ant4g": { "model": "AOC4518R30v06", "height": 2695, "width": 469, "thickness": 206, "weight": 39.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AOC4518R27v06",
        "name": "HUAWEI AOC4518R27v06",
        "montageId": "Custom",
        "ant4g": { "model": "AOC4518R27v06", "height": 2009, "width": 469, "thickness": 206, "weight": 34.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_COM_RRZZHHTT-65B-R7N43",
        "name": "COMMSCOPE RRZZHHTT-65B-R7N43",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZHHTT-65B-R7N43", "height": 2100, "width": 430, "thickness": 197, "weight": 37.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_COM_RRZZHHTT-65A-R7N43",
        "name": "COMMSCOPE RRZZHHTT-65A-R7N43",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZHHTT-65A-R7N43", "height": 1599, "width": 430, "thickness": 197, "weight": 33.2 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AO6240PA04v06",
        "name": "HUAWEI AO6240PA04v06",
        "montageId": "Custom",
        "ant4g": { "model": "AO6240PA04v06", "height": 2550, "width": 469, "thickness": 229, "weight": 44.7 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AO6240PA01v06",
        "name": "HUAWEI AO6240PA01v06",
        "montageId": "Custom",
        "ant4g": { "model": "AO6240PA01v06", "height": 2009, "width": 469, "thickness": 229, "weight": 37.9 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AO6240PA03v06",
        "name": "HUAWEI AO6240PA03v06",
        "montageId": "Custom",
        "ant4g": { "model": "AO6240PA03v06", "height": 1509, "width": 469, "thickness": 229, "weight": 31.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_A104518R1v07",
        "name": "HUAWEI A104518R1v07",
        "montageId": "Custom",
        "ant4g": { "model": "A104518R1v07", "height": 2695, "width": 469, "thickness": 206, "weight": 49.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_COM_RRZZV6-65D-R10F",
        "name": "COMMSCOPE RRZZV6-65D-R10F",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZV6-65D-R10F", "height": 2688, "width": 498, "thickness": 197, "weight": 46.1 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_AOC4518R19v09",
        "name": "HUAWEI AOC4518R19v09",
        "montageId": "Custom",
        "ant4g": { "model": "AOC4518R19v09", "height": 2695, "width": 469, "thickness": 206, "weight": 46.2 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_COM_RRZZVV-65D-R6N47V6",
        "name": "COMMSCOPE RRZZVV-65D-R6N47V6",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZVV-65D-R6N47V6", "height": 2769, "width": 468, "thickness": 228, "weight": 38.5 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_COM_RRZZVV-65B-R6N47V6",
        "name": "COMMSCOPE RRZZVV-65B-R6N47V6",
        "montageId": "Custom",
        "ant4g": { "model": "RRZZVV-65B-R6N47V6", "height": 2100, "width": 468, "thickness": 228, "weight": 40.2 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    
    # Existing ones from montages that are known specific models
    {
        "id": "4G_HUA_AOC4518R07v07_A4",
        "name": "HUAWEI AOC4518R07v07 / A4",
        "montageId": "A4",
        "ant4g": { "model": "AOC4518R07v07", "height": 1509, "width": 469, "thickness": 206, "weight": 34.0 },
        "ant5g": { "model": "AAU5636w", "height": 730, "width": 395, "thickness": 180, "weight": 28.0 }
    },
    {
        "id": "4G_COM_RRZZHTTVV65CR10V3_A7",
        "name": "COMMSCOPE RRZZHTTVV65CR10V3 / A7",
        "montageId": "A7",
        "ant4g": { "model": "RRZZHTTVV65CR10V3", "height": 2249, "width": 469, "thickness": 206, "weight": 45.0 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },
    {
        "id": "4G_HUA_A104518R04v06_A7",
        "name": "HUAWEI A104518R04v06 / A7",
        "montageId": "A7",
        "ant4g": { "model": "A104518R04v06", "height": 2249, "width": 469, "thickness": 206, "weight": 45.0 },
        "ant5g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 }
    },

    # 5G Antennas
    {
        "id": "5G_HUA_AAU5339w",
        "name": "HUAWEI AAU5339w",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AAU5339w", "height": 699, "width": 395, "thickness": 160, "weight": 24 }
    },
    {
        "id": "5G_HUA_AAU5639w",
        "name": "HUAWEI AAU5639w",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AAU5639w", "height": 730, "width": 395, "thickness": 160, "weight": 27 }
    },
    {
        "id": "5G_ERI_AIR6419",
        "name": "ERICSSON AIR6419 B78Y",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AIR6419 B78Y", "height": 717, "width": 408, "thickness": 155, "weight": 22 }
    },
    {
        "id": "5G_ERI_AIR3258",
        "name": "ERICSSON AIR3258 B78V",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AIR3258 B78V", "height": 717, "width": 408, "thickness": 189, "weight": 28 }
    },
    {
        "id": "5G_ERI_AIR6449",
        "name": "ERICSSON AIR6449 240W B78M",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AIR6449 240W B78M", "height": 778, "width": 403, "thickness": 268, "weight": 37.5 }
    },
    {
        "id": "5G_ERI_AIR6488",
        "name": "ERICSSON AIR6488 200W B78H",
        "montageId": "Custom",
        "ant4g": { "model": "", "height": 0, "width": 0, "thickness": 0, "weight": 0 },
        "ant5g": { "model": "AIR6488 200W B78H", "height": 819, "width": 400, "thickness": 220, "weight": 44 }
    }
]

config.real_world_references = antennas
config.save()

print(f"Successfully populated CatalogueConfig with {len(antennas)} real world references.")
