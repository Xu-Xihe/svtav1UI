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

## New 3.1 Version Released!!!

New features:

- Automatic Speech Recognition (ASR) by whisper.cpp and translation by llm (support openai API, mlx and llama).

- More video normalization parameters, including pixel format and color space.

- Rebuild the task queue and the insert dialog.

- Remove the support for vca, as it's unsuitable to our aim for fast and acceptable precision eta.

- Task Schedule is available now!


## Features

- With WebUI, convenient for checking progress and operation.
- Run `ffmpeg` locally, without performance loss.
- Task queue, with automatic hang-up interrupt.
- Bulk import & Global settings.
- GBM task prediction, more precise and lightly.
- Automatic Speech Recognition & Translation.

### Update V2 to V3

If you are updating v2 to v3, here are some projects you need to prepare.

First, make sure that **no tasks** are in the **waiting list**, as it will be rebuilt during the database updating.

Download the [latest release package](https://github.com/Xu-Xihe/svtav1UI/releases/latest/download/release.tar.gz) and unpack it.

Copy the `api/cache/config.db` file to the corresponding path in the new version, then start `main.py`.

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
docker run -d -p 8889:80 starstreammm/stvav1ui:latest
```

Github

```bash
docker run -d -p 8889:80 ghcr.io/xu-xihe/svtav1ui:latest
```

### 4. Install libomp

The XGBoost need `libomp` to function. Some distributions/operating systems may include this component by default.

#### MacOS

```bash
brew install libomp
```

#### Linux/Windows

Search for it.

### 5. (Optional) Install Whisper.cpp

The ASR function is base on it.

To install, follow the instructions at [Whisper.cpp](https://github.com/ggml-org/whisper.cpp).

### 6. (Optional) Install LLM framework

You can choose one from openai API, mlx and llama.

For OpenAI API,

```bash
pip install openai
```

For MLX (only recommendated for Apple Silicon),

```bash
pip install mlx-lm
```

For llama.cpp,

```bash
pip install llama-cpp-python
```

## Links

FFmpeg: [https://ffmpeg.org](https://ffmpeg.org)

SVT-AV1 Encoder: [https://gitlab.com/AOMediaCodec/SVT-AV1/](https://gitlab.com/AOMediaCodec/SVT-AV1/)

MUI: [https://mui.com/material-ui/](https://mui.com/material-ui/)
