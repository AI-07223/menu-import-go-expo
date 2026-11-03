import recordings from "./demo-runs.json";
import citrus from "./citrus.json";
import lunch from "./lunch.json";
import recorded from "./recorded.json";
import type { Draft } from "./menu";

export const models = [
  { id: "reference", name: "Reference transcription" },
  { id: "qwen/qwen3.7-flash", name: "Qwen 3.7 Flash" },
  { id: "google/gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite" },
  { id: "deepseek/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
];
export const runs: Record<
  string,
  { draft: Draft; raw: string; returnedModel: string; recordedAt: string }
> = recordings;
export const examples = [
  {
    file: "sample-clear.png",
    name: "Classic Indian menu",
    image: require("../assets/sample-clear.png"),
    draft: recorded,
    info: "Reference transcription",
  },
  {
    file: "citrus-window.png",
    name: "Citrus Window · illustrated menu",
    image: require("../assets/citrus-window.png"),
    draft: citrus,
    info: "Illustrated reference · prepared transcription",
  },
  {
    file: "lunch-edition.jpg",
    name: "Café Lunch Edition · two-column menu",
    image: require("../assets/lunch-edition.jpg"),
    draft: lunch,
    info: "Recreated restaurant menu · prepared transcription",
  },
];
