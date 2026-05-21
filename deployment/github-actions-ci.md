# GitHub Actions for CI/CD

GitHub Actions makes it easy to automate all your software workflows, right out of GitHub. You can build, test, and deploy your code right from GitHub.

## What is GitHub Actions?

GitHub Actions is a continuous integration and continuous delivery (CI/CD) platform that allows you to automate your build, test, and deployment pipeline. You can create workflows that build and test every pull request to your repository, or deploy merged pull requests to production.

## Core Concepts

- **Workflows:** A configurable automated process that will run one or more jobs. Workflows are defined by a YAML file checked into your repository (`.github/workflows/`).
- **Events:** A specific activity in a repository that triggers a workflow run (e.g., `push`, `pull_request`, or a scheduled `cron` job).
- **Jobs:** A set of steps in a workflow that execute on the same runner. Each step is either a shell script or an action that will be executed.
- **Actions:** Custom applications for the GitHub Actions platform that perform a complex but frequently repeated task.
- **Runners:** A server that runs your workflows when they're triggered.

## Workflows in This Repository

Because this is primarily a documentation repository, our CI/CD focus is on maintaining code quality, formatting, and link integrity rather than compiling source code.

### 1. Markdown Lint (`markdown-lint.yml`)

This workflow ensures that all Markdown files in the repository adhere to standard styling and formatting rules.

- **Trigger:** Runs on every `push` and `pull_request` to the `master` branch.
- **Action Used:** `DavidAnson/markdownlint-cli2-action`
- **Purpose:** Prevents poorly formatted Markdown from being merged, ensuring the documentation remains clean, readable, and consistent.

### 2. Link Checker (`link-checker.yml`)

Documentation is only as good as its references. This workflow automatically checks for broken links.

- **Trigger:** 
  - Runs on every `push` and `pull_request` to the `master` branch.
  - **Scheduled Run:** Automatically runs every Sunday at midnight (`cron: '0 0 * * 0'`) to catch links that may have gone dead over time.
- **Action Used:** `lycheeverse/lychee-action`
- **Purpose:** Scans all `.md` files for URLs and relative file paths. It performs HTTP requests to verify external links are alive (returning a 200 OK) and ensures internal repository links point to existing files.

## Creating a New Workflow

To add a new automation:

1. Create a new `.yml` file in the `.github/workflows/` directory.
2. Define the `name` and the `on` triggers.
3. Define the `jobs` and `steps` utilizing pre-built actions from the [GitHub Marketplace](https://github.com/marketplace?type=actions) or your own shell commands.
4. Commit and push the file. GitHub will automatically detect and run it based on your triggers.
