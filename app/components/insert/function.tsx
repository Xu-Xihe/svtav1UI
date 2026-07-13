import { useErrorMsg } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import type {
    ApiPath,
    FileInfo,
    Taskls,
    TranscodeInfo,
    TaskInfo,
    GeneralSettings,
} from "~/hooks/model";
import { api } from "~/hooks/api";
import { getEta } from "~/hooks/eta";
import type { InsertSettings } from "./settings";

const { pushMsg, pushError } = useErrorMsg.getState();
const apiUrl = getLocalStorage("apiUrl", "local");

export async function addNewFile(path: string, pathls: string[], settings: GeneralSettings): Promise<Taskls[]> {
    let files: string[] = [];
    let rtn: Taskls[] = [];
    try {
        const res = await api.get(`${apiUrl}/path/ls?path_str=${path}`).json<ApiPath>()
        if (res.dir.length === 0 && res.file.length === 0) {
            files = [path];
        }
        else {
            files = res.file.map(f => `${path}${path.endsWith("/") ? "" : "/"}${f}`);
        }
    }
    catch (error) { pushError(error, "Fetch file list"); return []; }
    for (const file of files) {
        try {
            // Avoid duplicate tasks in the list
            if (pathls.includes(file)) {
                pushMsg(`Task already exists: ${file}`, "warning");
                continue;
            }

            const input = await api.get(`${apiUrl}/file/info?file_path=${file}`).json<FileInfo>();
            const trans = await api.post(`${apiUrl}/file/single`, { json: input }).json<TranscodeInfo>();
            const eta = await getEta({ input: [input], args: trans, settings: settings, output: "" })
            const file_name = file.slice(file.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");

            rtn.push({ input, output: file_name, trans, eta: eta });
        }
        catch (error) { pushError(error, "Fetch File Info: " + file); }
    }
    return rtn;
}

export async function submitTaskInfo(task: TaskInfo, priority: boolean) {
    try {
        await api.post(`${apiUrl}/task/submit`, { json: task, searchParams: { priority: priority } });
    }
    catch (error) {
        pushError(error, "Submit Multi-in-one task");
        throw error;
    }
}

export async function submitTaskls(tasks: Taskls[], output_path: string, settings: GeneralSettings, insert: InsertSettings) {
    let i = insert.priority ? tasks.length - 1 : 0;
    let error: Taskls[] = [];
    for (i; insert.priority ? i >= 0 : i < tasks.length; insert.priority ? i-- : i++) {
        let newTask: TaskInfo;
        if (insert.only_subtitle) {
            newTask = {
                input: [tasks[i].input],
                output: tasks[i].input.path,
                args: {
                    ...tasks[i].trans,
                    ...insert,
                    video_br: -1,
                },
                settings: settings,
            }
        }
        else {
            newTask = {
                input: [tasks[i].input],
                output: output_path + tasks[i].output + ".mp4",
                args: {
                    ...tasks[i].trans,
                    video_br: Math.min(tasks[i].trans.video_br, settings.max_bitrate_mb * 1000 * 1000),
                    ...insert,
                },
                settings: settings,
            };
        }
        try {
            await api.post(`${apiUrl}/task/submit`, { json: newTask, searchParams: { priority: insert.priority } });
        }
        catch (e) { error.push(tasks[i]); pushError(e, "Submit task: " + tasks[i].input.path); }
    }
    if (error.length > 0) {
        pushMsg(`Failed to submit ${error.length} task(s).`, "error");
        throw error;
    }
}

export async function multiTaskInfo(tasks: Taskls[], settings: GeneralSettings): Promise<[TranscodeInfo, number]> {
    try {
        const res = await api.post(`${apiUrl}/file/multi`, { json: tasks.map(t => t.input) }).json<TranscodeInfo>()
        const eta = await getEta({ input: tasks.map(t => t.input), args: res, settings: settings, output: "" })
        return [res, eta];
    }
    catch (error) {
        pushError(error, "Fetch Multi-in-one task info");
        throw error;
    }
}

export async function decodeTaskInfo(task: TaskInfo): Promise<[Taskls[], string, GeneralSettings, InsertSettings]> {
    let insertSettings: InsertSettings = ({
        multi_in_one: false,
        allow_av1: true,
        only_subtitle: false,
        priority: false,
        rotate: task.args.rotate,
        subtitle: task.args.subtitle,
        tran: task.args.tran,
        tran_inmediate: task.args.tran_inmediate,
    });
    let tasks: Taskls[] = [];
    if (task.input.length > 1) {
        insertSettings.multi_in_one = true;
        for (const input of task.input) {
            try {
                const res = await api.post(`${apiUrl}/file/single`, { json: input }).json<TranscodeInfo>();
                const eta = await getEta({ input: [input], args: res, settings: task.settings, output: "" });
                const file_name = input.path.slice(input.path.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");
                tasks.push({ input, output: file_name, trans: res, eta });
            }
            catch (error) {
                pushError(error, "Fetch File Info: " + input);
            }
        }
    }
    else {
        const eta = await getEta(task);
        const file_name = task.input[0].path.slice(task.input[0].path.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");
        tasks.push({ input: task.input[0], output: file_name, trans: task.args, eta });
    }
    return [tasks, task.output.slice(0, task.output.lastIndexOf("/") + 1), task.settings, insertSettings];
}

export async function fetchSettings(): Promise<GeneralSettings> {
    try {
        const res = await api.get(`${apiUrl}/settings/g`).json<GeneralSettings>()
        return res;
    }
    catch (error) { pushError(error, "Fetch General settings"); throw error; }
}