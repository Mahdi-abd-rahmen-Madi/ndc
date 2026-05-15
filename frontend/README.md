# Terrain Map React Application

A React-based terrain classification map application using MapLibre GL, TypeScript, and TailwindCSS. This application converts the Django template terrain_map.html into modular React components.

## Features

- **Interactive Map**: Click anywhere on the map to analyze terrain classification
- **CLC Legend**: Collapsible legend panel with terrain types, CLC codes, search, and highlighting
- **Info Panel**: Right-side panel showing terrain classification, coordinates, spatial composition, and building metrics
- **Configuration Tabs**: Tabbed interface for Details, Rules, Process, Testing, and Config views
- **BDTOPO Controls**: Floating control panel for building layer opacity, density display, and height coloring
- **Region Control**: Toggle button for region boundaries visibility
- **Debounced Analysis**: 300ms debounce for terrain classification requests
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Backend API running on `http://localhost:8000`

## Installation

1. Install dependencies:
```bash
npm install
```

## Development

Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Build

Build for production:
```bash
npm run build
```

## Lint

Run ESLint:
```bash
npm run lint
```

## Project Structure

```
src/
├── components/
│   ├── TerrainMap.tsx          # Main MapLibre GL map component
│   ├── CLCLegend.tsx           # Collapsible legend panel
│   ├── InfoPanel.tsx           # Right-side info panel
│   ├── ConfigTabs.tsx          # Tabbed interface
│   ├── BDTOPOControls.tsx      # Building layer controls
│   ├── RegionControl.tsx       # Region boundaries toggle
│   ├── DetailsTab.tsx          # Details tab content
│   ├── RulesTab.tsx            # Rules tab content
│   ├── ProcessTab.tsx          # Process tab content
│   ├── TestingTab.tsx          # Testing tab content
│   └── ConfigTab.tsx           # Config tab content
├── hooks/
│   ├── useTerrainClassification.ts  # Terrain classification API
│   ├── useTerrainConfig.ts          # Configuration management
│   ├── useRegionBoundaries.ts       # Region boundaries
│   └── useBDTOPO.ts                 # BDTOPO building layers
├── utils/
│   ├── types.ts               # TypeScript type definitions
│   ├── clcColors.ts           # CLC code color mapping
│   ├── terrainTypes.ts        # Terrain type descriptions
│   └── formatters.ts          # Coordinate and parameter formatting
├── App.tsx                    # Main application component
└── main.tsx                   # Application entry point
```

## API Endpoints

The application communicates with the backend API at `http://localhost:8000/api/geodata`:

- `POST /terrain-classify-fast/` - Fast terrain classification
- `POST /terrain-config/test_coordinates/` - Detailed classification with config
- `GET /terrain-config/config/` - Get configuration
- `POST /terrain-config/update_config/` - Save configuration
- `POST /terrain-config/reset/` - Reset configuration
- `GET /terrain-config/export/` - Export configuration
- `POST /terrain-config/import_config/` - Import configuration
- `GET /regions/regions/` - Get region boundaries

## Technologies

- **React 18** - UI library
- **TypeScript** - Type safety
- **MapLibre GL** - Map rendering
- **TailwindCSS** - Styling
- **Lucide React** - Icons
- **Vite** - Build tool

## Notes

- The map uses CartoDB Positron basemap
- BDTOPO building layers use IGN France WMTS service
- Region boundaries are loaded from the backend API
- All API requests include proper error handling and loading states
