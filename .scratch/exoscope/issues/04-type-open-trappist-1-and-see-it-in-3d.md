# 04: Type "Open TRAPPIST-1" and see it in 3D

**What to build:** The first complete path through the app. The student types "Open TRAPPIST-1" into the text box. The turn goes to `/turn`, where the plain `google-genai` loop runs Gemma 4, which calls `load_system`. The response carries a validated `ui_command`, and the System view shows the star with its planets on simple circular orbits. The reply text appears in the transcript, and a Live/Cached badge shows where the data came from.

The loop allows at most 5 tool calls per turn. When a tool fails (for example an unknown System), the reply says so honestly instead of claiming success.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

- [ ] Typing "Open TRAPPIST-1" shows 7 planets in the System view and a reply in the transcript
- [ ] The Live/Cached badge reflects how the data was actually obtained
- [ ] "Open Planet Nonexistent" produces an honest error reply and leaves the scene unchanged
- [ ] The tool-call limit is enforced and tested
- [ ] Frontend API types are regenerated from the backend, not hand-written
- [ ] The Playwright script types the request and the screenshot shows the System
