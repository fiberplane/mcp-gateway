# MCP Gateway Web UI - Design Tokens

## Overview

This document maps the design system from Figma to Tailwind CSS configuration. The Figma design uses **semantic CSS variables** with fallback values, following the pattern: `var(--category/name, fallback)`.

---

## Quick Reference: Tailwind Class Names

**Common Pattern:** Tailwind uses `bg-{color}`, `text-{color}`, `border-{color}` prefixes

| CSS Variable | Tailwind Classes | Usage |
|--------------|------------------|-------|
| `--primary` | `bg-primary` `text-primary` | Primary backgrounds/text |
| `--primary-foreground` | `text-primary-foreground` | Text on primary bg |
| `--card` | `bg-card` | Card backgrounds |
| `--muted` | `bg-muted` `text-muted` | Muted backgrounds/text |
| `--muted-foreground` | `text-muted-foreground` | Muted text color |
| `--badge-info` | `bg-badge-info` | Info badge (purple) |
| `--badge-success` | `bg-badge-success` | Success badge (green) |
| `--badge-warning` | `bg-badge-warning` | Warning badge (yellow) |
| `--badge-error` | `bg-badge-error` | Error badge (red) |
| `--border` | `border-border` | Border color |

**Example:**
```tsx
✅ Correct:  <button className="bg-primary text-primary-foreground">
❌ Wrong:    <button className="bg-bg-primary text-fg-on-primary">
```

---

## Extracted Figma Variables

### Background Colors

| Figma Token | Fallback Value | Usage | Semantic Name |
|-------------|----------------|-------|---------------|
| `--bg/primary` | `#272624` | Primary button, selected tabs | `bg-primary` |
| N/A | `#dddbff` | Purple method badges (tools/call) | `bg-badge-purple` |
| N/A | `#fef3c7` | Yellow method badges (notifications) | `bg-badge-yellow` |
| N/A | `#fee2e2` | Red method badges (errors) | `bg-badge-red` |
| N/A | `#dcfce7` | Green method badges (initialize) | `bg-badge-green` |
| N/A | `#ffffff` | Card/container backgrounds | `bg-card` |
| N/A | `#f9fafb` | Table row hover | `bg-muted` |

### Foreground Colors

| Figma Token | Fallback Value | Usage | Semantic Name |
|-------------|----------------|-------|---------------|
| `--fg/on-primary` | `#ffffff` | Text on dark backgrounds | `fg-on-primary` |
| N/A | `#000000` | Body text, table text | `fg-primary` |
| N/A | `#6b7280` | Muted text, timestamps | `fg-muted` |
| N/A | `#111827` | Headers, emphasized text | `fg-emphasis` |

### Spacing

| Figma Token | Fallback Value | Usage | Tailwind Class |
|-------------|----------------|-------|----------------|
| `--spacing/s` | `8px` | Small gaps, padding | `gap-2` / `p-2` |
| `--spacing/md` | `12px` | Medium padding (buttons) | `px-3` / `py-3` |
| N/A | `4px` | Extra small (badge padding) | `px-1` / `py-1` |
| N/A | `6px` | Badge text padding | `px-1.5` |
| N/A | `16px` | Container padding | `p-4` |
| N/A | `24px` | Page margins | `p-6` |

### Border Radius

| Figma Token | Fallback Value | Usage | Tailwind Class |
|-------------|----------------|-------|----------------|
| `--radius/rounded-sm` | `6px` | Buttons, tabs, badges | `rounded-md` |
| N/A | `4px` | Input fields | `rounded` |
| N/A | `8px` | Cards, containers | `rounded-lg` |

### Typography

| Figma Token | Fallback Value | Usage | Tailwind Class |
|-------------|----------------|-------|----------------|
| `--font/size/sm` | `14px` | Body text, buttons, table cells | `text-sm` |
| `--font/line-height/xs` | `16px` | Tight line height | `leading-4` |
| `--font/line-height/sm` | `20px` | Normal line height | `leading-5` |
| `--font/weight/regular` | `normal` | Body text | `font-normal` |
| N/A | `24px` | Page headings | `text-2xl` |
| N/A | `16px` | Section headers | `text-base` |

### Font Families

| Usage | Figma Font | Tailwind Class |
|-------|------------|----------------|
| UI Text | `Inter` | `font-sans` |
| Code/Monospace | `Roboto Mono` | `font-mono` |

---

## Hardcoded Values to Extract

These colors appear in the Figma design but **don't have semantic tokens** yet. We should add them:

### Method Badge Colors

From the screenshot, method badges use specific background colors:

```
tools/call       → #dddbff (purple)
tools/list       → #dddbff (purple)
resources/list   → #fef3c7 (yellow)
initialize       → #dcfce7 (green)
```

**Recommendation:** Create semantic tokens by method type:
- `--bg-method-tools` → `#dddbff`
- `--bg-method-resources` → `#fef3c7`
- `--bg-method-notifications` → `#fef3c7`
- `--bg-method-initialize` → `#dcfce7`

