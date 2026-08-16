import assert from "node:assert/strict";
import test from "node:test";
import { buildContributionSvg, gitlabEventWeight, startOfSunday } from "../scripts/contribution-lib.mjs";

test("counts GitLab push and merge activity using GitLab's real action names", () => {
  assert.equal(gitlabEventWeight({ action_name: "pushed new", push_data: { commit_count: 3 } }), 3);
  assert.equal(gitlabEventWeight({ action_name: "pushed to", push_data: { commit_count: 0 } }), 1);
  assert.equal(gitlabEventWeight({ action_name: "accepted" }), 1);
  assert.equal(gitlabEventWeight({ action_name: "commented on" }), 1);
  assert.equal(gitlabEventWeight({ action_name: "deleted", target_type: "Project" }), 0);
});

test("starts the visual calendar on Sunday", () => {
  assert.equal(startOfSunday("2026-08-12"), "2026-08-09");
});

test("renders only aggregate daily totals", () => {
  const svg = buildContributionSvg({
    start: "2026-08-09",
    end: "2026-08-15",
    github: { "2026-08-10": 2 },
    gitlab: { "2026-08-11": 1 },
  });
  assert.doesNotMatch(svg, /GitHub \+ GitLab activity/);
  assert.match(svg, /font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"/);
  assert.match(svg, /Daily contributions · last 12 months/);
  assert.match(svg, /2026-08-10: 2 activities/);
  assert.match(svg, /GitHub 2, GitLab 0/);
  assert.doesNotMatch(svg, /project_id|repository|commit_title/i);
});
