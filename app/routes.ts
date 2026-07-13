import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    index("routes/connection.tsx"),
    layout("routes/frame.tsx", [
        route("/running", "routes/running/index.tsx"),
        route("/waiting", "routes/waiting.tsx"),
        route("/llm-waiting", "routes/llm_waiting.tsx"),
        route("/completed", "routes/completed.tsx"),
        route("/llm-completed", "routes/llm_completed.tsx"),
        route("/failed", "routes/failed.tsx"),
        route("/sys_settings", "routes/settings/sys_settings.tsx"),
        route("/tran_settings", "routes/settings/tran_settings.tsx"),
        route("/whisper_settings", "routes/settings/whisper_settings.tsx"),
        route("/llm_settings", "routes/settings/llm_settings.tsx"),
    ]),
] satisfies RouteConfig;
