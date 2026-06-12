import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const token = process.env.GH_TOKEN;
const root = process.cwd();
const repoName = process.env.GH_REPO_NAME ?? "fortnite-item-shop-shot";

if (!token) {
  throw new Error("GH_TOKEN is required.");
}

const excludedDirs = new Set([".git", ".next", "node_modules", "out"]);
const excludedFiles = new Set(["dev-server.log", "Git-2.54.0-64-bit.exe", "gh_2.94.0_windows_amd64.zip"]);

async function gh(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message ?? response.statusText;
    const error = new Error(`${response.status} ${message}`);
    error.response = data;
    throw error;
  }

  return data;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const relativePath = relative(root, absolutePath).split(sep).join("/");

    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) {
        files.push(...(await walk(absolutePath)));
      }
      continue;
    }

    if (entry.isFile() && !excludedFiles.has(entry.name)) {
      files.push(relativePath);
    }
  }

  return files.sort((a, b) => {
    if (a === "README.md") return -1;
    if (b === "README.md") return 1;
    if (a === ".github/workflows/pages.yml") return 1;
    if (b === ".github/workflows/pages.yml") return -1;
    return a.localeCompare(b);
  });
}

async function getExistingFileSha(owner, repo, file) {
  try {
    const existing = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(file).replaceAll("%2F", "/")}`);
    return Array.isArray(existing) ? undefined : existing.sha;
  } catch (error) {
    if (error.message.startsWith("404")) {
      return undefined;
    }

    throw error;
  }
}

async function upsertFile(owner, repo, file) {
  const content = await readFile(join(root, file));
  const sha = await getExistingFileSha(owner, repo, file);

  return gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(file).replaceAll("%2F", "/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `${sha ? "Update" : "Add"} ${file}`,
      content: content.toString("base64"),
      branch: "main",
      ...(sha ? { sha } : {})
    })
  });
}

async function main() {
  const user = await gh("/user");
  let repo;

  try {
    repo = await gh("/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        description: "Unofficial Fortnite item shop screenshot generator.",
        private: false,
        auto_init: false
      })
    });
  } catch (error) {
    if (error.message.startsWith("422")) {
      repo = await gh(`/repos/${user.login}/${repoName}`);
    } else {
      throw error;
    }
  }

  const files = await walk(root);

  for (const file of files) {
    await upsertFile(user.login, repoName, file);
  }

  try {
    await gh(`/repos/${user.login}/${repoName}`, {
      method: "PATCH",
      body: JSON.stringify({
        default_branch: "main"
      })
    });
  } catch {
    // The default branch is already main or GitHub has not finished indexing the first commit yet.
  }

  try {
    await gh(`/repos/${user.login}/${repoName}/pages`, {
      method: "POST",
      body: JSON.stringify({
        build_type: "workflow"
      })
    });
  } catch (error) {
    if (error.message.startsWith("409")) {
      await gh(`/repos/${user.login}/${repoName}/pages`, {
        method: "PUT",
        body: JSON.stringify({
          build_type: "workflow"
        })
      });
    } else {
      throw error;
    }
  }

  console.log(
    JSON.stringify(
      {
        owner: user.login,
        repo: repo.name,
        htmlUrl: repo.html_url,
        pagesUrl: `https://${user.login}.github.io/${repoName}/`,
        fileCount: files.length
      },
      null,
      2
    )
  );
}

main();
