import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    List,
    Divider,
} from '@mui/material';

import { useEffect, useState } from 'react';
import { useNavigate } from "react-router";

import type { TaskInfo, GeneralSettings, TranscodeInfo, Taskls } from "~/hooks/model";
import useLocalStorage from "~/hooks/storage";
import { useErrorMsg } from "~/components/error_popout";
import { getEta } from "~/hooks/eta";
import PathSelector from "~/components/pathselector";
import { addNewFile, submitTaskInfo, submitTaskls, fetchSettings, decodeTaskInfo, multiTaskInfo } from "~/components/insert/function";
import { OutputInfo, OutputSubInfo, OutputTitle } from "~/components/insert/output";
import { InputTitle, InputInfoList, InputAddNew } from "~/components/insert/input";
import { NobarOverflow, ColumnWidth } from "~/components/insert/frame";
import { type InsertSettings, SettingsPanel } from "~/components/insert/settings";

export default function InsertTaskDialog({
    retry_task,
    onClose,
    onCancel,
}: {
    retry_task?: TaskInfo;
    onClose: () => void;
    onCancel: () => void
}) {
    // sys const
    const navigate = useNavigate();
    const { pushMsg } = useErrorMsg();

    // user variables
    const [tasks, setTasks] = useState<Taskls[]>([]);
    const [outputPath, setOutputPath] = useLocalStorage("outputPath", "/", "local");
    const [settings, setSettings] = useState<GeneralSettings>({
        overwrite: false,
        delete_source: true,
        retry: 3,

        preset: 6,
        max_bitrate_mb: 48,
        overshoot_pct: 100,
        undershoot_pct: 10,
        minsection_pct: 80,
        maxsection_pct: 6000,
        keyint: "6s",
        lookahead: 120,
        scd: true,
    });

    // state variables
    const [inputMustClose, setInputMustClose] = useState<boolean>(false);
    const [multiEta, setMultiEta] = useState(-1);
    const [multiargs, setMultiargs] = useState<TranscodeInfo>({} as TranscodeInfo);
    const [inserting, setInserting] = useState(false);
    const [insertSettings, setInsertSettings] = useState<InsertSettings>({
        multi_in_one: false,
        allow_av1: false,
        only_subtitle: false,
        priority: false,
    });

    const commit = () => {
        if (tasks.length === 0) { pushMsg("No tasks to insert.", "warning"); return; }
        setInserting(true);
        if (retry_task) {
            const newTask: TaskInfo = {
                ...retry_task,
                args: {
                    ...retry_task.args,
                    video_br: insertSettings.only_subtitle ? -1 : Math.min(retry_task.args.video_br, settings.max_bitrate_mb * 1000 * 1000),
                    ...insertSettings,
                },
                output: outputPath + tasks[0].output + ".mp4",
                settings: settings,
            };
            submitTaskInfo(newTask, insertSettings.priority)
                .then(() => {
                    pushMsg(`Insert the failed task successfully.`, "success");
                    onClose();
                    navigate("/failed");
                });
        }
        else if (insertSettings.multi_in_one) {
            const newTask: TaskInfo = {
                input: tasks.map(t => t.input),
                output: outputPath + tasks[0].output + ".mp4",
                args: {
                    ...multiargs,
                    ...insertSettings,
                    video_br: Math.min(multiargs.video_br, settings.max_bitrate_mb * 1000 * 1000),
                },
                settings: settings,
            };
            submitTaskInfo(newTask, insertSettings.priority)
                .then(() => {
                    pushMsg(`Insert the multi-in-one task successfully.`, "success");
                    onClose();
                    navigate("/running");
                });
        }
        else {
            submitTaskls(tasks, outputPath, settings, insertSettings)
                .then(() => {
                    pushMsg(`Insert ${tasks.length} task(s) successfully.`, "success");
                    onClose();
                    navigate("/running");
                })
                .catch((error) => {
                    if (Array.isArray(error)) {
                        setTasks(tasks.filter((task) => error.some((e) => e.input.path === task.input.path)));
                    }
                });
        }
        setInserting(false);
    };


    useEffect(() => {
        if (retry_task) {
            decodeTaskInfo(retry_task)
                .then(([tasks, output_path, settings, insertSettings]) => {
                    setTasks(tasks);
                    setOutputPath(output_path);
                    setSettings(settings);
                    setInsertSettings(insertSettings);
                })
        }
        else {
            fetchSettings().then(res => { setSettings(res); })
        }
    }, []);

    useEffect(() => {
        if (!insertSettings.multi_in_one) return;
        if (tasks.length === 0) {
            setInsertSettings({ ...insertSettings, multi_in_one: false });
            pushMsg("Add any input file before open Multi-in-one transcode.", "info");
            return;
        }
        if (insertSettings.multi_in_one) {
            multiTaskInfo(tasks, settings)
                .then(([args, eta]) => {
                    setMultiargs(args);
                    setMultiEta(eta);
                })
        }
    }, [tasks, insertSettings.multi_in_one]);

    useEffect(() => {
        if (tasks.length === 0) return;
        if (insertSettings.multi_in_one) {
            getEta({ input: tasks.map(t => t.input), args: multiargs, settings: settings, output: "" }).then((res) => setMultiEta(res));
        }
        Promise.all(
            tasks.map((t) =>
                getEta({
                    input: [t.input], args: t.trans, settings: settings, output: "",
                }).then((eta) => ({ ...t, eta }))
            )
        ).then(setTasks);
    }, [settings]);

    return (
        <Dialog open fullScreen onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") { onCancel(); }
            if (e.key == "Enter") { commit(); }
        }
        }>
            <DialogTitle>
                <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    Insert Task
                </Typography>
            </DialogTitle>
            <DialogContent sx={{
                display: "flex",
                flexDirection: "row",
                p: 1,
            }}>
                {/* Input Section */}
                <ColumnWidth width="38%">
                    <InputTitle
                        insert={insertSettings}
                        onChangeInsert={setInsertSettings}
                        clearList={() => setTasks([])}
                        disable={retry_task !== undefined}
                    />
                    <NobarOverflow>
                        <List>
                            <InputInfoList
                                tasks={tasks}
                                insertSettings={insertSettings}
                                disable={retry_task !== undefined}
                                close={inputMustClose}
                                onChange={setTasks}
                            />
                            <InputAddNew
                                onOpen={(open) => setInputMustClose(open)}
                                onInsert={async (path) => {
                                    const newTasks = await addNewFile(path, tasks.map(t => t.input.path), settings);
                                    setTasks([...tasks, ...newTasks]);
                                }}
                            />
                        </List>
                    </NobarOverflow>
                </ColumnWidth>
                <Divider orientation="vertical" flexItem />

                {/* Output Section */}
                <ColumnWidth width="38%" gap={3}>
                    <OutputTitle
                        total_eta={insertSettings.multi_in_one ? multiEta : tasks.reduce((sum, task) => sum + Math.max(task.eta, 0), 0)}
                        show={insertSettings.only_subtitle}
                    />
                    {!insertSettings.only_subtitle &&
                        <PathSelector
                            label="Output Dir"
                            onClose={(path) => setOutputPath(path)}
                            onEnter={(path) => {
                                setOutputPath(path);
                                if (document.activeElement instanceof HTMLElement) {
                                    document.activeElement.blur();
                                }
                            }}
                            value={outputPath}
                            type="dir"
                            addDir
                        />
                    }
                    <Divider />
                    <NobarOverflow>
                        {insertSettings.multi_in_one && tasks.length > 0
                            ? <OutputInfo
                                task={{
                                    input: tasks[0].input,
                                    output: tasks[0].output,
                                    trans: multiargs,
                                    eta: multiEta,
                                }}
                                output={outputPath}
                                maxMbps={settings.max_bitrate_mb}
                                onRename={(newName) => setTasks(tasks.map((t, i) => i === 0 ? { ...t, output: newName } : t))}
                            />
                            : insertSettings.only_subtitle
                                ? tasks.map((task, index) => <OutputSubInfo
                                    key={task.input.path}
                                    task={task}
                                    index={index + 1}
                                    insert={insertSettings}
                                />)
                                : tasks
                                    .filter((task) => insertSettings.allow_av1 || task.input.codec !== "av1")
                                    .map((task, index) =>
                                        <OutputInfo
                                            key={task.input.path}
                                            task={task}
                                            index={index + 1}
                                            output={outputPath}
                                            maxMbps={settings.max_bitrate_mb}
                                            onRename={(newName) => setTasks(tasks.map((t, i) => i === index ? { ...t, output: newName } : t))}
                                        />)

                        }
                    </NobarOverflow>
                </ColumnWidth>
                <Divider orientation="vertical" flexItem />

                {/* Settings Section */}
                <ColumnWidth width="24%">
                    <SettingsPanel
                        settings={settings}
                        insert={insertSettings}
                        onChangeSettings={setSettings}
                        onChangeInsert={setInsertSettings}
                    />
                </ColumnWidth>
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