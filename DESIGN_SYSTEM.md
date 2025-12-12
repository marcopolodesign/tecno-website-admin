# 🎨 Admin Panel Design System

## Overview

This document describes the reusable components and CSS classes used in the TecnoFit Admin Panel.

---

## 🎯 Design Principles

- **Consistency**: Use predefined classes for all UI elements
- **Accessibility**: Proper focus states and semantic HTML
- **Responsive**: Mobile-first approach with Tailwind
- **Clean**: Minimal, modern interface with clear hierarchy

---

## 🎨 Color Palette

### Primary Colors
- **Sky Blue**: `sky-600` (primary actions)
- **Sky Blue Hover**: `sky-700`
- **Sky Blue Light**: `sky-500` (focus rings)

### Neutral Colors
- **Background**: `gray-50`
- **Text**: `gray-900` (primary), `gray-700` (secondary), `gray-500` (labels)
- **Borders**: `gray-300`, `gray-200`
- **White**: `white` (cards, inputs)

### Status Colors
- **New/Info**: `blue-100`, `blue-800`
- **Warning**: `yellow-100`, `yellow-800`
- **Success**: `green-100`, `green-800`
- **Error/Lost**: `red-100`, `red-800`

---

## 🧩 Reusable Components (CSS Classes)

### Buttons

#### Primary Button
```jsx
<button className="btn-primary">
  Save Changes
</button>
```

**Style**: Sky blue background, white text, rounded, with hover and focus states

#### Secondary Button
```jsx
<button className="btn-secondary">
  Cancel
</button>
```

**Style**: White background, sky blue text and border, rounded

---

### Form Elements

#### Input Field
```jsx
<input 
  type="text"
  className="form-input"
  placeholder="Enter text..."
/>
```

**Includes**:
- Padding: `px-4 py-2.5`
- Border: `border border-gray-300`
- Rounded: `rounded-lg`
- Focus: Sky blue ring
- Transitions: Smooth color changes

#### Select Dropdown
```jsx
<select className="form-input">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

**Note**: Uses same `form-input` class as text inputs for consistency

#### Textarea
```jsx
<textarea 
  className="form-input"
  rows="3"
  placeholder="Enter notes..."
/>
```

**Note**: Uses same `form-input` class, with `resize-none` built-in

#### Label
```jsx
<label className="form-label">
  Field Name
</label>
```

**Style**: Small, medium weight, gray text, with bottom margin

---

### Form Pattern (Complete Example)

```jsx
<div>
  <label className="form-label">Email</label>
  <input 
    type="email"
    className="form-input"
    placeholder="user@example.com"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
  />
</div>

<div>
  <label className="form-label">Training Goal</label>
  <select 
    className="form-input"
    value={goal}
    onChange={(e) => setGoal(e.target.value)}
  >
    <option value="">Select...</option>
    <option value="weight-loss">Weight Loss</option>
    <option value="muscle-gain">Muscle Gain</option>
  </select>
</div>

<div>
  <label className="form-label">Notes</label>
  <textarea 
    className="form-input"
    rows="3"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
  />
</div>
```

---

### Cards

```jsx
<div className="card">
  <h2>Card Title</h2>
  <p>Card content...</p>
