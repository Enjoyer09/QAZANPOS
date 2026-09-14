---
name: brainstorming
description: "Structured design thinking, ideation, and architecture planning skill. Use this skill when exploring new product features, system architectures, technical roadmaps, API design trade-offs, creative problem solving, or evaluating competing solutions."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# Brainstorming & Architectural Ideation Skill

This skill guides the agent through structured exploration of product features, architectural choices, and technical trade-offs before jumping directly into implementation.

## When to Use

Activate this skill when:
- Designing a new product module, feature, or service from scratch.
- Evaluating architectural alternatives (e.g. REST vs WebSockets, SQL vs NoSQL, Client vs Server rendering).
- Generating innovative solutions for complex UX or domain challenges (e.g. offline POS sync, kitchen display system workflows).
- Conducting technical spike assessments or trade-off analysis.

---

## 4-Stage Ideation Framework

Follow this structured process:

### Stage 1: Clarify Problem & Constraints
- **Core Objective**: What problem are we solving, and for whom?
- **Hard Constraints**: Existing tech stack (e.g. React 19, Tailwind v4, Express, Drizzle ORM), offline-first requirements, latency budgets.
- **Success Metrics**: What constitutes a winning solution?

### Stage 2: Divergent Exploration (Option Generation)
Generate at least 3 distinct conceptual approaches:
1. **Option A (The Pragmatic / Minimalist Path)**: Uses current dependencies with minimal moving parts. Fast to ship, low risk.
2. **Option B (The Modern / Scalable Path)**: Industry best practice architecture. Decoupled, highly maintainable, extensible.
3. **Option C (The Innovative / Edge Path)**: Leverages reactive streams, optimistic mutations, or advanced caching for maximum user delight.

### Stage 3: Trade-off Matrix & Evaluation
Compare options across:
- **Implementation Complexity**: Hours/effort to develop and test.
- **Maintenance Burden**: Long-term operational overhead.
- **Performance & Latency**: Network rounds, memory footprint, bundle size.
- **Developer Experience**: Tooling ergonomics and debugging simplicity.

### Stage 4: Recommendation & Phased Execution Plan
- State the recommended path with clear justification.
- Break the implementation into low-risk milestones (MVP -> Enhancements -> Polish).
