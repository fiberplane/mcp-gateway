# Monospace Web Design System Rules

## Design System Structure

### 1. Token Definitions

Design tokens are defined in `src/ui/monospace-web.css` using CSS custom properties (CSS variables):

```css
:root {
  --font-family: "JetBrains Mono", monospace;
  --line-height: 1.2rem;
  --border-thickness: 2px;
  --text-color: #000;
  --text-color-alt: #666;
  --background-color: #fff;
  --background-color-alt: #eee;

  --font-weight-normal: 500;
  --font-weight-medium: 600;
  --font-weight-bold: 800;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #fff;
    --text-color-alt: #aaa;
    --background-color: #000;
    --background-color-alt: #111;
  }
}
```

**Key Design Tokens:**
- **Typography**: JetBrains Mono font family with specific weight variants
- **Spacing**: Based on `--line-height` (1.2rem) as the fundamental spacing unit
- **Colors**: Minimal palette with automatic dark mode support
- **Border**: Consistent 2px thickness throughout

### 2. Component Library

Components are defined using Hono JSX in `src/ui/` directory:

```typescript
import { Hono } from 'hono'
import type { FC } from 'hono/jsx'

const Layout: FC = (props) => {
  return (
    <html>
      <body>{props.children}</body>
    </html>
  )
}
```

**Component Architecture:**
- Server-side rendered using Hono JSX
- Functional components with TypeScript support
- Layout-first approach with grid system

### 3. Frameworks & Libraries

- **UI Framework**: Hono JSX for server-side rendering
- **Build System**: Bun (as specified in CLAUDE.md)
- **Styling**: Pure CSS with CSS custom properties
- **Font Loading**: CDN-based font loading (@import from cdnfonts.com)

### 4. Asset Management

Assets are referenced directly in CSS and HTML:
- External fonts loaded via CDN
- Images and media use standard HTML tags
- No specific asset optimization mentioned in current setup

### 5. Icon System

No dedicated icon system. Uses Unicode characters for visual elements:
- Details markers: "▶" and "▼"
- List style: "square" for unordered lists
- Focus indicators and form elements use CSS-generated content

### 6. Styling Approach

**Pure CSS with Monospace Grid System:**

```css
/* Grid system based on character width */
.grid {
  --grid-cells: 0;
  display: flex;
  gap: 1ch;
  width: calc(
    round(down, 100%, (1ch * var(--grid-cells)) - (1ch * var(--grid-cells) - 1))
  );
}

/* Responsive grid cells */
.grid:has(> :last-child:nth-child(1)) { --grid-cells: 1; }
.grid:has(> :last-child:nth-child(2)) { --grid-cells: 2; }
/* ... up to 9 cells */
```

**Key Styling Patterns:**
- **Character-based sizing**: Uses `1ch` (character width) for horizontal measurements
- **Line-height based spacing**: Uses `var(--line-height)` for vertical rhythm
- **Automatic grid sizing**: CSS `:has()` pseudo-class determines grid column count
- **Responsive design**: Character-sized breakpoints for mobile

### 7. Project Structure

```
src/ui/
├── reset.css           # Meyer's CSS reset (modified)
├── monospace-web.css   # Main design system styles
├── README.ui.md        # UI documentation
├── components/         # JSX components
├── pages/             # Page-level components
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

## Design System Principles

### Monospace Grid Foundation
- Everything aligns to a character-based grid
- Consistent `1ch` horizontal spacing
- `1.2rem` line-height for vertical rhythm

### Minimal Color Palette
- Primary: Black/White with automatic dark mode
- Secondary: Grey variations (#666, #aaa, #eee, #111)
- No accent colors - relies on typography hierarchy

### Typography Hierarchy
- **H1**: 2rem, uppercase, bold (800 weight)
- **H2**: 1rem, uppercase, bold (800 weight)
- **Body**: 1rem, normal (500 weight)
- **Medium**: 600 weight for labels and emphasis
- **Code**: Same font family, medium weight (600)

### Form Controls
- 2px solid borders throughout
- Hover states use `--background-color-alt`
- Focus states increase border thickness to 3px
- Checkbox/radio use CSS-generated content

### Tables
- Full-width with character-aligned columns
- `.width-min` and `.width-auto` for column sizing
- Consistent padding based on line-height and border thickness

### Interactive Elements
- Buttons: Uppercase text, hover background change
- Active state: `translate(2px, 2px)` for pressed effect
- Focus: Increased border thickness (accessibility)

## Figma Integration Guidelines

When creating Figma components based on this system:

1. **Use JetBrains Mono font** at 16px base size (14px mobile)
2. **Set up grid system** with 1ch spacing (approximately 9.6px at 16px)
3. **Create color styles** with dark mode variants
4. **Build components** following the CSS class patterns
5. **Use consistent spacing** multiples of 1.2rem (19.2px)
6. **Apply 2px borders** consistently across form elements and tables