const DAY_MS = 24 * 60 * 60 * 1000;

const GITHUB_COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];
const GITLAB_COLORS = ["#161b22", "#4b1f11", "#8c2d04", "#d14a08", "#fc6d26"];
const BOTH_COLORS = ["#161b22", "#5f4709", "#9b760f", "#d29922", "#f6c945"];

const COUNTED_ACTIONS = new Set([
  "opened",
  "reopened",
  "closed",
  "merged",
  "approved",
  "commented",
  "created",
]);

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
  if (event.action_name === "pushed") {
    const commits = Number(event.push_data?.commit_count);
    // GitLab reports 0 for a bulk push. It remains one visible activity event.
    return Number.isFinite(commits) && commits > 0 ? commits : 1;
  }

  return COUNTED_ACTIONS.has(event.action_name) ? 1 : 0;
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
  const gap = 4;
  const left = 28;
  const top = 56;
  const width = Math.max(840, left + Math.ceil(days.length / 7) * (square + gap) + 28);
  const height = 205;
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
      monthLabels.push(`<text x="${x}" y="38" fill="#8b949e" font-size="12">${month}</text>`);
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
  <rect width="100%" height="100%" rx="10" fill="#0d1117"/>
  <text x="28" y="24" fill="#f0f6fc" font-size="16" font-weight="600">Activity across GitHub &amp; GitLab</text>
  ${monthLabels.join("\n  ")}
  ${cells.join("\n  ")}
  <rect x="28" y="178" width="12" height="12" rx="2" fill="#26a641"/><text x="46" y="188" fill="#8b949e" font-size="12">GitHub</text>
  <rect x="118" y="178" width="12" height="12" rx="2" fill="#d14a08"/><text x="136" y="188" fill="#8b949e" font-size="12">GitLab</text>
  <rect x="200" y="178" width="12" height="12" rx="2" fill="#d29922"/><text x="218" y="188" fill="#8b949e" font-size="12">Both</text>
</svg>\n`;
}
