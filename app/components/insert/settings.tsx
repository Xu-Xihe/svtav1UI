import {
    Box,
    Typography,
    Button,
    Switch,
    Collapse,
    Select,
    MenuItem,
    Tooltip,
    ButtonBase,
} from "@mui/material";
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

import { useState, useEffect } from "react";

import type { GeneralSettings, LanguageKey } from "~/hooks/model";
import { Language, Rotate } from "~/hooks/model";
import { SettingItemFrame } from "~/routes/settings/components/frame";
import { SettingSlider } from "~/routes/settings/components/slider";
import { NobarOverflow } from "~/components/insert/frame";
import { fetchSettings } from "~/components/insert/function";
import { getLocalStorage } from "~/hooks/storage";
import { pushError } from "~/components/error_popout";
import { api } from "~/hooks/api";

export interface InsertSettings {
    multi_in_one: boolean;
    allow_av1: boolean;
    only_subtitle: boolean;
    priority: boolean;
    rotate?: number | null;
    subtitle?: LanguageKey | null;
    tran?: LanguageKey | null;
    tran_inmediate?: boolean | null;
}

const silderWidth = 188;


export function SettingItemLineFrame({ title, desc = "", children }: { title: string, desc?: string, children: React.ReactNode }) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            px: 3,
            pt: 3,
            gap: 1,
        }}>
            <Tooltip title={desc}>
                <Typography variant="body1">
                    {title}
                </Typography>
            </Tooltip>
            {children}
        </Box>
    )

}

