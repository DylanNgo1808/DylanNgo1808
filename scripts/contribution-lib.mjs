const DAY_MS = 24 * 60 * 60 * 1000;

const GITHUB_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const GITLAB_COLORS = ["#161b22", "#4b1f11", "#8c2d04", "#d14a08", "#fc6d26"];
const BOTH_COLORS = ["#161b22", "#5f4709", "#9b760f", "#d29922", "#f6c945"];
const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const GITLAB_SINGLE_ACTIVITY_ACTIONS = new Set([
  "opened",
  "reopened",
  "closed",
  "accepted",
  "merged",
  "approved",
  "commented",
  "commented on",
  "created",
]);

const GITLAB_PUSH_ACTIONS = new Set(["pushed", "pushed new", "pushed to"]);

export function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function addDays(day, amount) {
  return dateKey(new Date(`${day}T00:00:00.000Z`).getTime() + amount * DAY_MS);
}

export function startOfSunday(day) {
  const value = new Date(`${day}T00:00:00.000Z`);
  return addDays(day, -value.getUTCDay());
}

export function contributionLevel(count) {
  if (!count) return 0;
  return Math.min(4, Math.max(1, Math.ceil(Math.log2(count + 1))));
}

export function gitlabEventWeight(event) {
  const action = String(event.action_name ?? "").trim().toLowerCase();

  if (GITLAB_PUSH_ACTIONS.has(action)) {
    const commits = Number(event.push_data?.commit_count);
    // GitLab reports 0 for a bulk push. It remains one visible activity event.
    return Number.isFinite(commits) && commits > 0 ? commits : 1;
  }

  return GITLAB_SINGLE_ACTIVITY_ACTIONS.has(action) ? 1 : 0;
}

export function addToDailyTotals(target, day, amount) {
  if (!amount) return;
  target[day] = (target[day] ?? 0) + amount;
}

export function calendarDays(start, end) {
  const days = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

function escapeText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function colorFor(githubCount, gitlabCount) {
  const level = contributionLevel(githubCount + gitlabCount);
  if (githubCount && gitlabCount) return BOTH_COLORS[level];
  if (githubCount) return GITHUB_COLORS[level];
  if (gitlabCount) return GITLAB_COLORS[level];
  return GITHUB_COLORS[0];
}

export function buildContributionSvg({ start, end, github = {}, gitlab = {} }) {
  const days = calendarDays(start, end);
  const square = 12;
  const gap = 5;
  const left = 58;
  const top = 88;
  const width = Math.max(920, left + Math.ceil(days.length / 7) * (square + gap) + 30);
  const height = 246;
  const monthLabels = [];
  const cells = [];
  let previousMonth = "";

  for (const [index, day] of days.entries()) {
    const date = new Date(`${day}T00:00:00.000Z`);
    const week = Math.floor(index / 7);
    const weekday = date.getUTCDay();
    const x = left + week * (square + gap);
    const y = top + weekday * (square + gap);
    const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    if (month !== previousMonth) {
      monthLabels.push(`<text x="${x}" y="72" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="11">${month}</text>`);
      previousMonth = month;
    }

    const githubCount = github[day] ?? 0;
    const gitlabCount = gitlab[day] ?? 0;
    const total = githubCount + gitlabCount;
    const details = `${day}: ${total} ${total === 1 ? "activity" : "activities"} (GitHub ${githubCount}, GitLab ${gitlabCount})`;
    cells.push(`<rect x="${x}" y="${y}" width="${square}" height="${square}" rx="2" fill="${colorFor(githubCount, gitlabCount)}"><title>${escapeText(details)}</title></rect>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">GitHub and GitLab daily activity</title>
  <desc id="description">An aggregate contribution chart with no project-level information.</desc>
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="12" fill="#0d1117" stroke="#30363d"/>
  <text x="28" y="32" fill="#f0f6fc" font-family="${FONT_FAMILY}" font-size="16" font-weight="600">GitHub + GitLab activity</text>
  <text x="28" y="51" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="12">Daily contributions · last 12 months</text>
  <text x="${width - 28}" y="32" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="12" text-anchor="end">Aggregate only</text>
  <path d="M28 62H${width - 28}" stroke="#21262d"/>
  ${monthLabels.join("\n  ")}
  <text x="28" y="${top + 9}" fill="#6e7681" font-family="${FONT_FAMILY}" font-size="10">Sun</text>
  <text x="28" y="${top + 2 * (square + gap) + 9}" fill="#6e7681" font-family="${FONT_FAMILY}" font-size="10">Tue</text>
  <text x="28" y="${top + 4 * (square + gap) + 9}" fill="#6e7681" font-family="${FONT_FAMILY}" font-size="10">Thu</text>
  <text x="28" y="${top + 6 * (square + gap) + 9}" fill="#6e7681" font-family="${FONT_FAMILY}" font-size="10">Sat</text>
  ${cells.join("\n  ")}
  <circle cx="34" cy="222" r="5" fill="#26a641"/><text x="46" y="226" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="12">GitHub</text>
  <circle cx="126" cy="222" r="5" fill="#fc6d26"/><text x="138" y="226" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="12">GitLab</text>
  <circle cx="210" cy="222" r="5" fill="#d29922"/><text x="222" y="226" fill="#8b949e" font-family="${FONT_FAMILY}" font-size="12">Both</text>
</svg>\n`;
}
