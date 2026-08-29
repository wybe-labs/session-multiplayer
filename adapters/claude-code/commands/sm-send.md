---
description: Send a message to a multiplayer room (Session Multiplayer)
argument-hint: <room> [to <names>:] <message>
---

Send a message with the session-multiplayer MCP server's send_message tool with priority "normal" (it will reach the recipients' agent sessions when their current turn finishes — use /sm-interrupt for urgent barge-ins, or priority "passive" if I say it's non-urgent inbox mail). The first word of "$ARGUMENTS" is the room name and the rest is the message — but if the first word doesn't match any room in `status`, and I'm only in one room, send the whole text there instead.

If the message is meant for specific people — it starts with "to <names>:" or "@name", or I phrase it like "tell bob …" — put those display names (as they appear in `status`) in the tool's `to` list and strip the addressing prefix from the message text. Everyone in the room still gets the message in their chat log/inbox, but only the named people get active delivery; the others aren't interrupted. Without `to`, the whole room gets it at the send priority.

Confirm whether it was delivered live or queued for later, and to whom it was addressed if I named recipients.
