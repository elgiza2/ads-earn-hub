<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- The database is shared and DDL is not available from the agent; new state reuses existing `ads_*` tables (bot conversation state lives in `ads_translations` rows keyed `bot:<chatId>`) — why: no migration access to the external project.
- Custom task pictures live in the public storage bucket `ads-tasks` at `<taskKey>.jpg` and are derived from the task key, not stored in a column — why: no schema changes possible.
- TON Connect (`@tonconnect/ui`) is dynamically imported in the browser only; TON comment payloads are built server-side with `@ton/core` — why: the library touches `window` and Buffer is unavailable in the browser bundle.
- Vercel deploys are manual from a /tmp copy with `NITRO_PRESET=vercel` and `.vercel/project.json` linked to `ads-telegram-app` — why: Lovable does not push to Vercel.
