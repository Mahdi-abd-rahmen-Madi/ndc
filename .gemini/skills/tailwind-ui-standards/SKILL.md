---
name: tailwind-ui-standards
description: Trigger when applying Tailwind CSS styles, designing UI layouts, or working with components using `clsx` and `tailwind-merge`.
---
# Tailwind CSS & UI Design Standards

## Styling Guidelines
1. **Utility-First**: Use Tailwind CSS utility classes exclusively for styling. Avoid writing custom CSS in `.css` files unless absolutely necessary for complex animations or legacy compatibility.
2. **Responsive Design**: Design mobile-first. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) to scale UI up for larger screens. Avoid hardcoding fixed widths/heights that break on mobile.
3. **Dynamic Classes**: Always use `clsx` combined with `tailwind-merge` (via a utility like `cn()`) when conditionally merging Tailwind classes. This prevents class conflicts.
4. **Color Palette Consistency**: Stick to the Tailwind color palette defined in `tailwind.config.js`. Avoid using arbitrary color values (e.g., `bg-[#ff0000]`) unless it's a dynamic brand color.

## Modern UX Elements
1. **Interactive Feedback**: All clickable elements (buttons, links, cards) must have `:hover`, `:focus`, and `:active` states.
2. **Focus Rings**: Ensure keyboard accessibility by adding focus rings to interactive elements (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`).
3. **Framer Motion**: Use `framer-motion` for complex page transitions, drag-and-drop, or orchestrating micro-animations that exceed the capabilities of standard Tailwind transitions.
4. **Toasts**: Use `sonner` or `react-hot-toast` for user notifications and feedback after interactions (e.g., success/error messages).
