import {
    Box,
    Slider,
    Typography,
    TextField,
} from '@mui/material';

import { useState } from 'react';


export function SettingSlider({
    value,
    onChange,
    min,
    max,
    step,
    field,
    maxWidth = 388,
    field_width = true,
}: {
    value: number,
    onChange: (value: number) => void,
    min: number,
    max: number,
    step: number,
    field?: boolean,
    maxWidth?: number | string,
    field_width?: boolean,
}) {

    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Slider
                value={value}
                onChange={(e, newValue) => {
                    onChange(newValue as number);
                }}
                min={min}
                max={max}
                step={step}
                sx={{ width: maxWidth }}
                valueLabelDisplay="auto"
            />

            {field === false &&
                <Box sx={field_width ? { width: 88 } : {}}>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                    >
                        {value}
                    </Typography>
                </Box>
            }

            {field === true &&
                <TextField
                    value={Number(value)}
                    onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) {
                            const clamped = Math.min(max, Math.max(min, v));
                            const stepped = Number((Math.round((clamped - min) / step) * step + min).toFixed(10));
                            onChange(stepped);
                        }
                    }}
                    type="number"
                    size="small"
                    sx={{ width: 88 }}
                    slotProps={{
                        htmlInput: {
                            min,
                            max,
                            step,
                        },
                    }}
                />
            }
        </Box >
    )
}