import {
    Box,
    Typography,
    Divider,
    Switch,
    Slider,
    Button,
} from '@mui/material';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

import { useEffect, useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import SettingItem from "../components/setting_item";
import { type Settings, Rotate } from "../hooks/model";


export default function SysSettings() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [settingsInfo, setSettingsInfo] = useState<Settings>({
        preset: 6,
        overshoot_pct: 100,
        undershoot_pct: 10,
        maxsection_pct: 6000,
        keyint: "6s",
        lookahead: 120,
        scd: true,
    } as Settings);

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
                            preset: 6,
                            overshoot_pct: 100,
                            undershoot_pct: 10,
                            maxsection_pct: 6000,
                            keyint: "6s",
                            lookahead: 120,
                            scd: true,
                        })
                    }
                    startIcon={<ReplayRoundedIcon />}
                >
                    Reset
                </Button>
            </Box>
            {
                ([
                    ["preset", "The preset of the SVT-AV1 encoder.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.preset}
                                    onChange={(e, value) => updateSettings({ ...s, preset: value as number })}
                                    min={1}
                                    max={12}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.preset}
                                </Typography>
                            </>
                    ],
                    ["overshoot_pct", "How much the encoder is allowed to overshoot the target bitrate.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.overshoot_pct}
                                    onChange={(e, value) => updateSettings({ ...s, overshoot_pct: value as number })}
                                    min={0}
                                    max={100}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.overshoot_pct}
                                </Typography>
                            </>
                    ],
                    ["undershoot_pct", "How much the encoder is allowed to undershoot the target bitrate.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.undershoot_pct}
                                    onChange={(e, value) => updateSettings({ ...s, undershoot_pct: value as number })}
                                    min={0}
                                    max={100}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.undershoot_pct}
                                </Typography>
                            </>
                    ],
                    ["maxsection_pct", "Maximum percentage of the section that can be used.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.maxsection_pct}
                                    onChange={(e, value) => updateSettings({ ...s, maxsection_pct: value as number })}
                                    min={0}
                                    max={10000}
                                    step={100}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.maxsection_pct}
                                </Typography>
                            </>
                    ],
                    ["keyint", "Maximum interval between keyframes in seconds.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={Number(s.keyint.split('s')[0])}
                                    onChange={(e, value) => updateSettings({ ...s, keyint: `${value}s` })}
                                    min={1}
                                    max={100}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.keyint}
                                </Typography>
                            </>
                    ],
                    ["lookahead", "Number of frames to look ahead for better encoding decisions.",
                        (s: Settings) =>
                            <>
                                <Slider
                                    value={s.lookahead}
                                    onChange={(e, value) => updateSettings({ ...s, lookahead: value as number })}
                                    min={1}
                                    max={120}
                                    step={1}
                                    valueLabelDisplay="auto"
                                    sx={{ width: 288 }}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    {s.lookahead} frames
                                </Typography>
                            </>
                    ],
                    ["scd", "Scene change detection.",
                        (s: Settings) =>
                            <Switch
                                checked={s.scd}
                                onChange={(e) => updateSettings({ ...s, scd: e.target.checked })}
                            />
                    ]
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