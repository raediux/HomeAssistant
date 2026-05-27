## Project Brief

We are making a personal dark-mode theme dashboard for household use.

## Project Rules
- If there's a way for you to reduce token usage without compromising quality of the output, do it
- Always plan changes first and wait for approval before writing any code or files. No exceptions, including single-line or cosmetic changes.
- Design mockup must be written to the mockup html, css, and js files in `E:\Claude Projects\Home Assistant\'
- Always use surgical edits (`Edit` tool) on existing files. Never rewrite a file from scratch unless the structure has changed so fundamentally that edits would be more confusing — and always flag this before doing it.
- Never push to git or offer to push after individual changes. Only push at the end of a session or when explicitly asked.
- When the user explicitly asks to push (e.g. "push it", "push to git"), you may run `git push` without asking for confirmation.
- **Hard rule:** The patch version in `version.js` must be incremented on every push. The pre-commit hook handles this automatically — never bypass it with `--no-verify`.