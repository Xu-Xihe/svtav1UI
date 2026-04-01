import {
  Autocomplete,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";

import useLocalStorage from "../hooks/storage";
import { api } from "../hooks/api";
import { useErrorMsg } from "../components/error_popout";

interface UrlProps {
  protocol: string;
  host: string;
  port: string;
}


export default function Connection() {
  const [apiUrl, setApiUrl] = useLocalStorage("apiUrl", "", "local");
  const { pushError } = useErrorMsg();
  const navigate = useNavigate();
  const [urlProps, setUrlProps] = useState<UrlProps>({
    protocol: "http",
    host: "localhost",
    port: "38888",
  });


  const checkConnection = (url: string) => {
    api.get(`${url}/health`)
      .then(() => {
        setApiUrl(url);
        navigate("/waiting");
      })
      .catch((error) => {
        pushError(error, "Failed to connect to API");
      });
  }


  useEffect(() => {
    if (!apiUrl) return;
    const url = new URL(apiUrl);
    setUrlProps({
      protocol: url.protocol.slice(0, -1),
      host: url.hostname,
      port: url.port,
    });
  }, [apiUrl]);


  return (
    <>
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        width: "100vw",
      }}>
        <Paper elevation={8} sx={{
          height: "60%",
          width: "60%",
        }}>
          <Box sx={{
            display: "flex",
            height: "100%",
            width: "100%",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            py: 8,
          }}>
            <Typography variant="h3">
              Connect to API
            </Typography>
            <Box sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "center",
              width: "100%",
              gap: 3,
            }}>
              <Autocomplete
                disablePortal
                value={urlProps.protocol}
                options={["http", "https"]}
                sx={{ width: "12%" }}
                renderInput={(params) => <TextField
                  {...params}
                  label="Protocol"
                  variant="outlined"
                  onChange={(e) => {
                    setUrlProps({ ...urlProps, protocol: e.target.value });
                  }}
                />}
              />
              <Autocomplete
                disablePortal
                freeSolo
                value={urlProps.host}
                options={["localhost", ""]}
                sx={{ width: "46%" }}
                renderInput={(params) => <TextField
                  {...params}
                  label="Host"
                  variant="outlined"
                  onChange={(e) => {
                    setUrlProps({ ...urlProps, host: e.target.value });
                  }}
                />}
              />
              <Autocomplete
                disablePortal
                freeSolo
                value={urlProps.port}
                options={["38888"]}
                sx={{ width: "12%" }}
                renderInput={(params) => <TextField
                  {...params}
                  label="Port"
                  variant="outlined"
                  onChange={(e) => {
                    setUrlProps({ ...urlProps, port: e.target.value });
                  }}
                />}
              />
            </Box>
            <Box sx={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "flex-end",
              width: "100%",
              px: 8,
            }}>
              <Button variant="contained" onClick={() => {
                const url = `${urlProps.protocol}://${urlProps.host}:${urlProps.port}`;
                checkConnection(url);
              }}>
                Confirm
              </Button>
            </Box>
          </Box>
        </Paper >
      </Box >
    </>
  );
}
