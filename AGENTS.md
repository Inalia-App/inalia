# Project

- `inalia` is the CLI for using and setting up `slidev-addon-inalia` from [Inalia](https://inalia.app).
- `inalia` and `slidev-addon-inalia` are separate packages, not aliases. The addon owns the Slidev runtime integration and Vite plugin; this package owns the CLI.

Never touch the README unless the user explicitly requests it.

## Documentation

- Keep the CLI and addon documentation in [Inalia-App/inalia.app](https://github.com/Inalia-App/inalia.app) up to date whenever changing this repository.
- For changes that affect installation, configuration, authentication, commands, or other user-facing behavior, update the corresponding documentation in `inalia.app` as part of the same task.
- If no documentation update is needed, explain why in the pull request. If the documentation changes require a separate pull request in `inalia.app`, link it in this repository's pull request.
