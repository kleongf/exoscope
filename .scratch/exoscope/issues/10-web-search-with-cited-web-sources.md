# 10: Web search with cited Web sources

**What to build:** "Does any of these have liquid water?" gets an answer that combines evidence kinds. Gemma first says what the archive fields can and can't support, then calls `web_search`, then cites Web sources aloud ("According to…").

`web_search` is a normal custom tool. Its handler makes a separate Gemma call with only Gemini's built-in `google_search` enabled, and returns the grounded text plus each source's title and URL. If ticket 01 found that the built-in search can be mixed with custom tools in one request, use that instead.

Web sources appear in the transcript with a distinct shadcn Badge and their domain. They never feed the chart, table or System view. At most one search per turn, and only when the archive can't answer.

**Blocked by:** 01, 04

**Status:** ready-for-agent

- [ ] The liquid-water question produces an answer with at least one cited Web source, shown with its badge and domain
- [ ] A question the archive can answer ("what is planet e's radius?") does not trigger a search
- [ ] Numbers from Web sources never appear in the chart or table
- [ ] A search failure produces an honest reply, not an invented citation