Or by intent:
- `--bg-badge-info` → `#dddbff`
- `--bg-badge-warning` → `#fef3c7`
- `--bg-badge-success` → `#dcfce7`
- `--bg-badge-error` → `#fee2e2`

**Decision:** Use **intent-based tokens** (info/warning/success/error) for flexibility.

---

## Tailwind Configuration

### Complete `tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Background colors
        primary: 'hsl(var(--primary))',
        card: 'hsl(var(--card))',
        muted: 'hsl(var(--muted))',

        // Badge colors (intent-based)
        'badge-info': 'hsl(var(--badge-info))',
        'badge-success': 'hsl(var(--badge-success))',
        'badge-warning': 'hsl(var(--badge-warning))',
        'badge-error': 'hsl(var(--badge-error))',

        // Foreground colors
        foreground: 'hsl(var(--foreground))',
        'muted-foreground': 'hsl(var(--muted-foreground))',

        // Border colors
        border: 'hsl(var(--border))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': '12px',
        'sm': '14px',
        'base': '16px',
        '2xl': '24px',
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
        '8': '32px',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '6px',
        'lg': '8px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

### CSS Variables Definition (`globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Background colors (HSL format for better manipulation) */
    --background: 0 0% 100%;        /* #ffffff - page background */
    --card: 0 0% 100%;              /* #ffffff - card background */
    --muted: 210 20% 98%;           /* #f9fafb - muted background */
    --primary: 30 4% 15%;           /* #272624 - primary background */

    /* Badge colors (intent-based) */
    --badge-info: 245 100% 93%;     /* #dddbff - purple */
    --badge-success: 138 76% 93%;   /* #dcfce7 - green */
    --badge-warning: 48 96% 89%;    /* #fef3c7 - yellow */
    --badge-error: 0 93% 94%;       /* #fee2e2 - red */

    /* Foreground colors */
    --foreground: 0 0% 0%;          /* #000000 - primary text */
    --primary-foreground: 0 0% 100%; /* #ffffff - text on primary */
    --muted-foreground: 220 9% 46%; /* #6b7280 - muted text */

    /* Border colors */
    --border: 214 32% 91%;          /* #e5e7eb */
  }

  /* Dark mode (future) */
  .dark {
    --background: 222 47% 11%;
    --card: 222 47% 11%;
    --primary: 0 0% 100%;
    --foreground: 0 0% 100%;
    --primary-foreground: 0 0% 0%;
    /* ... more dark mode tokens */
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground font-sans;
  }
}
```

---

## Usage Examples

### Button Component

```tsx
// Using extracted tokens
<button className="bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm">
  Export
</button>
```

### Method Badge Component

```tsx
// Intent-based badge
<span className="bg-badge-info text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  tools/call
</span>

// Success badge
<span className="bg-badge-success text-foreground px-1.5 py-1 rounded-md text-sm font-mono">
  initialize
</span>
```

### Tab Component

```tsx
// Selected tab
<button className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-sm">
  All servers
</button>

// Unselected tab
<button className="bg-muted text-foreground px-3 py-1 rounded-md text-sm hover:bg-primary/10">
  Figma server
</button>
```

### Table Row

```tsx
<tr className="hover:bg-muted border-b border-border">
  <td className="px-4 py-2 text-sm text-foreground">16:00:44</td>
  <td className="px-4 py-2 text-sm text-muted-foreground">6d3fFeB8</td>
</tr>
```

---

## Method Badge Color Mapping

Based on the Figma screenshot, here's the recommended badge color logic:

```typescript
// packages/web/src/lib/badge-color.ts
export function getMethodBadgeColor(method: string): string {
  // Tools methods → info (purple)
  if (method.startsWith('tools/')) {
    return 'bg-badge-info'
  }

  // Resources methods → warning (yellow)
  if (method.startsWith('resources/')) {
    return 'bg-badge-warning'
  }

  // Notifications methods → warning (yellow)
  if (method.startsWith('notifications/')) {
    return 'bg-badge-warning'
  }

  // Initialize → success (green)
  if (method === 'initialize') {
    return 'bg-badge-success'
  }

  // Default → info
  return 'bg-badge-info'
}

// Usage
<span className={`${getMethodBadgeColor(log.method)} px-1.5 py-1 rounded-md text-sm font-mono`}>
  {log.method}
</span>
```

---

## Shadcn/ui Integration

When using Shadcn, **override its default tokens** with our Figma-extracted values:

### 1. During Shadcn Init

```bash
bunx shadcn-ui@latest init

