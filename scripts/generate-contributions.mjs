import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  addDays,
  addToDailyTotals,
  buildContributionSvg,
  dateKey,
  gitlabEventWeight,
  startOfSunday,
} from "./contribution-lib.mjs";

const githubUsername = process.env.GITHUB_USERNAME;
const gitlabUsername = process.env.GITLAB_USERNAME;
const githubToken = process.env.GITHUB_TOKEN;
const gitlabToken = process.env.GITLAB_TOKEN;

if (!githubUsername || !gitlabUsername || !githubToken || !gitlabToken) {
  throw new Error("GITHUB_USERNAME, GITLAB_USERNAME, GITHUB_TOKEN, and GITLAB_TOKEN are required.");
}

const today = dateKey(new Date());
const end = today;
const start = startOfSunday(addDays(today, -364));

async function fetchGithubDailyTotals() {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "github-gitlab-profile-widget",
    },
    body: JSON.stringify({
      query: `query($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar { weeks { contributionDays { date contributionCount } } }
          }
        }
      }`,
      variables: {
        login: githubUsername,
        from: `${start}T00:00:00Z`,
        to: `${end}T23:59:59Z`,
      },
    }),
  });
  const body = await response.json();
  if (!response.ok || body.errors || !body.data?.user) {
    throw new Error(`GitHub contribution request failed (HTTP ${response.status}).`);
  }

  const totals = {};
  for (const week of body.data.user.contributionsCollection.contributionCalendar.weeks) {
    for (const day of week.contributionDays) addToDailyTotals(totals, day.date, day.contributionCount);
  }
  return totals;
}

async function fetchGitlabDailyTotals() {
  const totals = {};
  let page = 1;
  while (page) {
    const url = new URL(`https://gitlab.com/api/v4/users/${encodeURIComponent(gitlabUsername)}/events`);
    url.searchParams.set("after", start);
    url.searchParams.set("before", addDays(end, 1));
    url.searchParams.set("sort", "asc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, {
      headers: { "PRIVATE-TOKEN": gitlabToken },
    });
    const events = await response.json();
    if (!response.ok || !Array.isArray(events)) {
      throw new Error(`GitLab contribution request failed (HTTP ${response.status}).`);
    }
    for (const event of events) addToDailyTotals(totals, dateKey(event.created_at), gitlabEventWeight(event));
    const nextPage = response.headers.get("x-next-page");
    page = nextPage ? Number(nextPage) : 0;
  }
  return totals;
}

const [github, gitlab] = await Promise.all([fetchGithubDailyTotals(), fetchGitlabDailyTotals()]);
const output = resolve("assets/contributions.svg");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, buildContributionSvg({ start, end, github, gitlab }), "utf8");
