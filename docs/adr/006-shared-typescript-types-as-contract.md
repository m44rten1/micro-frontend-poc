# ADR-006: Shared TypeScript Types as the Contract Layer

**Status:** Accepted

## Context

With independently deployed MFEs communicating via events and APIs, there is a risk of contract drift: one MFE changes an event payload shape or API response format, and the consumers break silently.

Options for managing contracts:

1. **No explicit contract** -- Each MFE defines its own types for the same data. Consistency is maintained by convention and manual coordination.
2. **Runtime schema validation** (e.g., Zod, JSON Schema) -- Each MFE validates incoming data at runtime against a shared schema.
3. **Shared type package** -- A workspace package defines the canonical TypeScript types and event constants. All MFEs depend on it at compile time.
4. **API specification** (e.g., OpenAPI) -- REST contracts are defined in a specification file and used to generate types.

IKEA shares design system components, contract schemas, and utility code across teams -- but not runtime state or framework internals. The shared layer is about consistency, not coupling.

## Decision

We use a **shared workspace package** (`@mfe/shared`) that contains:

| File | Purpose |
|------|---------|
| [shared/src/types.ts](shared/src/types.ts) | Domain types: `Todo`, `TodoChangedPayload`, `TodoCreatedPayload` |
| [shared/src/events.ts](shared/src/events.ts) | Event name constants: `TODO_CREATED`, `TODO_CHANGED` |
| [shared/styles.css](shared/styles.css) | CSS custom properties, fonts, and base styles |

The package is published to the workspace via pnpm's `workspace:*` protocol. Its [package.json](shared/package.json) uses subpath exports so consumers import precisely what they need:

```typescript
import type { Todo } from '@mfe/shared/types';       // compile-time only
import { TODO_CHANGED } from '@mfe/shared/events';   // tiny runtime constant
```

Critical design constraint: **the shared package contains no runtime logic**. It exports:

- **Types** (erased at compile time -- zero bytes in the client bundle).
- **String constants** (two short strings -- trivial runtime footprint).
- **CSS** (loaded once by the shell, not bundled per MFE).

There are no shared React components, no shared Vue composables, no shared utility functions. If a team needs a utility, they write it in their own MFE.

## Consequences

**Benefits:**

- **Compile-time contract enforcement.** If `mfe-create-todo` dispatches a `TodoCreatedPayload` and `mfe-todo-list` expects one, TypeScript verifies the shapes match at build time. A type change in `@mfe/shared` causes compile errors in all consumers immediately.
- **Minimal coupling.** The shared package is ~20 lines of code. It has no dependencies. It changes rarely. Updating it is a conscious, deliberate act, not a side effect of feature work.
- **Independent versioning (in production).** In a real multi-repo setup, `@mfe/shared` would be a published npm package with semantic versioning. Each MFE pins its version and upgrades on its own schedule. The monorepo `workspace:*` protocol is a development convenience.
- **Shared visual identity without shared runtime.** The CSS custom properties in `styles.css` ensure all MFEs use the same colors, fonts, and spacing -- without importing a component library or sharing a CSS-in-JS runtime.

**Trade-offs:**

- **Types are compile-time only.** A deployed MFE that was built against `@mfe/shared@1.0` will not catch a runtime payload that matches `@mfe/shared@2.0`. Runtime schema validation (e.g., Zod) would add a safety net but also adds runtime cost and complexity. For this POC, compile-time checking is sufficient.
- **CSS is global.** The shared `styles.css` defines class names (`.header`, `.todo-list__item`, etc.) in a global namespace. A naming collision between MFEs is possible. BEM naming convention mitigates this. In production, CSS Modules or scoped styles per MFE would provide stronger isolation.
- **Coordination cost for changes.** Changing a type in `@mfe/shared` requires all consuming MFEs to be updated. This is intentional friction: it forces teams to think about backward compatibility. But it means shared-type changes are inherently cross-team coordination points.
