How to run this playbook:
- Follow steps in order. CALL sends the shown arguments; RUN executes a command. FOR EACH repeats its indented lines.
- Replace `<input:x>` from You need, `<saved:x>` from SAVE, `<each:x>` from the current item. Whole placeholders retain their JSON type, including numbers, arrays, objects and null; embedded ones are text. Never invent concurrency tokens. `result` is the last call's response.
- IF tests a condition; go to step N jumps forward; go to Answer ends execution.
- ASK waits for the user's answer unless that exact action is already authorized. STOP ends calls and puts its message in Next. Owner-only actions require the owner's order.
- VERIFY must pass before reporting success. Fill the Answer block in the user's language; copy IDs exactly. Secrets never enter the reply. **Your entire reply is ONLY the Answer block — no other text.**
