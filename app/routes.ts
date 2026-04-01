import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
    index("routes/connection.tsx"),
    layout("routes/frame.tsx", [
        route("/running", "routes/running.tsx"),
        route("/waiting", "routes/waiting.tsx"),
        route("/completed", "routes/completed.tsx"),
        route("/failed", "routes/failed.tsx"),
        route("/sys_settings", "routes/sysSettings.tsx"),
        route("/svtav1_settings", "routes/svtav1Settings.tsx"),
    ]),
] satisfies RouteConfig;
