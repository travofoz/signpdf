# Deployment Guide

This guide covers how to deploy Signatura to GitHub Pages.

**⚠️ CRITICAL WARNING FOR AGENTS:**
This workflow requires an explicit `branch` input parameter. If you fail to provide the `branch` input, the workflow will **silently default to deploying the `master` branch**, regardless of which branch you trigger it from.

---

## Automatic Deployment

### Push to Master

When you push to the `master` branch, the deployment triggers automatically.

```bash
git push origin master
```

### Wildcard Branch Support

Feature branches are **built** automatically on push (to check for errors), but they are **not deployed** to the live URL unless manually triggered.

---

## Manual Deployment

To deploy a specific branch (e.g., `fix/form-fields-critical`) to the live environment.

### Option 1: Using GitHub Web Interface

1. Go to: **Actions → Deploy** (or https://github.com/travofoz/signatura/actions/workflows/deploy.yml)
2. Click **"Run workflow"**
3. **Branch:** Select the branch where the workflow file exists (usually `master` or your feature branch).
4. **Branch to deploy:** Type the exact branch name (e.g., `fix/form-fields-critical`).
5. Click **"Run workflow"**.

### Option 2: Using GitHub CLI (Preferred for Agents)

You must use the "Double Reference" pattern. You need to tell GitHub **where to run the workflow** (`--ref`) AND **which code to checkout** (`-f branch=...`).

#### ✅ The Correct Command

```bash
# Template
gh workflow run deploy.yml --ref <branch_name> -f branch=<branch_name>

# Example: Deploying the critical fix branch
gh workflow run deploy.yml --ref fix/form-fields-critical -f branch=fix/form-fields-critical
```

#### ⚡ Quick Command (If you are currently checked out on the branch)

```bash
gh workflow run deploy.yml --ref $(git branch --show-current) -f branch=$(git branch --show-current)
```

#### ❌ The Wrong Command (Do NOT use)

`gh workflow run deploy.yml --ref fix/form-fields-critical`

> **Why this fails:** It triggers the workflow, but fails to pass the variable. The workflow logic `inputs.branch || 'master'` will kick in, and **you will deploy Master over your production site.**

---

## Configuration Requirements

### GitHub Pages Settings

**Go to Settings → Pages**

- **Source:** Must be set to **GitHub Actions** (NOT "Deploy from a branch").
- **Why:** We build artifacts in the CI runner; we do not let Jekyll build the site.

### Required Files

- `.nojekyll`: Prevents Jekyll processing.
- `CNAME`: Handles the custom domain `http://signatura.plugpuppy.com/`.

---

## Troubleshooting

### "I ran the command but the site didn't change"

**Cause:** You likely forgot the `-f branch=...` flag.
**Diagnosis:**

1. Go to the Actions tab.
2. Click the run.
3. Open the **Build** job → **Checkout** step.
4. If it says `Checking out the ref 'master'`, you used the wrong command.

### "Workflow not triggering"

**Cause:** The branch might not exist on remote yet.
**Fix:** Ensure you pushed your branch first: `git push -u origin fix/my-branch`

### "Permission denied"

**Cause:** The GitHub CLI token doesn't have `workflow` scope.
**Fix:** Run `gh auth refresh -h github.com -s workflow`
