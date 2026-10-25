# 03: Workbench layout with shadcn/ui

**What to build:** The empty research workbench the rest of the demo fills in, built with shadcn/ui (Radix primitives, Tailwind) around the existing React Three Fiber canvas. A student opening the app sees:

- the System view filling the centre
- a left panel for the current Sample and its Interpretation chips (empty for now)
- a right panel for the selected planet's properties (empty for now)
- a collapsible bottom drawer for the chart and table (empty for now)
- a persistent bar with the transcript, an always-visible text box, and a push-to-talk button (disabled for now)

It uses a dark theme suited to a space scene. shadcn components are added through the shadcn CLI as needed (Button, Input, Card, Badge, Tooltip, Table, Sheet or Drawer, ScrollArea, Separator). The Sidebar component is not used.

Generated shadcn components are vendored code: exclude their directory from the 300-line lint rule rather than editing them to fit. Add a one-line convention to `AGENTS.md`: UI controls come from shadcn/Radix; do not hand-roll a control shadcn provides.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tailwind and shadcn are set up, and the layout above renders with the placeholder star still visible in the centre
- [ ] The vendored shadcn directory is excluded from the max-lines rule; all other lint rules still apply to it
- [ ] `AGENTS.md` has the shadcn/Radix convention
- [ ] `./scripts/verify` passes and the Playwright screenshot shows the full layout
