import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
} from '@mui/material';
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import { useEffect, useState } from 'react';
import { useNavigate } from "react-router";

import { getLocalStorage } from "~/hooks/storage";
import { useErrorMsg } from "~/components/error_popout";
import type { LLMTaskInfo, ApiPath, LanguageKey } from '~/hooks/model';
import { Language } from '~/hooks/model';
import { LLMSettingPage } from "~/routes/settings/llm_settings";
import { NobarOverflow } from "~/components/insert/frame";
import { InputAddNew } from "~/components/insert/input";
import { SettingItemFrame } from "~/routes/settings/components/frame";
import { api } from "~/hooks/api";

export default function InsertLLMTaskDialog({
    retry_task,
    onClose,
    onCancel,
}: {
    retry_task?: LLMTaskInfo;
    onClose: () => void;
    onCancel: () => void
}) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const navigate = useNavigate();
    const { pushMsg, pushError } = useErrorMsg();

    const [inserting, setInserting] = useState(false);
    const [tasks, setTasks] = useState<LLMTaskInfo[]>([]);
    const [tranLang, setTranLang] = useState<LanguageKey>("en");

    const newFilePath = (path: string) => {
        const name = path.slice(0, path.lastIndexOf("."));
        const index = name.lastIndexOf(".");
        const stat = name.slice(0, index === -1 ? undefined : index);
        return `${stat}.${tranLang}.srt`;
    };

    const getLang = (path: string) => {
        const match = path.match(/\.([^\.]+)\.srt$/);
        console.log("getLang", path, match, match && match[1] in Language);
        if (match && match[1] in Language) {
            return match[1] as LanguageKey;
        }
        return "en";
    };

    const commit = async () => {
        if (tasks.length === 0) { pushMsg("No tasks to insert.", "warning"); return; }
        setInserting(true);
        let error: LLMTaskInfo[] = [];
        for (const task of tasks) {
            try {
                await api.post(`${apiUrl}/task/submit/llm`, { json: task });
            }
            catch (e) { error.push(task); pushError(e, "Submit task: " + task.input); }
        }
        if (error.length > 0) {
            pushMsg(`Failed to submit ${error.length} task(s).`, "error");
            setTasks(error);
        }
        onClose();
        if (retry_task) {
            navigate("/failed");
        }
        else {
            navigate("/running");
        }
    };

    const addNew = async (path: string) => {
        try {
            const res = await api.get(`${apiUrl}/path/ls`, { searchParams: { path_str: path, filter: "subtitle" } }).json<ApiPath>()
            if (res.dir.length === 0 && res.file.length === 0) {
                if (tasks.some(task => task.input === path)) {
                    pushMsg("File already added.", "warning");
                }
                else {
                    setTasks(prev => [...prev, { input: path, output: newFilePath(path), org_lang: getLang(path), tran_lang: tranLang }]);
                }
            }
            else {
                let newFiles: string[] = [];
                for (const f of res.file) {
                    const fullPath = `${path}${f}`;
                    if (tasks.some(task => task.input === fullPath)) {
                        pushMsg(`File ${fullPath} already added.`, "warning");
                    }
                    else {
                        newFiles.push(fullPath);
                    }
                }
                setTasks(prev => [...prev, ...newFiles.map(file => ({ input: file, output: newFilePath(file), org_lang: getLang(file), tran_lang: tranLang }))]);
            }
        }
        catch (error) { pushError(error, "Fetch file list"); return; }
    }

    useEffect(() => {
        if (retry_task) {
            setTasks([retry_task]);
            setTranLang(retry_task.tran_lang);
        }
    }, []);

    useEffect(() => {
        setTasks(prev => prev.map(task => ({ ...task, output: newFilePath(task.input), tran_lang: tranLang })));
    }, [tranLang]);


    return (
        <Dialog open fullScreen onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { onCancel(); }
            if (e.key == "Enter") { commit(); }
        }
        }>
            <DialogTitle>
                <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    Insert LLM Task
                </Typography>
            </DialogTitle>
            <DialogContent sx={{
                display: "flex",
                flexDirection: "row",
                p: 1,
            }}>
                <NobarOverflow width="37%" gap={1}>
                    <InputAddNew
                        onInsert={async (path) => { await addNew(path); }}
                        filter="subtitle"
                    />
                    {tasks.map((task, index) => (
                        <ListItem key={task.input}>
                            <ListItemIcon sx={{ mr: 1 }}>
                                <IconButton onClick={(e) => {
                                    e.stopPropagation();
                                    setTasks(tasks.filter((t) => t.input !== task.input));
                                }}>
                                    <RemoveCircleRoundedIcon color="error" />
                                </IconButton>
                            </ListItemIcon>
                            <ListItemText>
                                <b>File {index + 1}</b>
                                <Select
                                    value={task.org_lang}
                                    onChange={(e) => setTasks(tasks.map((t) => t.input === task.input ? { ...t, tran_lang: e.target.value as LanguageKey } : t))}
                                    displayEmpty
                                    sx={{ width: 138, ml: 3, mb: 1 }}
                                >
                                    {Object.entries(Language)
                                        .map(([key, value]) => (
                                            <MenuItem key={key} value={key}>
                                                {value}
                                            </MenuItem>
                                        ))}
                                </Select>
                                <br />
                                <Typography>
                                    Input: {task.input}<br />
                                    Output: {task.output}
                                </Typography>
                            </ListItemText>
                            {task.org_lang === tranLang &&
                                <ListItemIcon>
                                    <Tooltip title="The translation language is same as the original language. Please change it to a different language.">
                                        <IconButton>
                                            <WarningAmberRoundedIcon color="warning" />
                                        </IconButton>
                                    </Tooltip>
                                </ListItemIcon>
                            }
                        </ListItem>
                    ))}
                </NobarOverflow>
                <Divider orientation="vertical" flexItem />
                <NobarOverflow width="63%">
                    <SettingItemFrame title="Translate Language">
                        <Select
                            value={tranLang}
                            onChange={(e) => setTranLang(e.target.value as LanguageKey)}
                            displayEmpty
                            sx={{ width: 138, ml: 1 }}
                        >
                            {Object.entries(Language)
                                .filter(([key]) => key !== "zh")
                                .map(([key, value]) => (
                                    <MenuItem key={key} value={key}>
                                        {value}
                                    </MenuItem>
                                ))}
                        </Select>
                    </SettingItemFrame>
                    <LLMSettingPage embedded />
                </NobarOverflow>
            </DialogContent>
            <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                <Button onClick={onCancel} variant="outlined">
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={commit}
                    loading={inserting}
                    loadingPosition="end"
                >
                    Insert
                </Button>
            </DialogActions>
        </Dialog >
    );
}