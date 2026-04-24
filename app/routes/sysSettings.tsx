import {
    Box,
    Typography,
    Divider,
    Switch,
    Slider,
    Select,
    MenuItem,
    Button,
} from '@mui/material';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

import { useEffect, useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import SettingItem from "../components/setting_item";
import { type Settings, Rotate } from "../hooks/model";


const UI_VERSION = "1.0.0";


export default function SysSettings() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [settingsInfo, setSettingsInfo] = useState<Settings>({
        overwrite: false,
        delete_source: true,
        rotate: null,
        retry: 3,
        max_bitrate_mb: 48,
    } as Settings);
    const [version, setVersion] = useState<string>("");

    const fetchSettings = () => {
        api.get(`${apiUrl}/settings`).json<Settings>()
            .then(data => {
                setSettingsInfo(data);
            })
            .catch(error => {
                pushError(error, "System settings");
            })
    }

    const updateSettings = (s: Settings) => {
        api.post(`${apiUrl}/settings`, { json: s })
            .then()
            .catch(error => {
                pushError(error, "System settings");
            })
        setSettingsInfo(s);
    }

    useEffect(() => {
        fetchSettings();
        api.get(`${apiUrl}/settings/version`).json<string>()
            .then(data => {
                setVersion(data);
            })
            .catch(error => {
                pushError(error, "System settings");
            })
    }, []);

    return (
        <Box sx={{
            display: "flex",
            justifyContent: "start",
            alignItems: "start",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            p: 3,
            gap: 3,
        }}>
            <Box sx={{
                display: "flex",
                justifyContent: "end",
                width: "100%",
                alignItems: "center",
                gap: 1,
            }}>
                <Button
                    variant="contained"
                    onClick={() =>
                        updateSettings({
                            ...settingsInfo,
                            overwrite: false,
                            delete_source: true,
                            rotate: null,
                            retry: 3,
                        })
                    }
                    startIcon={<ReplayRoundedIcon />}
                >
                    Reset
                </Button>
            </Box>
            {
                ([
                    ["Overwrite", "Overwrite the output file if it already exists.",
                        (s: Settings) =>
                            <Switch
                                checked={s.overwrite}
                                onChange={(e) => { updateSettings({ ...s, overwrite: e.target.checked }) }}
                            />
                    ],
                    ["Delete Source File", "Delete the source file after successful processing.",
                        (s: Settings) =>
                            <Switch
                                checked={s.delete_source}
                                onChange={(e) => updateSettings({ ...s, delete_source: e.target.checked })}
                            />
                    ],
                    ["Rotate", "Rotate the video.",
                        (s: Settings) =>
                            <Select
                                value={s.rotate ?? -1}
                                onChange={(e) => updateSettings({ ...s, rotate: e.target.value === -1 ? null : e.target.value as number })}
                                displayEmpty
                            >
                                <MenuItem value={-1}>None</MenuItem>
                                {Rotate.map((option, index) => (
                                    <MenuItem key={option} value={index}>
                                        {option}
                                    </MenuItem>
                                ))}
                            </Select>
                    ],
                    ["Retry", "Number of times to retry if the task failed.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.retry}
                                    onChange={(e, value) => updateSettings({ ...s, retry: value as number })}
                                    min={0}
                                    max={8}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.retry} times
                                </Typography>
                            </>
                    ],
                    ["Max Bitrate", "Limit the maximum bitrate for video encoding.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.max_bitrate_mb}
                                    onChange={(e, value) => updateSettings({ ...s, max_bitrate_mb: value as number })}
                                    min={8}
                                    max={888}
                                    step={0.1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.max_bitrate_mb} Mbps
                                </Typography>
                            </>
                    ],
                    ["API Version", "The current version of the API.",
                        (s: Settings) =>
                            <Typography variant="body1">{version}</Typography>
                    ],
                    ["UI Version", "The current version of the UI.",
                        (s: Settings) =>
                            <Typography variant="body1">{UI_VERSION}</Typography>
                    ],
                ] as [string, string, (s: Settings) => React.ReactNode][]).map(([title, description, component]) => (
                    <SettingItem title={title} description={description} key={title}>
                        {component(settingsInfo)}
                    </SettingItem>
                ))
            }
            <Divider flexItem variant='fullWidth' />
        </Box >
    );
}