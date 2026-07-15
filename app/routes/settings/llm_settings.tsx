import {
    Box,
    Divider,
    Tooltip,
    Typography,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TextField,
} from '@mui/material';
import AdjustRoundedIcon from '@mui/icons-material/AdjustRounded';
import { useState, useEffect } from "react";

import { useErrorMsg } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { api } from "~/hooks/api";
import type { TranslatorSettings } from "~/hooks/model";
import { SettingItemFrame, SettingTitleFrame } from "~/routes/settings/components/frame";
import { SettingSlider } from "~/routes/settings/components/slider";
import PathSelector from "~/components/pathselector";

function split_llm_key(current: string) {
    const parts = current.split(";");
    while (parts.length < 3) {
        parts.push("");
    }
    return [parts[0], parts[1], parts[2]] as const;
}


export function LLMSettingPage({ embedded = false }: { embedded?: boolean }) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const defaultConfig = {
        llm_type: "openai-api" as "openai-api" | "llama.cpp" | "mlx",
        llm_key: null,
        max_tokens: 8000,
        max_input: 330,
        prompt: [
            {
                "role": "user",
                "content": `You are a professional and accurate translator.
You will receive a multi-line text, and then tranlate it line-by-line to the target language.
The multi-line text is provided for you to understand the context only.
Do not infer or guess the meaning of the text.
Start output the translation with a line 'Singal: yyytttqqq.'.`
            }
        ],
        temperature: 0.13
    };

    // @ts-expect-error
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
    useEffect(() => { check(); }, [config.llm_key]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
            {!embedded &&
                <>
                    <SettingTitleFrame title="LLM Settings" reset={() => update({ ...config, ...defaultConfig })}>
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
                </>
            }
            <SettingItemFrame title="LLM Type">
                <FormControl>
                    <InputLabel>LLM Type</InputLabel>
                    <Select
                        value={config.llm_type}
                        label="LLM Type"
                        onChange={(e) => update({ ...config, llm_type: e.target.value as "openai-api" | "llama.cpp" | "mlx" })}
                        sx={{ width: 188 }}
                    >
                        <MenuItem value={"openai-api"}>OpenAI API</MenuItem>
                        <MenuItem value={"llama.cpp"}>Llama.cpp</MenuItem>
                        <MenuItem value={"mlx"}>MLX</MenuItem>
                    </Select>
                </FormControl>
            </SettingItemFrame>
            <SettingItemFrame title={config.llm_type === "openai-api" ? "OpenAI API Key" : "Model Path"}>
                {config.llm_type === "openai-api"
                    ?
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 3 }}>
                        <TextField
                            label="Base URL"
                            value={split_llm_key(config.llm_key || "")[0]}
                            onChange={(e) => update({
                                ...config, llm_key: `${e.target.value}; ${split_llm_key(config.llm_key || "")[1]
                                    };${split_llm_key(config.llm_key || "")[2]} `
                            })}
                            sx={{ width: 188 }}
                        />
                        <TextField
                            label="API Key"
                            value={split_llm_key(config.llm_key || "")[1]}
                            onChange={(e) => update({ ...config, llm_key: `${split_llm_key(config.llm_key || "")[0]};${e.target.value};${split_llm_key(config.llm_key || "")[2]} ` })}
                            sx={{ width: 188 }}
                        />
                        <TextField
                            label="Model"
                            value={split_llm_key(config.llm_key || "")[2]}
                            onChange={(e) => update({ ...config, llm_key: `${split_llm_key(config.llm_key || "")[0]};${split_llm_key(config.llm_key || "")[1]};${e.target.value} ` })}
                            sx={{ width: 188 }}
                        />
                    </Box>
                    :
                    <Box sx={{ width: 513 }}>
                        <PathSelector
                            label="Model Path"
                            value={config.llm_key}
                            onClose={(value) => update({ ...config, llm_key: value })}
                            onEnter={(value) => update({ ...config, llm_key: value })}
                            type="dir"
                        />
                    </Box>
                }
            </SettingItemFrame>
            {config.llm_type === "openai-api" &&
                <SettingItemFrame title="Max Tokens">
                    <SettingSlider
                        value={config.max_tokens}
                        min={500}
                        max={32000}
                        step={100}
                        onChange={(value) => update({ ...config, max_tokens: value })}
                        field={true}
                    />
                </SettingItemFrame>
            }
            <SettingItemFrame title="Max Input Length (in Characters)">
                <SettingSlider
                    value={config.max_input}
                    min={30}
                    max={8000}
                    step={10}
                    onChange={(value) => update({ ...config, max_input: value })}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Temperature">
                <SettingSlider
                    value={config.temperature}
                    min={0.0}
                    max={2.0}
                    step={0.01}
                    onChange={(value) => update({ ...config, temperature: value })}
                    field={true}
                />
            </SettingItemFrame>
            <SettingItemFrame title="Prompt" desc="Prompt at the start of the conversation, used to guide the model's behavior. Don't modify this unless you know what you're doing.">
                <TextField
                    disabled={embedded}
                    multiline
                    value={JSON.stringify(config.prompt, null, 4)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            if (Array.isArray(parsed)) {
                                update({ ...config, prompt: parsed });
                            }
                        } catch (error) {
                            // Invalid JSON, do nothing
                        }
                    }}
                    sx={{ width: "83%" }}
                />
            </SettingItemFrame>
        </Box>
    );
}


export default function LLMSettingsPage() {
    return <LLMSettingPage />;
}