import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("public/auto-post-config.json", "utf8"));
const intervalDays = Math.min(Math.max(Number(config.intervalDays) || 1, 1), 30);

function dateKey(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Africa/Nairobi",
    year: "numeric"
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function calendarDaysBetween(from, to) {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);

  return Math.floor((toTime - fromTime) / 86_400_000);
}

const today = dateKey(new Date());
const lastPostedDate = config.lastPostedAt ? dateKey(new Date(config.lastPostedAt)) : null;
const elapsedDays = lastPostedDate ? calendarDaysBetween(lastPostedDate, today) : Number.POSITIVE_INFINITY;
const due = Boolean(config.enabled) && elapsedDays >= intervalDays;

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `enabled=${Boolean(config.enabled)}\ndue=${due}\ninterval_days=${intervalDays}\n`
  );
}

console.log(
  config.enabled
    ? due
      ? `Auto post is due today (${today}).`
      : `Next post is not due yet; ${elapsedDays}/${intervalDays} days elapsed.`
    : "Auto posting is disabled."
);