</div>
```

**Style**: White background, rounded, shadow, border, padding

---

### Status Badges

```jsx
<span className="status-badge status-nuevo">Nuevo</span>
<span className="status-badge status-contactado">Contactado</span>
<span className="status-badge status-convertido">Convertido</span>
<span className="status-badge status-perdido">Perdido</span>
```

**Available statuses**:
- `status-nuevo` - Blue
- `status-contactado` - Yellow
- `status-en-negociacion` - Orange (use base `status-badge` + custom colors)
- `status-convertido` - Green
- `status-perdido` - Red

---

## 📐 Layout Components

### Sidecart/Panel Pattern

```jsx
{showPanel && (
  <>
    {/* Backdrop */}
    <div 
      className="fixed inset-0 bg-black/20 z-40"
      onClick={() => setShowPanel(false)}
    />
    
    {/* Panel */}
    <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h3 className="text-xl font-semibold">Panel Title</h3>
        <button onClick={() => setShowPanel(false)}>
          {/* Close icon */}
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Content here */}
      </div>
      
      {/* Fixed Footer Actions */}
      <div className="border-t border-gray-200 bg-white p-6 space-y-3">
        <button className="btn-primary w-full">Save</button>
        <button className="btn-secondary w-full">Cancel</button>
      </div>
    </div>
  </>
)}
```

---

## 🎭 Typography

### Font Families

- **Primary**: `TT Firs Neue` (custom font)
- **Fallback**: `Inter`, `system-ui`, `sans-serif`
- **Monospace**: `Space Mono` (use `.font-space` class)

### Headings

```jsx
<h1 className="text-3xl font-bold text-gray-900">Page Title</h1>
<h2 className="text-2xl font-semibold text-gray-900">Section Title</h2>
<h3 className="text-xl font-semibold text-gray-900">Subsection</h3>
```

### Body Text

```jsx
<p className="text-gray-900">Primary text</p>
<p className="text-gray-700">Secondary text</p>
<p className="text-gray-500">Tertiary/label text</p>
<p className="text-sm text-gray-600">Small text</p>
```

---

## 🎨 Spacing System

Use Tailwind's spacing scale:
- `space-y-2` - 0.5rem (8px) vertical spacing
- `space-y-3` - 0.75rem (12px)
- `space-y-4` - 1rem (16px) - **Most common**
- `space-y-6` - 1.5rem (24px) - **Section spacing**
- `space-y-8` - 2rem (32px)

### Padding
- `p-4` - 1rem (16px)
- `p-6` - 1.5rem (24px) - **Most common for cards/panels**
- `px-4 py-2.5` - **Form inputs**

---

## 🔍 Common Patterns

### Search Bar

```jsx
<div className="relative">
  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
  <input
    type="text"
    className="form-input pl-10"
    placeholder="Buscar..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
</div>
```

### Filter Dropdown

```jsx
<div>
  <label className="form-label">Filter by Status</label>
  <select 
    className="form-input"
    value={filter}
    onChange={(e) => setFilter(e.target.value)}
  >
    <option value="all">All</option>
    <option value="active">Active</option>
    <option value="inactive">Inactive</option>
  </select>
</div>
```

### Action Buttons Row

```jsx
<div className="flex gap-2">
  <button className="btn-primary">
    Primary Action
  </button>
  <button className="btn-secondary">
    Secondary Action
  </button>
</div>
```

---

## 📱 Responsive Design

### Breakpoints (Tailwind defaults)

- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up

### Common Responsive Patterns

```jsx
{/* Full width on mobile, fixed width on desktop */}
<div className="w-full sm:w-[500px]">

{/* Stack on mobile, row on desktop */}
<div className="flex flex-col sm:flex-row gap-4">

{/* Hide on mobile, show on desktop */}
<div className="hidden sm:block">

{/* Different padding on mobile vs desktop */}
<div className="p-4 sm:p-6">
```

---

## 🎯 Icons

Using **Heroicons** (outline style):

```jsx
import { 
  MagnifyingGlassIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'

<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
```

**Common sizes**:
- `h-4 w-4` - Small (16px)
- `h-5 w-5` - Medium (20px) - **Most common**
- `h-6 w-6` - Large (24px)

---

## ✅ Best Practices

### DO:
✅ Use predefined classes (`btn-primary`, `form-input`, etc.)
✅ Keep consistent spacing (space-y-4 for forms)
✅ Use semantic HTML (`<label>`, `<button>`, etc.)
✅ Add proper focus states for accessibility
✅ Use Tailwind utilities for one-off styles

### DON'T:
❌ Create inline styles with `style={{}}` 
❌ Use arbitrary values without good reason
❌ Mix different spacing scales in same component
❌ Forget hover/focus states on interactive elements
❌ Use `<div>` when semantic elements exist

---

## 🔄 Updating the Design System

When adding new reusable components:

1. Add the class to `/admin/src/index.css` under `@layer components`
2. Document it in this file
3. Update existing components to use the new class
4. Commit with descriptive message

Example:
```css
@layer components {
  .new-component-class {
    @apply /* Tailwind utilities */;
  }
}
```

---

## 📚 Resources

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Heroicons**: https://heroicons.com
- **Color Palette**: https://tailwindcss.com/docs/customizing-colors

---

**Last Updated**: December 2024
**Maintained By**: Development Team

