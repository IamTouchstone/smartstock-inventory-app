# Product Requirements Document: Landing Page UI (`index.html`)

## Document Overview

| Field | Value |
|-------|-------|
| **Project** | Smart Supermarket Inventory Management — Marketing / Landing Page |
| **Artifact** | `index.html` + `app.js` |
| **Version** | 1.0 |
| **Date** | May 16, 2026 |
| **Status** | Specification complete; implementation pending `app.js` wiring |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Page Structure](#2-page-structure)
3. [Required Element IDs](#3-required-element-ids)
4. [Design System](#4-design-system)
5. [Section Specifications](#5-section-specifications)
6. [Accessibility Requirements](#6-accessibility-requirements)
7. [JavaScript Integration (`app.js`)](#7-javascript-integration-appjs)
8. [Implementation Checklist](#8-implementation-checklist)

---

## 1. Executive Summary

This PRD defines the structure, design, accessibility, and integration requirements for the project's marketing landing page (`index.html`). The page introduces the Smart Supermarket Inventory Management platform with a hero CTA, feature cards, an insights dashboard preview, a how-it-works section, and a footer signup form.

**Key deliverables:**

- Semantic HTML5 with exactly **3 sections** plus a sticky header
- All **required IDs** present for form wiring and DOM hooks
- **Earthy-tech** visual identity tuned for Lagos retail context
- **WCAG-AA** accessibility with ARIA, landmarks, and reduced-motion support
- **`app.js`** linked at bottom of `<body>` for form handlers and live chart data

---

## 2. Page Structure

### 2.1 DOM Hierarchy

```
<body>
  <a class="skip-link"> … </a>          <!-- accessibility: skip to main -->
  <header>                              <!-- sticky; NOT counted as a section -->
    <nav> … </nav>
  </header>

  <section class="hero"> … </section>   <!-- Section 1 -->

  <main>                                <!-- Section 2 container (not a <section> itself) -->
    <!-- Features -->
    <ul id="list-root"> … </ul>

    <!-- Insights Panel -->
    <div id="insights-panel"> … </div>

    <!-- How It Works -->
    …
  </main>

  <footer> … </footer>                  <!-- Section 3 -->
</body>
```

### 2.2 Section Rules

| Rule | Specification |
|------|---------------|
| Total `<section>` count | **Exactly 3** |
| Section 1 | `<section class="hero">` |
| Section 2 | Content inside `<main>`: Features, Insights Panel, How It Works |
| Section 3 | `<footer>` |
| Header | Sticky `<header>` **above** all sections; does **not** count toward the 3-section limit |

### 2.3 Structural Rationale

- **Hero** — dark diagonal gradient; primary CTA and lead-capture form
- **Main** — light background; feature cards, dark insights preview, process steps
- **Footer** — closing CTA, links, secondary email capture
- **Sticky header** — persistent navigation without consuming a section slot

---

## 3. Required Element IDs

All four mandatory IDs **must** be present in the DOM:

| ID | Element | Purpose |
|----|---------|---------|
| `#btn-primary` | Hero CTA submit `<button>` | Primary conversion action |
| `#list-root` | `<ul>` wrapping feature cards | Feature list mount point / dynamic updates |
| `#insights-panel` | Dark dashboard preview `<div>` | Analytics preview / live chart container |

### 3.1 Form Input IDs

Every `<input>` and `<select>` **must** have a unique `id`:

| ID | Control Type | Context |
|----|--------------|---------|
| `input-email` | `<input>` | Hero / primary email capture |
| `input-store` | `<input>` or `<select>` | Store name or branch |
| `input-category` | `<select>` | Product category filter |
| `input-sku` | `<input>` | SKU lookup |
| `input-threshold` | `<input>` | Stock threshold setting |
| `input-date-range` | `<input>` | Date range picker (reports) |
| `input-footer-email` | `<input>` | Footer newsletter / signup |

> **Constraint:** No duplicate IDs. All interactive elements must be addressable individually from `app.js`.

---

## 4. Design System

### 4.1 Color Palette (Earthy-Tech)

| Token | Hex | Usage |
|-------|-----|-------|
| Off-black | `#0f1108` | Hero gradient base, insights panel background, dark UI surfaces |
| Cassava-cream | `#f5f1e8` | Main content background, light surfaces |
| Ankara-green | `#1d9a5f` | Primary accent, CTAs, success states, links |

### 4.2 Typography

| Role | Font Family | Notes |
|------|-------------|-------|
| Display / headings | **Syne** | Distinctive, modern; hero headlines |
| Body / UI | **DM Sans** | Readable; forms, cards, footer |

**Cultural grounding:** Syne + DM Sans pairing chosen for a distinctive, culturally grounded aesthetic appropriate for **Lagos retail context**.

### 4.3 Visual Treatment

| Area | Treatment |
|------|-----------|
| **Hero** | Dark diagonal gradient — sharp visual break from page top |
| **Main** | Light (cassava-cream) — features and how-it-works |
| **Insights panel** | Dark treatment matching hero — **bookends** the light main content |
| **Contrast** | WCAG-AA minimum across all text/background pairs |

### 4.4 Layout Principles

- Sticky header remains visible on scroll
- Hero → light main → dark insights panel creates a **light–dark–light** rhythm within main
- Footer closes with consistent brand tokens

---

## 5. Section Specifications

### 5.1 Hero (`<section class="hero">`)

**Contains:**

- Headline and subcopy
- Lead-capture form with `#input-email`, `#input-store`, and related fields
- Primary CTA: `<button type="submit" id="btn-primary">`

**Visual:** Dark diagonal gradient on off-black base.

### 5.2 Main (`<main>`)

#### Features

- `<ul id="list-root">` containing feature `<li>` / card elements
- Each card describes a platform capability (inventory, expiry alerts, restocking, etc.)

#### Insights Panel

- `<div id="insights-panel">` — dark dashboard preview
- Hosts chart placeholders / live data targets for `app.js`
- Mirrors hero dark treatment for visual bookend

#### How It Works

- Step-by-step process (numbered or icon-led)
- Uses semantic headings within `<main>`

### 5.3 Footer (`<footer>`)

**Contains:**

- `#input-footer-email` for secondary signup
- Navigation links, legal, social (as applicable)
- Closes page with brand-consistent styling

---

## 6. Accessibility Requirements

### 6.1 Semantic Landmarks

| Landmark | Element |
|----------|---------|
| Site header | `<header>` |
| Primary content | `<main>` |
| Site footer | `<footer>` |
| Navigation | `<nav>` inside `<header>` |

### 6.2 ARIA & Interaction

- **ARIA labels** on all interactive elements (buttons, inputs, selects, nav links)
- **Skip link** as first focusable element in `<body>` (targets `#main` or primary content)
- Form fields associated with `<label>` elements via `for` / `id` pairs

### 6.3 Motion & Contrast

| Requirement | Implementation |
|-------------|----------------|
| Reduced motion | `@media (prefers-reduced-motion: reduce)` — disable or minimize animations |
| Color contrast | WCAG-AA ratios throughout (4.5:1 normal text, 3:1 large text) |
| Focus states | Visible focus rings on all interactive controls |

---

## 7. JavaScript Integration (`app.js`)

### 7.1 Script Placement

```html
<!-- Bottom of <body>, after all DOM content -->
<script src="app.js"></script>
```

**Rule:** `app.js` is linked at the **bottom of `<body>`** — drop it alongside `index.html` in the same directory.

### 7.2 Expected Responsibilities

| Hook | Behavior |
|------|----------|
| `#btn-primary` | Handle hero form submit (validation, feedback, optional API call) |
| `#list-root` | Optional dynamic feature rendering or filtering |
| `#insights-panel` | Wire live chart data / dashboard preview updates |
| `#input-email`, `#input-store`, etc. | Read values, validate, sync to state or backend |
| `#input-footer-email` | Footer signup handler |

### 7.3 File Layout

```
/project-root
  ├── index.html
  ├── app.js
  └── (styles: inline or separate CSS per implementation)
```

---

## 8. Implementation Checklist

### Structure

- [ ] Exactly 3 sections: `hero`, content in `main`, `footer`
- [ ] Sticky `<header>` above sections (not counted as section)
- [ ] `<main>` contains Features, Insights Panel, How It Works

### Required IDs

- [ ] `#btn-primary`
- [ ] `#list-root`
- [ ] `#insights-panel`
- [ ] `#input-email`
- [ ] `#input-store`
- [ ] `#input-category`
- [ ] `#input-sku`
- [ ] `#input-threshold`
- [ ] `#input-date-range`
- [ ] `#input-footer-email`

### Design

- [ ] Colors: `#0f1108`, `#f5f1e8`, `#1d9a5f`
- [ ] Fonts: Syne (display), DM Sans (body)
- [ ] Hero dark diagonal gradient
- [ ] Insights panel dark bookend treatment

### Accessibility

- [ ] Semantic landmarks (`header`, `main`, `footer`, `nav`)
- [ ] ARIA labels on interactive elements
- [ ] Skip link present
- [ ] `prefers-reduced-motion` support
- [ ] WCAG-AA contrast verified

### Integration

- [ ] `app.js` linked at bottom of `<body>`
- [ ] Form handlers wired to `#btn-primary` and inputs
- [ ] Live chart data wired to `#insights-panel`

---

## 9. Architecture Decision Record (Quick Map)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Section count | 3 (`hero`, `main` content, `footer`) | Clear information hierarchy; header excluded |
| ID contract | 4 required + 7 unique form IDs | Predictable `app.js` DOM hooks |
| Palette | Earthy-tech (off-black, cassava-cream, Ankara-green) | Lagos retail cultural grounding |
| Typography | Syne + DM Sans | Distinctive, readable, non-generic |
| Hero vs. insights | Both dark | Visual bookends around light main |
| Script load | `app.js` at end of `<body>` | Non-blocking parse; DOM ready |
| Accessibility | Landmarks + ARIA + skip-link + reduced-motion | WCAG-AA compliance target |

---

## 10. Conclusion

This PRD captures every structural, design, accessibility, and integration decision for the `index.html` landing page. Implementation teams should treat the **ID contract** and **3-section structure** as non-negotiable requirements for `app.js` compatibility. Visual and accessibility standards ensure the page is production-ready for Lagos retail audiences while remaining technically accessible to automated testing and assistive technologies.

---

*End of Document*
