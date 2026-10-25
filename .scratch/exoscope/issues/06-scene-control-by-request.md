# 06: Scene control by request

**What to build:** "Focus on planet e and speed up time" works. Gemma calls `set_scene_view`, which can set the focused planet, the time scale, orbit labels on or off, and colour by a property (with a legend). Every resulting `ui_command` is validated on the server: an unknown planet ID or out-of-range value is rejected, and the agent's reply says so instead of claiming it happened.

Manual controls for the same things (play/pause, speed, labels, colour by) sit in the workbench as shadcn controls and go through the same store actions.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] "Focus on planet e and speed up time" changes the camera and time scale
- [ ] "Colour the planets by insolation" recolours them and shows a legend
- [ ] "Focus on planet z" is rejected server-side and the reply says the planet doesn't exist
- [ ] Manual controls and agent commands produce the same state
