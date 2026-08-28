import { Box, Divider, Tooltip, Typography, Collapse, Switch } from '@mui/material';
import AdjustRoundedIcon from '@mui/icons-material/AdjustRounded';
import { useState, useEffect } from "react";

import { pushError } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { api } from "~/hooks/api";
import type { TranslatorSettings } from "~/hooks/model";
import { SettingItemFrame, SettingTitleFrame } from "~/routes/settings/components/frame";
import { SettingSlider } from "~/routes/settings/components/slider";
import PathSelector from "~/components/pathselector";

export default function WhisperSettingPage() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const defaultConfig = {
        asr_model: null,
        max_length_segment: 38,
        voice_temperature: 0,
        no_speech_threshold: 0.5,
        entropy_thold: 2.3,
        logprob_thold: -1.0,
        max_context: -1,
        suppress_nst: false,
        no_fallback: false,

        voice_speech_duration: 30,
        voice_minimum_silence_duration: 300,
        voice_threshold: 0.63,
        vad_model: null,
    };

    const [config, setConfig] = useState<TranslatorSettings>(defaultConfig as TranslatorSettings);
    const [state, setState] = useState<boolean>(false);

    const check = () => {
        api.get(`${apiUrl}/settings/translator`).json<boolean>()
            .then(data => { setState(data); })
            .catch(error => { pushError(error, "Get translator status"); })
    }

    const fetch = () => {
        api.get(`${apiUrl}/settings/t`).json<TranslatorSettings>()
            .then(data => { setConfig(data); })
            .catch(error => { pushError(error, "Get translator settings"); })
    }

    const update = (s: TranslatorSettings) => {
        api.post(`${apiUrl}/settings/t`, { json: s }).json<TranslatorSettings>()
            .then(data => { setConfig(data); })
            .catch(error => { pushError(error, "Update translator settings"); })
    }

    useEffect(() => { fetch(); check(); }, []);
    useEffect(() => { check(); }, [config]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
            <SettingTitleFrame title="Whisper Settings" reset={() => update({ ...config, ...defaultConfig })}>
                <Tooltip title={"The status of the translator service"} placement="top">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <AdjustRoundedIcon sx={{ color: state ? "success.main" : "error.main" }} />
                        <Typography variant="body1">
                            State
                        </Typography>
                    </Box>
                </Tooltip>
            </SettingTitleFrame>
            <Divider />
            <SettingItemFrame title="ASR Model" desc="The automatic speech recognition model to be used.">
                <Box sx={{ width: 513 }}>
                    <PathSelector
                        label="ASR Model Path"
                        value={config.asr_model}
                        onEnter={(path) => { update({ ...config, asr_model: path }) }}
                        onClose={(path) => { update({ ...config, asr_model: path }) }}
                        type="file"
                        filter="model"
                    />
                </Box>
            </SettingItemFrame>
            <SettingItemFrame title="Temperature" desc="The temperature for voice activity detection.">
                <SettingSlider
                    value={config.voice_temperature}
                    onChange={(v) => { update({ ...config, voice_temperature: v }) }}
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Max Length of Segment" desc="The maximum length of each audio segment (in Characters).">
                <SettingSlider
                    value={config.max_length_segment}
                    onChange={(v) => { update({ ...config, max_length_segment: v }) }}
                    min={10}
                    max={100}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="No Speech Threshold" desc="The threshold for detecting no speech in an audio segment.">
                <SettingSlider
                    value={config.no_speech_threshold}
                    onChange={(v) => { update({ ...config, no_speech_threshold: v }) }}
                    min={0.0}
                    max={1.0}
                    step={0.01}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Entropy Threshold" desc="The threshold for entropy in an audio segment.">
                <SettingSlider
                    value={config.entropy_thold}
                    onChange={(v) => { update({ ...config, entropy_thold: v }) }}
                    min={0.0}
                    max={8.0}
                    step={0.1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Log Probability Threshold" desc="The threshold for log probability in an audio segment.">
                <SettingSlider
                    value={config.logprob_thold}
                    onChange={(v) => { update({ ...config, logprob_thold: v }) }}
                    min={-8.0}
                    max={0.0}
                    step={0.1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Max Context" desc="The maximum context length for the model.">
                <SettingSlider
                    value={config.max_context}
                    onChange={(v) => { update({ ...config, max_context: v }) }}
                    min={-1}
                    max={5120}
                    step={1}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Suppress NST" desc="Enable or disable suppression of non-speech tokens.">
                <Switch
                    checked={config.suppress_nst}
                    onChange={(e) => { update({ ...config, suppress_nst: e.target.checked }) }}
                />
            </SettingItemFrame>
            <SettingItemFrame title="No Fallback" desc="Enable or disable fallback to other models.">
                <Switch
                    checked={config.no_fallback}
                    onChange={(e) => { update({ ...config, no_fallback: e.target.checked }) }}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Using VAD" desc="Enable or disable voice activity detection.">
                <Switch
                    checked={config.vad_model !== null}
                    onChange={(e) => { update({ ...config, vad_model: e.target.checked ? "/" : null }) }}
                />
            </SettingItemFrame>
            <Collapse in={config.vad_model !== null} unmountOnExit>
                <SettingItemFrame title="VAD Model" desc="The voice activity detection model to be used.">
                    <Box sx={{ width: 513 }}>
                        <PathSelector
                            label="VAD Model Path"
                            value={config.vad_model ?? "/"}
                            onEnter={(path) => { update({ ...config, vad_model: path }) }}
                            onClose={(path) => { update({ ...config, vad_model: path }) }}
                            type="file"
                            filter="model"
                        />
                    </Box>
                </SettingItemFrame>
                <SettingItemFrame title="Voice Speech Duration (s)" desc="The maximum duration of speech segments to be considered as a single voice segment.">
                    <SettingSlider
                        value={config.voice_speech_duration}
                        onChange={(v) => { update({ ...config, voice_speech_duration: v }) }}
                        min={0}
                        max={300}
                        step={1}
                        field={true}
                    />
                </SettingItemFrame>
                <SettingItemFrame title="Voice Minimum Silence Duration (ms)" desc="The minimum duration of silence to be considered as a single voice segment.">
                    <SettingSlider
                        value={config.voice_minimum_silence_duration}
                        onChange={(v) => { update({ ...config, voice_minimum_silence_duration: v }) }}
                        min={0}
                        max={1000}
                        step={1}
                        field={true}
                    />
                </SettingItemFrame>
                <SettingItemFrame title="Voice Threshold" desc="The threshold for voice activity detection.">
                    <SettingSlider
                        value={config.voice_threshold}
                        onChange={(v) => { update({ ...config, voice_threshold: v }) }}
                        min={0.0}
                        max={1.0}
                        step={0.01}
                        field={true}
                    />
                </SettingItemFrame>
            </Collapse>
        </Box>
    );
}
