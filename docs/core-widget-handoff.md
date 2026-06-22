# Handoff: put Gary in Core's bottom-right corner

> Goal (Ben): **replace Core's existing bottom-right AI assistant with Gary**, using
> a **little-man icon**. This must be done in a **Core-scoped Claude Code session**
> — the Gary repo session can't edit Core. Everything needed is below, so the Core
> session needs nothing from this repo.

## What "done" looks like

Core's current bottom-right assistant is removed, and in its place sits Gary: a
little-man launcher that opens a chat panel answering technical questions (heat-pump
design, emitter sizing, MCS, EcoSphere standards).

## The two pieces Core needs

1. **A backend for the chat** — an `/api/ask` endpoint in Core that answers questions.
   The clean way is to embed Gary's engine and call it in-process:
   - Copy `src/gary/` from the Gary repo into Core (see `docs/embedding-in-core.md`
     in the Gary repo — it's import-ready). Then add a thin Core route:
     ```ts
     // Core: app/api/ask/route.ts
     import { NextResponse } from "next/server";
     import { parseAskInput, askGary, isAskConfigured } from "@/gary";

     export const runtime = "nodejs";
     export async function POST(req: Request) {
       if (!isAskConfigured())
         return NextResponse.json({ error: "reasoning_unavailable", message: "Set ANTHROPIC_API_KEY." }, { status: 503 });
       const input = parseAskInput(await req.json());
       const result = await askGary(input);   // later: pass { retrieve } once the KB is wired
       return NextResponse.json(result);
     }
     ```
   - Requires `ANTHROPIC_API_KEY` set in Core's environment.
   - *Interim alternative* (no embed yet): point the widget's `endpoint` at Gary's
     deployed `/api/ask` URL instead. Blocked until Gary is deployed to Vercel.

2. **The widget** — drop the component below into Core and mount it once in the root
   layout, removing the old assistant. It's self-contained (React + the `AskResult`
   type, which comes from `@/gary` once Gary is embedded; otherwise inline a minimal
   type).

## The widget component (copy as-is)

Create `app/_components/AskGaryWidget.tsx` in Core with the contents of
`src/app/_components/AskGaryWidget.tsx` from the Gary repo (the canonical source —
keep them in sync). Then in Core's root layout:

```tsx
import AskGaryWidget from "@/app/_components/AskGaryWidget";
// ...
<body>
  {children}
  {/* remove Core's existing bottom-right assistant here */}
  <AskGaryWidget />
</body>
```

Props: `endpoint` (default `/api/ask`), `greeting`, `accent`. The launcher icon is
already a little-man SVG.

## Suggested prompt to start the Core session

> "Embed Gary into this Core repo and replace the bottom-right AI assistant with
> Gary's chat widget (little-man icon). Copy `src/gary/` from the ecosphere-gary
> repo per its `docs/embedding-in-core.md`, add an `app/api/ask` route that calls
> `askGary` from `@/gary`, copy `AskGaryWidget.tsx`, remove the old assistant, and
> mount `<AskGaryWidget />` in the root layout. Set `ANTHROPIC_API_KEY`."

## Checklist

- [ ] `src/gary/` copied into Core; `@/gary` imports resolve
- [ ] `app/api/ask` route added, returns `AskResult`
- [ ] `ANTHROPIC_API_KEY` set in Core
- [ ] Old bottom-right assistant removed
- [ ] `AskGaryWidget` mounted in root layout; little-man launcher visible
- [ ] Smoke test: open it, ask "Why is 45 °C the sweet spot?" → grounded answer
