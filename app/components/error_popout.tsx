import { Alert, IconButton, Box, Collapse } from "@mui/material";
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { create } from "zustand";
import { useEffect, useState } from "react";
import { HTTPError } from "ky";

interface ErrorMsgState {
    msg: { id: string; text: string; level: "error" | "warning" | "info" | "success" }[];
    open: boolean;
    pushMsg: (text: string, level?: "error" | "warning" | "info" | "success") => void;
    pushError: (error: unknown, prefix?: string) => Promise<void>;
    delMsg: (id: string) => void;
    setOpen: (open: boolean) => void;
}

export const useErrorMsg = create<ErrorMsgState>((set, get) => ({
    msg: [],
    open: true,

    pushMsg: (text, level = "error") => {
        const id = Date.now() + Math.random().toString(16).slice(2);
        set((state) => ({
            msg: [...state.msg, { id, text, level }],
        }));
    },

    pushError: async (error, prefix = "") => {
        let text = "";

        try {
            // 1️⃣ HTTPError（有后端返回）
            if (error instanceof HTTPError) {
                try {
                    const res = await error.response.json();
                    const code = res?.code ?? "";
                    const detail = res?.detail ?? res?.msg ?? "";
                    text = [code, detail].filter(Boolean).join(" ");
                } catch {
                    text = await error.response.text();
                }
            }
            // 2️⃣ 标准 Error
            else if (error instanceof Error) {
                text = error.message;
            }
            // 3️⃣ 其他类型
            else {
                text = String(error);
            }
        } catch {
            text = "未知错误";
        }

        const finalText = prefix ? `${prefix}: ${text}` : text;
        get().pushMsg(finalText, "error");
    },

    delMsg: (id) => {
        set((state) => ({
            msg: state.msg.filter((m) => m.id !== id)
        }));
    },

    setOpen: (open) => {
        if (!open) {
            set({ msg: [] });
        }
        set({ open });
    },
}));

export default function ErrorPopout() {
    const { msg, delMsg, open } = useErrorMsg();
    const [visible, setVisible] = useState<Record<string, boolean>>({});

    useEffect(() => {
        msg.forEach(m => {
            if (!(m.id in visible)) {
                setVisible(prev => ({ ...prev, [m.id]: false }));
                setTimeout(() => {
                    setVisible(prev => ({ ...prev, [m.id]: true }));
                    setTimeout(() => handleClose(m.id), 6000);
                }, 10);
            }
        });
    }, [msg]);

    const handleClose = (id: string) => {
        setVisible(prev => ({ ...prev, [id]: false }));
        setTimeout(() => delMsg(id), 300);
    };

    return (
        <Box
            sx={{
                position: "fixed",
                bottom: 16,
                left: 16,
                display: open ? "flex" : "none",
                flexDirection: "column",
                gap: 1,
                zIndex: 8889,
            }}
        >
            {msg.map((m) => (
                <Collapse key={m.id} in={visible[m.id]} timeout={300}>
                    <Box sx={{ transition: "margin 0.3s" }}>
                        <Alert
                            variant="filled"
                            severity={m.level}
                            sx={{
                                width: 368,
                                wordBreak: "break-word",
                            }}
                            action={
                                <IconButton
                                    onClick={() => handleClose(m.id)}
                                    sx={{ borderRadius: 1, p: 0.5 }}
                                >
                                    <CloseRoundedIcon sx={{ color: "white" }} />
                                </IconButton>
                            }
                        >
                            {m.text}
                        </Alert>
                    </Box>
                </Collapse>
            ))}
        </Box>
    );
}