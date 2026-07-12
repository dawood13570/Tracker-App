# Application Architecture & Data Flow Diagrams

> **File Purpose:** This document acts as the blueprint for our application's visual mapping. Use this guide to build or update system diagrams in tools like Draw.io or Excalidraw. It ensures that as file interconnectivity grows, the system remains modular, readable, and free of architectural drift.

---

## 1. The 4-Layer System Layout

When drawing the application layout, divide the canvas horizontally into four distinct tiers. Data should strictly flow downward, and event triggers should loop backward upward.

### 🏢 Tier 1: The UI Layer (The Skin)
* **Components:** `app/today.tsx`, `components/TaskCard.tsx`, `components/new-task.tsx`
* **Rules:** * Dumb/Passive. UI files do not know SQLite exists.
  * They read data exclusively from Tier 2 (Zustand).
  * User interactions (taps, forms) trigger actions in Tier 2.

### 🧠 Tier 2: The State Layer (The Brain)
* **Components:** `store/taskStore.ts` (Zustand Store)
* **Rules:**
  * Acts as the single runtime source of truth for the active session.
  * Translates UI events into database operations.
  * Manages synchronous loading, error, and optimistic UI states.

### 💾 Tier 3: The Data Layer (The Vault)
* **Components:** `db/schema.ts`, `db/queries.ts` (Drizzle ORM + SQLite File)
* **Rules:**
  * Handles absolute data persistence.
  * Ensures data survives application restarts.
  * Pure input/output database commands.

### ⚙️ Tier 4: The Engine Layer (The Ghost in the Machine)
* **Components:** `engine/rollover.ts`, `engine/recurrence.ts`, `engine/pace.ts`
* **Rules:**
  * Operates independently of the UI.
  * Triggered by background workers (`expo-task-manager`) or database hooks.
  * Intersects directly with Tier 3 (Queries) to compute and mutate state.

---

## 2. Dynamic Lifecycle Processes (The Arrows to Draw)

Use these step-by-step lifecycles to draw your sequence diagrams or flowcharts.

### Process A: Toggling a Task Complete
This process handles what happens when a user checks a task box on the dashboard.