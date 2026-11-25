<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared UI components

- When adding or changing UI, reuse the existing components in `src/components` and their variants.
- Compose layouts with those components and the shared design tokens. Do not create separate UI primitives or duplicate their styling in pages.

## Verification and regression safety

- Do not create, restore, or run automated test files or test suites in this repository.
- After implementing a feature, use static checks and a production build when applicable: `npm run typecheck`, `npm run lint`, and `npm run build`.
- Before finishing, review the complete diff and trace affected callers, shared components, data contracts, authentication state, and navigation flows. Preserve existing behavior outside the requested scope.
- Manually exercise the changed user flow when the required local services are available. Do not claim unrelated behavior is preserved without reviewing its dependency path.
