import {
    Autocomplete,
    TextField,
    Typography,
    IconButton,
    Button,
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from "@mui/material";
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

import { useState } from "react";

import { api } from "../hooks/api";
import { getLocalStorage } from "../hooks/storage";
import { useErrorMsg } from "../components/error_popout";


export interface PathInfo {
    dir: string[]
    file: string[]
}


export default function PathSelector({ label, onClose, type, org, addDir }: { label: string; onClose: (path: string) => void; type?: string; org?: string; addDir?: boolean }) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();

    const [path, setPath] = useState(org ? org : "/");
    const [pathList, setPathList] = useState<PathInfo>({ dir: [], file: [] });

    const [openNewFolder, setOpenNewFolder] = useState("");
    const makeDir = () => {
        api.get(`${apiUrl}/path/mkdir?path_str=${path}${openNewFolder}`)
            .then(() => {
                setPath(prev => prev + openNewFolder + "/");
                setOpenNewFolder("");
            })
            .catch(error => {
                pushError(error, "Create new folder");
            })
    };

    const fetchFileList = (path: string) => {
        if (path === "") path = "/";
        api.get(`${apiUrl}/path/ls?path_str=${path}`).json<PathInfo>()
            .then(data => {
                setPathList(data);
            })
            .catch(error => {
                pushError(error, "Fetch file list");
            })
    };

    const backPath = (path: string) => {
        if (path === "/") return "/";
        if (path.endsWith("/")) path = path.slice(0, -1);
        return path.split('/').slice(0, -1).join('/') + "/" || "/";
    };

    const close_check = async () => {
        try {
            await api.get(`${apiUrl}/path/ls?path_str=${path}`).json<PathInfo>()

            if (type) {
                if (path.split("/").slice(-1)[0].includes(".")) {
                    if (type === "file") {
                        onClose(path);
                    }
                    else {
                        pushMsg("Now it is a file. Please select a directory", "error");
                    }
                }
                else {

                    if (type === "file") {

                        pushMsg("Now it is a directory. Please select a file", "error");
                    }
                    else {
                        onClose(path);
                    }
                }
            }
            else {
                onClose(path);
            }
        }
        catch (error) {
            pushError(error, "Select path");
            return;
        }
    };

    return (
        <>
            <Dialog open={openNewFolder !== ""} onClose={() => setOpenNewFolder("")} fullWidth>
                <DialogTitle>
                    <Typography variant="h6" fontWeight="bold">
                        Create New Folder
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label="Folder Name"
                        variant="outlined"
                        sx={{ mt: 1, width: "100%" }}
                        onChange={(e) => setOpenNewFolder(e.target.value.replaceAll("/", "").replaceAll("&", " "))}
                    />
                </DialogContent>
                <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                    <Button onClick={() => setOpenNewFolder("")} variant="outlined">
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            makeDir();
                            onClose(path + openNewFolder + "/");
                        }}
                        disabled={openNewFolder === ""}
                    >
                        Create
                    </Button>
                </DialogActions>
            </Dialog>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                width: "100%",
                gap: 1,
            }}>
                <IconButton onClick={() => {
                    setPath(backPath(path));
                    fetchFileList(backPath(path));
                    onClose(backPath(path));
                }}>
                    <ArrowBackRoundedIcon color="primary" />
                </IconButton>
                <Autocomplete
                    disableCloseOnSelect
                    disablePortal
                    value={path}
                    onOpen={() => fetchFileList(path)}
                    onClose={() => close_check()}
                    options={[
                        ...pathList.dir
                            .filter((dir) => dir.startsWith(path.slice(path.lastIndexOf("/") + 1)))
                            .map((dir) => (path.slice(0, path.lastIndexOf("/") + 1) + dir + "/").replaceAll("//", "/")),

                        ...(
                            type === "dir"
                                ? []
                                : pathList.file
                                    .filter((file) => file.startsWith(path.slice(path.lastIndexOf("/") + 1)))
                                    .map((file) => (path.slice(0, path.lastIndexOf("/") + 1) + file).replaceAll("//", "/"))
                        )
                    ]}
                    sx={{ width: "calc(100% - 68px)" }}
                    onInputChange={(_, value) => {
                        fetchFileList(value.slice(0, value.lastIndexOf("/") + 1).replaceAll("'", "").replaceAll('"', ""));
                        setPath(value === "" ? "/" : value.replaceAll("'", "").replaceAll('"', ""));
                    }}
                    renderInput={(params) => <TextField
                        {...params}
                        multiline
                        label={label}
                        variant="outlined"
                    />}
                />
                {addDir &&
                    <IconButton onClick={() => setOpenNewFolder("new_folder")}>
                        <CreateNewFolderRoundedIcon color="primary" />
                    </IconButton>
                }
            </Box>

        </>
    );
}