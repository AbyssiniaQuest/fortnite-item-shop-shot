"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DEFAULT_CAPTION = "Today's item shop {date} \ud83d\udd25";

export function AutoPostSettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState({
    enabled: false,
    intervalDays: 1,
    caption: DEFAULT_CAPTION,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/auto-post-config.json`, {
      signal: controller.signal,
      cache: "no-cache",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((value) =>
        setSettings({
          enabled: Boolean(value.enabled),
          intervalDays: Math.min(
            30,
            Math.max(1, Number(value.intervalDays) || 1),
          ),
          caption: value.caption || DEFAULT_CAPTION,
        }),
      )
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function save() {
    const caption =
      settings.caption.trim().replaceAll("```", "'''") || DEFAULT_CAPTION;
    const params = new URLSearchParams({
      title: "Configure auto-posting",
      body: [
        "<!-- auto-post-settings -->",
        `Enabled: ${settings.enabled}`,
        `Interval-Days: ${settings.intervalDays}`,
        "Caption:",
        "```text",
        caption,
        "```",
        "",
        "Submitting this issue applies these auto-post settings and closes the issue automatically.",
      ].join("\n"),
    });
    window.open(
      `https://github.com/AbyssiniaQuest/fortnite-item-shop-shot/issues/new?${params}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  return (
    <section className="auto-post-panel" aria-label="Telegram auto posting">
      <div className="generator-row">
        <h2>Telegram auto posting</h2>
        <button
          className="icon-button"
          aria-label="Close auto posting"
          title="Close auto posting"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="auto-post-fields">
        <label className="check-control">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) =>
              setSettings({ ...settings, enabled: event.target.checked })
            }
          />
          Auto posting enabled
        </label>
        <label className="field">
          <span>Post every</span>
          <select
            value={settings.intervalDays}
            onChange={(event) =>
              setSettings({
                ...settings,
                intervalDays: Number(event.target.value),
              })
            }
          >
            {Array.from({ length: 30 }, (_, index) => (
              <option key={index} value={index + 1}>
                {index + 1} {index ? "days" : "day"}
              </option>
            ))}
          </select>
        </label>
        <label className="field caption-field">
          <span>Caption</span>
          <input
            maxLength={800}
            value={settings.caption}
            onChange={(event) =>
              setSettings({ ...settings, caption: event.target.value })
            }
          />
        </label>
        <button className="secondary-button" onClick={save}>
          Save settings on GitHub
        </button>
      </div>
    </section>
  );
}
