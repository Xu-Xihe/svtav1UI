import { Box, Divider, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useErrorMsg } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { NoContent } from '~/components/no_content';
import { api } from "~/hooks/api";
import type { ApiRunning } from "~/hooks/model";
import { FileInfoComponent, TaskInfoComponent } from "~/components/info";
import { NobarOverflow } from "~/components/insert/frame";
import { LineProgress, TranscodeProgress, AudioProgress, LogsProgress, LLMInfo } from "~/routes/running/info";
import { StateTitle } from "~/routes/running/state";


export default function Running() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [info, setInfo] = useState<ApiRunning | null>(null);

    useQuery({
        queryKey: ["running"],
        queryFn: async () => {
            try {
                const data = await api.get(`${apiUrl}/task/running`).json<ApiRunning | null>();
                setInfo(data);
            }
            catch (error) {
                pushError(error, "Running tasks");
            }
            return null;
        },
        retry: 0,
        refetchInterval: 500,
        refetchIntervalInBackground: false,
    })

    if (!info) { return (<NoContent title="running" />) }

    return (

        <Box sx={{
            display: "flex",
            justifyContent: "start",
            alignItems: "start",
            flexDirection: "column",
            height: "100%",
            width: "100%",
            gap: 1,
            p: 3,
        }}>
            <StateTitle llm={info.state === "llm_gen"} />
            <Divider flexItem variant='fullWidth' />
            <Box sx={{
                display: "flex",
                width: "100%",
                height: "80%",
                gap: 3,
            }}>
                {(info.state === "audio_prefix" || info.state === "transcode") &&
                    <NobarOverflow gap={1} width="36%">
                        <Typography variant="h5">
                            Input Info
                        </Typography>
                        <FileInfoComponent fileInfo={info.input} />
                    </NobarOverflow>
                }
                <NobarOverflow gap={1} width="36%">
                    <Typography variant="h5">
                        Output Info
                    </Typography>
                    {info.state === "llm_gen"
                        ? <LLMInfo info={info} />
                        : <TaskInfoComponent task={info} />
                    }
                </NobarOverflow>
                {info.state === "audio_prefix" &&
                    <NobarOverflow gap={1} width="28%">
                        <AudioProgress info={info} />
                    </NobarOverflow>
                }
                {info.state === "transcode" &&
                    <NobarOverflow gap={1} width="28%">
                        <TranscodeProgress info={info} />
                    </NobarOverflow>
                }
                {info.state === "llm_gen" &&
                    <Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: "70%",
                    }}>
                        <LogsProgress title="LLM Generation" info={info} />
                    </Box>
                }
                {info.state === "whisper" &&
                    <Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: "70%",
                    }}>
                        <LogsProgress title="Whisper" info={info} />
                    </Box>
                }
            </Box>
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                height: "20%",
            }}>
                <LineProgress progress={info.progress} />
            </Box>
        </Box>
    );
}