# Choose:
# Style: default
# Base color: Slate
# CSS variables: Yes ✓
```

### 2. Replace Shadcn's `globals.css` Colors

After init, **replace** Shadcn's generated CSS variables with our Figma tokens:

```css
/* Replace this section in globals.css */
@layer base {
  :root {
    /* Remove Shadcn defaults, use our Figma tokens instead */
    --background: 0 0% 100%;      /* Keep */
    --foreground: 222 47% 11%;    /* Keep */

    /* Replace with our tokens */
    --primary: 30 4% 15%;         /* --bg-primary from Figma */
    --primary-foreground: 0 0% 100%;

    /* Add our custom tokens */
    --bg-badge-info: 245 100% 93%;
    --bg-badge-success: 138 76% 93%;
    --bg-badge-warning: 48 96% 89%;
    --bg-badge-error: 0 93% 94%;
  }
}
```

### 3. Extend Tailwind Config

```typescript
// tailwind.config.ts (after Shadcn init)
export default {
  // ... Shadcn config
  theme: {
    extend: {
      colors: {
        // Keep Shadcn defaults
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',

        // Add our Figma tokens
        'bg-badge-info': 'hsl(var(--bg-badge-info))',
        'bg-badge-success': 'hsl(var(--bg-badge-success))',
        'bg-badge-warning': 'hsl(var(--bg-badge-warning))',
        'bg-badge-error': 'hsl(var(--bg-badge-error))',
      }
    }
  }
}
```

---

## Missing Tokens to Define

These colors are visible in the screenshot but need confirmation from other Figma frames:

### Status Indicators
- Success/OK: Green dot on server tabs
- Error/Failed: Red color
- Neutral: Gray color

### Interactive States
- Hover states for buttons
- Active/selected states
- Disabled states
- Focus rings

### Recommendation

Extract these during implementation by:
1. Inspecting each component type in Figma
2. Using `get_design_context` tool
3. Adding to this document as we find them

---

## Component-Specific Tokens

### Table

```css
:root {
  --table-border: hsl(var(--border-muted));
  --table-header-bg: hsl(var(--bg-muted));
  --table-row-hover: hsl(var(--bg-muted));
}
```

### Search Input

```css
:root {
  --input-bg: hsl(var(--bg-card));
  --input-border: hsl(var(--border-default));
  --input-focus: hsl(var(--bg-primary));
  --input-placeholder: hsl(var(--fg-muted));
}
```

### Server Tabs

```css
:root {
  --tab-active-bg: hsl(var(--bg-primary));
  --tab-active-fg: hsl(var(--fg-on-primary));
  --tab-inactive-bg: transparent;
  --tab-inactive-fg: hsl(var(--fg-muted));
  --tab-hover-bg: hsl(var(--bg-muted));
}
```

---

## Implementation Checklist

- [ ] Set up Tailwind CSS in web package
- [ ] Initialize Shadcn/ui
- [ ] Create `globals.css` with Figma tokens
- [ ] Update `tailwind.config.ts` with extended colors
- [ ] Install fonts: Inter, Roboto Mono
- [ ] Create `badge-color.ts` utility
- [ ] Test token usage with sample components
- [ ] Verify colors match Figma screenshot
- [ ] Document any missing tokens found during implementation

---

## Notes

### Why HSL Format?

Using HSL (Hue, Saturation, Lightness) instead of hex colors:

✅ **Easier to manipulate** - Change opacity: `hsl(var(--primary) / 0.5)`
✅ **Better for theming** - Adjust lightness for dark mode
✅ **Shadcn compatible** - Shadcn uses HSL by default
✅ **Math-friendly** - Can calculate complementary colors

### Converting Hex to HSL

| Hex | HSL |
|-----|-----|
| `#272624` | `30 4% 15%` |
| `#ffffff` | `0 0% 100%` |
| `#dddbff` | `245 100% 93%` |
| `#fef3c7` | `48 96% 89%` |
| `#dcfce7` | `138 76% 93%` |
| `#fee2e2` | `0 93% 94%` |

Use: https://htmlcolors.com/hex-to-hsl

---

## Future Enhancements

### Dark Mode

Add dark mode variants:

```css
.dark {
  --bg-primary: 0 0% 100%;
  --bg-card: 222 47% 11%;
  --bg-badge-info: 245 50% 30%;
  /* ... adjust all tokens for dark mode */
}
```

### Color Palette Extension

If needed, create full color scales:

```css
:root {
  --purple-50: 245 100% 97%;
  --purple-100: 245 100% 93%;
  --purple-500: 245 60% 60%;
  --purple-900: 245 50% 20%;
}
```

---

## Summary

**Design System Type:** Semantic CSS Variables with fallbacks

**Naming Convention:** Slash-separated categories (`--category/name`)

**Primary Categories:**
- `bg/*` - Backgrounds
- `fg/*` - Foregrounds/text
- `spacing/*` - Spacing scale
- `radius/*` - Border radius
- `font/*` - Typography

**Status:** Partially complete (some hardcoded values need extraction)

**Recommendation:** Use Shadcn/ui base + extend with Figma tokens
