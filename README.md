<div align="center">
  <img src="./public/icon.png" alt="structure" width="288" />
  <br />
  <br />
  <img alt="Node Current" src="https://img.shields.io/node/v/%40rolldown%2Fplugin-babel">
  <img alt="Python Version" src="https://img.shields.io/badge/python-3.10%2B-blue">
  <img alt="GitHub License" src="https://img.shields.io/github/license/Xu-Xihe/svtav1UI">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/Xu-Xihe/svtav1UI">
  <img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/Xu-Xihe/svtav1UI/release.yml?label=Release">
	<img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/Xu-Xihe/svtav1UI/docker.yml?label=Docker">
  <br />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Xu-Xihe/svtav1UI">
	<img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/Xu-Xihe/svtav1UI">
	<img alt="GitHub Issues or Pull Requests" src="https://img.shields.io/github/issues/Xu-Xihe/svtav1UI">
 </div>

## Features

- With WebUI, convenient for checking progress and operation.
- Run `ffmpeg` locally, without performance loss.
- Task queue, with automatic hang-up interrupt.
- Bulk import & Global settings.

## Installations

### 1. Install FFmpeg

Follow the instruction from [ffmpeg.org](https://ffmpeg.org).

### 2. Install Api

- Download the [latest release](https://github.com/Xu-Xihe/svtav1UI/releases/latest/download/release.tar.gz).

- Unzip the file:

```bash
tar -xzf release.tar.gz
```

- Install pip packages:

```bas
pip install -r requirements.txt
```

- Run Api:

```bash
uvicorn main:app --host 0.0.0.0 --port 38888
```

### 3. Install Docker

Docker Hub

```bash
docker run -d -p 8888:80 starstreammm/stvav1ui:latest
```

Github

```bash
docker run -d -p 8888:80 ghcr.io/xu-xihe/svtav1ui:latest
```

## Links

FFmpeg: [https://ffmpeg.org](https://ffmpeg.org)

SVT-AV1 Encoder: [https://gitlab.com/AOMediaCodec/SVT-AV1/](https://gitlab.com/AOMediaCodec/SVT-AV1/)
