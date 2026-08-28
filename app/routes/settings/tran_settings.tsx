import { Box, Divider, Switch } from '@mui/material';
import { useState, useEffect } from "react";

import { pushError } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { api } from "~/hooks/api";
import type { GeneralSettings } from "~/hooks/model";
import { SettingItemFrame, SettingTitleFrame } from "~/routes/settings/components/frame";
import { SettingSlider } from "~/routes/settings/components/slider";

export default function TranscodeSettingPage() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const defaultConfig = {
        preset: 6,
        max_bitrate_mb: 88.8,
        overshoot_pct: 100,
        undershoot_pct: 10,
        maxsection_pct: 6000,
        keyint: "6s",
        lookahead: 120,
        scd: true,
    };

    const [config, setConfig] = useState<GeneralSettings>(defaultConfig as GeneralSettings);

    const fetch = () => {
        api.get(`${apiUrl}/settings/g`).json<GeneralSettings>()
            .then(data => { setConfig(data); })
            .catch(error => { pushError(error, "Get general settings"); })
    }

    const update = (s: GeneralSettings) => {
        api.post(`${apiUrl}/settings/g`, { json: s }).json<GeneralSettings>()
            .then(data => { setConfig(data); })
            .catch(error => { pushError(error, "Update general settings"); })
    }

    useEffect(() => { fetch(); }, []);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <SettingTitleFrame title="Transcoder Settings" reset={() => update({ ...config, ...defaultConfig })} />
            <Divider />
            <SettingItemFrame title="Preset">
                <SettingSlider
                    value={config.preset}
                    onChange={(v) => { update({ ...config, preset: v }) }}
                    min={0}
                    max={12}
                    step={1}
                    field={false}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Max Bitrate Per Second (Mbps)">
                <SettingSlider
                    value={config.max_bitrate_mb}
                    onChange={(v) => { update({ ...config, max_bitrate_mb: v }) }}
                    min={0.1}
                    max={338}
                    step={0.1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Keyint (seconds)" desc="Maximum interval between keyframes in seconds.">
                <SettingSlider
                    value={Number(config.keyint.replace("s", ""))}
                    onChange={(v) => { update({ ...config, keyint: `${v}s` }) }}
                    min={1}
                    max={60}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Lookahead" desc="Number of frames to look ahead for better encoding decisions.">
                <SettingSlider
                    value={config.lookahead}
                    onChange={(v) => { update({ ...config, lookahead: v }) }}
                    min={0}
                    max={240}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="overshoot_pct">
                <SettingSlider
                    value={config.overshoot_pct}
                    onChange={(v) => { update({ ...config, overshoot_pct: v }) }}
                    min={0}
                    max={100}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="undershoot_pct">
                <SettingSlider
                    value={config.undershoot_pct}
                    onChange={(v) => { update({ ...config, undershoot_pct: v }) }}
                    min={0}
                    max={100}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="maxsection_pct">
                <SettingSlider
                    value={config.maxsection_pct}
                    onChange={(v) => { update({ ...config, maxsection_pct: v }) }}
                    min={0}
                    max={10000}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="scd">
                <Switch
                    checked={config.scd}
                    onChange={(e) => { update({ ...config, scd: e.target.checked }) }}
                />
            </SettingItemFrame>
        </Box>
    );
}