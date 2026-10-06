How to run this playbook:
- Do the steps in order; make no call or command that is not written here.
- CALL `tool` {…} [A]: send exactly these arguments. `<input:x>` = its "You need" value; `<saved:x>` = the value you saved; `result` = what the call returned.
- SAVE: x = …: remember it as `<saved:x>`. IF … → …: test it when you reach it. "go to step N" jumps ahead; "go to Answer" ends the steps.
- ASK: "…": reply with the Answer block, the question in `Next:`, and end your turn; continue only after "yes".
- STOP. Say: "…": make no more calls; reply with the Answer block, that text in `Next:`.
- VERIFY: the re-read after a write; the write worked only if it passes.
- RUN `…`: run that command. FOR EACH: run the indented lines once per item.
- Answer labels stay in English; write the values in the user's language and copy ids exactly.
