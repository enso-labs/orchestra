# Tool Creation Module

This directory contains the modularized components for the tool creation page, organized for better maintainability and reusability.

## Structure

```
src/pages/tools/create/
├── components/           # UI Components
│   ├── index.ts         # Component exports
│   ├── ToolCreateHeader.tsx    # Header with navigation and create button
│   ├── FullscreenEditor.tsx    # Fullscreen system message editor
│   ├── PromptGenerator.tsx     # AI prompt generation widget
│   ├── SettingsForm.tsx        # Main form for tool settings
│   └── PreviewPanel.tsx        # Chat preview interface
├── hooks/               # Custom hooks
│   └── useToolCreation.ts      # Main hook for tool creation logic
├── types/               # TypeScript definitions
│   └── index.ts         # Shared type definitions
├── index.tsx           # Main export
├── tools-create.tsx    # Main component
└── README.md           # This file
```

## Components

### ToolCreateHeader

- Navigation back button
- Tool creation title
- Create agent button with loading state

### FullscreenEditor

- Overlay for editing system messages in fullscreen
- Integrates with PromptGenerator
- Handles close/toggle actions

### PromptGenerator

- AI-powered prompt generation widget
- Supports both "replace" and "alter" modes
- Handles user input and generation states

### SettingsForm

- Form fields for tool name, description, system message
- Model selection dropdown
- Integrates prompt generator and fullscreen editor

### PreviewPanel

- Chat interface for testing the tool
- Shows real-time preview of tool behavior
- Responsive design for mobile/desktop

## Hooks

### useToolCreation

Custom hook that manages:

- Component state (fullscreen, tabs, generators)
- Agent creation logic
- Prompt generation functionality
- UI interaction handlers

## Types

### Shared Interfaces

- `AgentDetails`: Tool name and description
- `GenerateMode`: Type for AI generation modes
- `ChatMessage`: Message structure for chat interface
- `PayloadData`: System message and related data

## Usage

```tsx
import ToolCreate from "./tools-create";

// The component is fully self-contained and handles:
// - Mobile/desktop responsive design
// - Fullscreen editing
// - AI prompt generation
// - Real-time preview
// - Agent creation workflow
```

## Benefits of Modularization

1. **Separation of Concerns**: Each component has a single responsibility
2. **Reusability**: Components can be reused in other parts of the application
3. **Maintainability**: Easier to locate and fix issues
4. **Testability**: Components can be tested in isolation
5. **Performance**: Smaller bundles through tree-shaking
6. **Development**: Better developer experience with focused components
