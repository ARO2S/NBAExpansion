# NBA Expansion Draft Hero Page - Design Specification

This document provides the technical and visual requirements for implementing the "Midnight Court" hero section.

---

## 1. Visual Identity
* **Aesthetic:** Dark-mode sports analytics; High-tech, premium, and layered.
* **Typography:**
    * **Headings:** *Archivo Black* or *Barlow Condensed* (Bold, uppercase, 800+ weight).
    * **Body:** *Inter* or *Public Sans* (Clean, high legibility).
* **Color Palette:**
    * **Background:** `#05070A` (Rich Black)
    * **Surface/Cards:** `rgba(255, 255, 255, 0.05)` (Translucent Glass)
    * **Accent:** `#FF8A00` (Basketball Orange) and `#E2E8F0` (Off-white for CTAs).

---

## 2. Component Breakdown

### A. The Perspective Background
Instead of a flat image, use a layered CSS/SVG approach:
* **Base:** Deep radial gradient: `radial-gradient(circle at 70% 50%, #1A2332 0%, #05070A 100%)`.
* **SVG Overlay:** A vector basketball court layout tilted using CSS:
    ```css
    .court-overlay {
      transform: perspective(1000px) rotateX(60deg) scale(1.5);
      opacity: 0.1;
      stroke: #ffffff;
    }
    ```

### B. Left Column: Content
* **Headline:** "BUILD THE NEXT DYNASTY" (Linear gradient text: White to Light Gray).
* **Primary CTA:** Solid background (`#F8F9FA`), dark text. 
* **Secondary CTA:** Transparent background, 1px border, "Request a Brief" with a 45-degree arrow icon.

### C. Right Column: The "Glass" Stack
The visual interest comes from 3D-layered cards. Use `z-index` and `translateZ` for depth:
1.  **Bottom Layer:** Hardwood texture platform or a dark court segment.
2.  **Middle Layer:** Data cards featuring win-projection charts (use **Recharts** or **Chart.js** for a "live" feel).
3.  **Top Layer:** High-definition cutout of a player or a 3D basketball, overlapping the cards slightly to break the frame.

---

## 3. UI Effects (Glassmorphism)
Apply the following to all floating cards:
```css
.glass-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
  border-radius: 12px;
}
```
## 4. Animation Strategy
**Entrance**: Fade in the text from the left; slide the card stack in from the right.

**Hover States**: *Buttons*: Subtle glow (box-shadow) in basketball orange.

**Cards**: Add a "floating" keyframe animation to the right-side cards so they move independently on the Y-axis.

### 5. Trust Bar (Footer)

**Style**: Desaturated/White, 30% opacity.

**Layout**: Centered horizontal flex row with even spacing (gap: 4rem).