export function SettingsPanel({ settings, insert, onChangeSettings, onChangeInsert }: { settings: GeneralSettings; insert: InsertSettings; onChangeSettings: (settings: GeneralSettings) => void; onChangeInsert: (insert: InsertSettings) => void }) {
    const [extend, setExtend] = useState(false);
    const [subState, setSubState] = useState(false);

    useEffect(() => {
        const apiUrl = getLocalStorage("apiUrl", "local");
        api.get(`${apiUrl}/settings/translator`).json<boolean>()
            .then(data => setSubState(data))
            .catch(error => pushError(error, "Fetch translator state"));
    }, []);

    return (
        <>
            <Box sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                pb: 1,
            }}>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Settings
                </Typography>
                <Button
                    variant="outlined"
                    onClick={() => fetchSettings().then(data => onChangeSettings(data))}
                    startIcon={<ReplayRoundedIcon />}
                >
                    Reset
                </Button>
            </Box >
            <NobarOverflow>
                {insert.only_subtitle === false && <>
                    <SettingItemFrame title="Priority" desc="Insert task(s) at the front of the queue.">
                        <Switch
                            checked={insert.priority}
                            onChange={(e) => onChangeInsert({ ...insert, priority: e.target.checked })}
                        />
                    </SettingItemFrame>
                    <SettingItemFrame title="Overwrite" desc="Overwrite the output file if it already exists.">
                        <Switch
                            checked={settings.overwrite}
                            onChange={(e) => { onChangeSettings({ ...settings, overwrite: e.target.checked }) }}
                        />
                    </SettingItemFrame>
                    <SettingItemFrame title="Delete Source File" desc="Delete the source file after successful processing.">
                        <Switch
                            checked={settings.delete_source}
                            onChange={(e) => { onChangeSettings({ ...settings, delete_source: e.target.checked }) }}
                        />
                    </SettingItemFrame>
                    <SettingItemFrame title="Rotate" desc="Rotate the video by the specified degrees.">
                        <Select
                            value={insert.rotate ?? -1}
                            onChange={(e) => onChangeInsert({ ...insert, rotate: e.target.value === -1 ? undefined : e.target.value })}
                            displayEmpty
                            sx={{ width: 188 }}
                        >
                            <MenuItem value={-1}>None</MenuItem>
                            {Rotate.map((option, index) => (
                                <MenuItem key={option} value={index}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                    </SettingItemFrame>
                    <SettingItemLineFrame title="Max Bitrate Per Second (Mbps)">
                        <SettingSlider
                            value={settings.max_bitrate_mb}
                            onChange={(v) => { onChangeSettings({ ...settings, max_bitrate_mb: v }) }}
                            min={0.1}
                            max={338}
                            step={0.1}
                            field={true}
                            maxWidth={"calc(100% - 91px)"}
                        />
                    </SettingItemLineFrame>
                    <SettingItemFrame title="Retry" desc="Number of times to retry if the task failed.">
                        <SettingSlider
                            value={settings.retry}
                            onChange={(value) => { onChangeSettings({ ...settings, retry: value }) }}
                            min={0}
                            max={8}
                            step={1}
                            field={false}
                            maxWidth={silderWidth}
                            field_width={false}
                        />
                    </SettingItemFrame>
                </>}
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        mt: 3,
                        px: 1,
                    }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                        Generate Subtitles
                    </Typography>
                    <Switch
                        disabled={!subState}
                        checked={insert.subtitle ? true : false}
                        onChange={(e) => {
                            onChangeInsert({
                                ...insert,
                                subtitle: e.target.checked ? "en" : undefined,
                                tran: e.target.checked ? insert.tran : undefined,
                                only_subtitle: e.target.checked ? insert.only_subtitle : false,
                            });
                        }}
                    />
                </Box>
                <Collapse in={insert.subtitle !== undefined} timeout="auto" unmountOnExit sx={{ flexShrink: 0 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                        <SettingItemFrame title="Original Language" desc="Language of the original audio track.">
                            <Select
                                value={insert.subtitle}
                                onChange={(e) => onChangeInsert({ ...insert, subtitle: e.target.value as LanguageKey })}
                                displayEmpty
                                sx={{ width: 138, ml: 1 }}
                            >
                                {Object.entries(Language)
                                    .filter(([key]) => key !== "zh-CN" && key !== "zh-TW")
                                    .map(([key, value]) => (
                                        <MenuItem key={key} value={key}>
                                            {value}
                                        </MenuItem>
                                    ))}
                            </Select>
                        </SettingItemFrame>
                        <SettingItemFrame title="Translate Subtitles" desc="Translate the generated subtitles to another language.">
                            <Select
                                value={insert.tran}
                                onChange={(e) => onChangeInsert({ ...insert, tran: e.target.value as LanguageKey | undefined })}
                                displayEmpty
                                sx={{ width: 138, ml: 1 }}
                            >
                                <MenuItem value={undefined}>N/A</MenuItem>
                                {Object.entries(Language)
                                    .filter(([key]) => key !== insert.subtitle && key !== "zh")
                                    .map(([key, value]) => (
                                        <MenuItem key={key} value={key}>
                                            {value}
                                        </MenuItem>
                                    ))}
                            </Select>
                        </SettingItemFrame>
                        <SettingItemFrame title="Generate Subtitles Only" desc="Only generate subtitles without transcoding the video.">
                            <Switch
                                checked={insert.only_subtitle ?? false}
                                onChange={(e) => onChangeInsert({
                                    ...insert,
                                    only_subtitle: e.target.checked,
                                    allow_av1: e.target.checked,
                                })}
                            />
                        </SettingItemFrame>
                        <SettingItemFrame title="Translate Immediately" desc="Translate the subtitles immediately after the transcoding. This may increase the processing time.">
                            <Switch
                                checked={insert.tran_inmediate ?? false}
                                onChange={(e) => onChangeInsert({ ...insert, tran_inmediate: e.target.checked })}
                            />
                        </SettingItemFrame>
                    </Box>
                </Collapse>
                <ButtonBase
                    onClick={() => setExtend(!extend)}
                    sx={{
                        display: insert.only_subtitle ? "none" : "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        mt: 1.5,
                        py: 1.5,
                        px: 1,
                    }}>
                    <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                        Transcoder Settings
                    </Typography>
                    {insert.only_subtitle ? <></> : extend ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                </ButtonBase>
                <Collapse in={extend} timeout="auto" unmountOnExit sx={{ flexShrink: 0 }}>
                    <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
                        <SettingItemLineFrame title="Preset">
                            <SettingSlider
                                value={settings.preset}
                                onChange={(v) => { onChangeSettings({ ...settings, preset: v }) }}
                                min={0}
                                max={12}
                                step={1}
                                field={false}
                                field_width={false}
                            />
                        </SettingItemLineFrame>
                        <SettingItemLineFrame title="Keyint (seconds)" desc="Maximum interval between keyframes in seconds.">
                            <SettingSlider
                                value={Number(settings.keyint.replace("s", ""))}
                                onChange={(v) => { onChangeSettings({ ...settings, keyint: `${v}s` }) }}
                                min={1}
                                max={60}
                                step={1}
                                field={true}
                                maxWidth={"calc(100% - 91px)"}
                            />
                        </SettingItemLineFrame>
                        <SettingItemLineFrame title="Lookahead" desc="Number of frames to look ahead for better encoding decisions.">
                            <SettingSlider
                                value={settings.lookahead}
                                onChange={(v) => { onChangeSettings({ ...settings, lookahead: v }) }}
                                min={0}
                                max={240}
                                step={1}
                                field={true}
                                maxWidth={"calc(100% - 91px)"}
                            />
                        </SettingItemLineFrame>
                        <SettingItemLineFrame title="overshoot_pct">
                            <SettingSlider
                                value={settings.overshoot_pct}
                                onChange={(v) => { onChangeSettings({ ...settings, overshoot_pct: v }) }}
                                min={0}
                                max={100}
                                step={1}
                                field={true}
                                maxWidth={"calc(100% - 91px)"}
                            />
                        </SettingItemLineFrame>
                        <SettingItemLineFrame title="undershoot_pct">
                            <SettingSlider
                                value={settings.undershoot_pct}
                                onChange={(v) => { onChangeSettings({ ...settings, undershoot_pct: v }) }}
                                min={0}
                                max={100}
                                step={1}
                                field={true}
                                maxWidth={"calc(100% - 91px)"}
                            />
                        </SettingItemLineFrame>
                        <SettingItemLineFrame title="maxsection_pct">
                            <SettingSlider
                                value={settings.maxsection_pct}
                                onChange={(v) => { onChangeSettings({ ...settings, maxsection_pct: v }) }}
                                min={0}
                                max={10000}
                                step={1}
                                field={true}
                                maxWidth={"calc(100% - 91px)"}
                            />
                        </SettingItemLineFrame>
                        <SettingItemFrame title="scd">
                            <Switch
                                checked={settings.scd}
                                onChange={(e) => { onChangeSettings({ ...settings, scd: e.target.checked }) }}
                            />
                        </SettingItemFrame>
                    </Box>
                </Collapse>
            </NobarOverflow>
        </>
    );
}