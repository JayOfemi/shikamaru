# Contributing to shikamaru

Thanks for your interest. shikamaru does one thing: deterministic date and money math that is correct every single time. Contributions are welcome within that scope.

## Before a big change

Open an issue (use the Proposal template) before starting significant work, so we can agree on the approach before you invest time. Small fixes and docs can go straight to a pull request.

## The bar

- **Correctness is non-negotiable.** Any change to calculation behavior must include a test. A new or corrected day-count convention must include reference values: an ISDA or OpenGamma worked example, or QuantLib-generated cases via `npm run vectors`.
- **CI must be green.** Pull requests run the full test suite and the QuantLib differential battery. A red build will not be merged.
- **Stay in scope.** Proposals outside deterministic date and money math may be declined, with thanks.

## Workflow

1. Fork and branch from `main`.
2. `npm install`, make your change, add tests, run `npm test`.
3. Open a pull request describing what and why, linked to its issue.
4. A maintainer reviews. Once approved and green, it merges.

## Style

Formatting is enforced by `.editorconfig` (tabs, K&R braces). Keep comments minimal and only on non-obvious lines.

## License

By contributing, you agree your contributions are licensed under the project's MIT license.
