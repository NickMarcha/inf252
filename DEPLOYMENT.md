# GitHub Pages deployment

The app is built for GitHub Pages and served at a project URL like `https://<username>.github.io/inf252/`.

## Deploy from your machine

1. Install dependencies and run the deploy script:

   ```bash
   npm install
   npm run deploy
   ```

2. This builds the app with the correct base path, copies `index.html` to `404.html` (so direct links and refreshes on routes work), and pushes the `dist` folder to the `gh-pages` branch.

3. If your repository name is not `inf252`, change the base path first: in `package.json`, in the `build:gh-pages` script, replace `/inf252/` with `/<your-repo-name>/`.

## Configure the repo on GitHub

1. Open the repository on GitHub → **Settings**.
2. In the sidebar, go to **Pages** (under “Code and automation”).
3. Under **Build and deployment**:
   - **Source**: **Deploy from a branch**.
   - **Branch**: select **gh-pages**, folder **/ (root)**.
   - Click **Save**.
4. After a minute or two, the site is available at `https://<username>.github.io/inf252/` (replace `<username>` and `inf252` with your GitHub username and repo name).

## Tech stack and scripts

For local development, building for production, and an overview of the stack, see [TECH_STACK.md](TECH_STACK.md).
