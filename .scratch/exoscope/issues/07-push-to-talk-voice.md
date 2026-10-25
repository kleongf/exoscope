# 07: Push-to-talk voice

**What to build:** The student holds the push-to-talk button, speaks, and releases. The audio goes to the backend, Grok turns it into text, and the transcript appears and runs as a normal turn. After the turn's tool actions finish, the spoken reply (Grok TTS) plays. Long content stays on screen; the voice gives the short finding.

API keys never reach the browser. The text box keeps working exactly as before, as the fallback.

**Blocked by:** 01, 04

**Status:** ready-for-agent

- [ ] Saying "Open TRAPPIST-1" loads the System, shows the recognised transcript, and plays a spoken reply
- [ ] The button shows clear recording / processing states
- [ ] If speech-to-text fails, the student sees an error and can type instead
- [ ] No API key appears in any browser request or bundle
