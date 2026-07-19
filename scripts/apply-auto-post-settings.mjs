import fs from "node:fs";

const body = process.env.ISSUE_BODY || "";
const configPath = process.env.AUTO_POST_CONFIG_PATH || "public/auto-post-config.json";
const enabledMatch = body.match(/^Enabled:\s*(true|false)\s*$/m);
const intervalMatch = body.match(/^Interval-Days:\s*(\d+)\s*$/m);
const captionMatch = body.match(/Caption:\s*\n```text\n([\s\S]*?)\n```/);

if (!enabledMatch || !intervalMatch || !captionMatch) {
  throw new Error("The submitted auto-post settings are incomplete.");
}

const intervalDays = Number(intervalMatch[1]);
const caption = captionMatch[1].trim();

if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 30) {
  throw new Error("Interval must be between 1 and 30 days.");
}

if (!caption || caption.length > 800) {
  throw new Error("Caption must contain between 1 and 800 characters.");
}

const config = {
  enabled: enabledMatch[1] === "true",
  intervalDays,
  caption,
  lastPostedAt: null
};

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Saved auto-post settings to ${configPath}.`);
