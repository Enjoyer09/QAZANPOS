---
name: ui-generator
description: "High-velocity modern UI component generator for React 19, Tailwind CSS v4, Lucide icons, and responsive POS interfaces. Use this skill when generating clean UI components, dashboards, modals, POS order screens, receipt previews, or responsive layouts."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# UI Generator Skill

This skill guides the agent in rapidly crafting production-grade, accessible, and responsive React 19 components using Tailwind CSS v4 and Lucide React icons.

## When to Use

Activate this skill when:
- Creating new UI screens (POS terminal, inventory, analytics dashboard, receipt preview, modal dialogs).
- Building reusable atomic UI components (buttons, badges, inputs, data tables, sheets).
- Converting wireframes, user stories, or design concepts into clean React 19 code.
- Implementing dark/light themes and high-contrast POS modes.

---

## Design & Implementation Principles

1. **Tailwind CSS v4 Modern Styling**:
   - Utilize standard Tailwind utility classes with CSS variable tokens.
   - Combine classes cleanly using `clsx` and `tailwind-merge` (`cn(...)` helper).
2. **Touch-First POS Ergonomics**:
   - Touch targets must be at least `44x44px` (ideal `48x48px` or larger for cashiers).
   - High visual contrast for receipt data, pricing badges, and status chips.
3. **Accessibility & Semantics**:
   - Always include semantic HTML (`<button>`, `<dialog>`, `<nav>`, `<aside>`).
   - Accessible ARIA labels (`aria-label`, `aria-expanded`, `role="status"`).
4. **Resilient Feedback States**:
   - Every interactive component must handle: Default, Hover, Active/Pressed, Loading (skeleton/spinner), and Disabled states.
