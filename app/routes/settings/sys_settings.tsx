import { Box, Divider, Switch, Typography } from '@mui/material';
import { useState, useEffect } from "react";

import { pushError } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { api } from "~/hooks/api";
import { type GeneralSettings, UI_VERSION } from "~/hooks/model";
import { SettingItemFrame, SettingTitleFrame } from "~/routes/settings/components/frame";
import { SettingSlider } from "~/routes/settings/components/slider";

export default function SystemSettingPage() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const defaultConfig = {
        overwrite: false,
        delete_source: true,
        retry: 3,
    };

    const [config, setConfig] = useState<GeneralSettings>(defaultConfig as GeneralSettings);
    const [version, setVersion] = useState<string>("N/A");

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

    useEffect(() => {
        fetch();
        api.get(`${apiUrl}/settings/version`).json<string>()
            .then(data => { setVersion(data); })
            .catch(error => { pushError(error, "System settings"); })
    }, []);


    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <SettingTitleFrame title="System Settings" reset={() => update({ ...config, ...defaultConfig })} />
            <Divider />
            <SettingItemFrame title="Overwrite" desc="Overwrite the output file if it already exists.">
                <Switch
                    checked={config.overwrite}
                    onChange={(e) => { update({ ...config, overwrite: e.target.checked }) }}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Delete Source File" desc="Delete the source file after successful processing.">
                <Switch
                    checked={config.delete_source}
                    onChange={(e) => { update({ ...config, delete_source: e.target.checked }) }}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Retry" desc="Number of times to retry if the task failed.">
                <SettingSlider
                    value={config.retry}
                    onChange={(value) => { update({ ...config, retry: value }) }}
                    min={0}
                    max={8}
                    step={1}
                    field={false}
                />
            </SettingItemFrame>
            <SettingItemFrame title="API Version">
                <Typography variant="body1">
                    {version}
                </Typography>
            </SettingItemFrame>
            <SettingItemFrame title="WebUI Version">
                <Typography variant="body1">
                    {UI_VERSION}
                </Typography>
            </SettingItemFrame>
        </Box>
    );
}