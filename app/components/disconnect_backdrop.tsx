import { Backdrop, Typography } from '@mui/material';

import { useNavigate } from 'react-router';

export default function DisconnectBackdrop({ open }: { open: boolean }) {
    const navigate = useNavigate();
    return (
        <Backdrop
            open={open}
            sx={{
                color: '#fff',
                flexDirection: "column",
                display: "flex",
                justifyContent: "space-evenly",
                alignItems: "center",
                zIndex: 9999,
            }}
            onClick={() => navigate('/')}
        >
            <Typography variant="h3">无法连接到服务器，请检查后端服务器状态</Typography>
            <Typography variant="h3">单击任意位置跳转到连接页面</Typography>
        </Backdrop>
    );
}