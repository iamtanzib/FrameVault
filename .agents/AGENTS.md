# Agent Behavioral Rules

## Production & Deployment Safety
- **NEVER** run `git push` or push code to remote repositories.
- **NEVER** execute production release scripts (e.g., `.\build.ps1`, `npm run build --publish`) that publish to GitHub or any live environment.
- The user maintains strict manual control over all code pushes and production releases. Do not attempt to automate deployment unless explicitly told to do so for testing purposes.
