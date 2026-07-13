import asyncio
from io import TextIOWrapper
from typing import Optional, Callable
from datetime import datetime, timezone

from src.models import (
    ApiRunning,
    TranslatorSettings,
    LLMTaskInfo,
    TaskInfo,
)
from src.logger import Lg
from src.database import Database as db

OUTPUT_FLAG = "这是翻译结果的开始; This is the start of the translation result; 标识符: yyytttqqq."


class _openai:

    def __init__(self, config: TranslatorSettings):
        from openai import OpenAI  # type: ignore

        if config.llm_key is None:
            raise ValueError("LLM key is not set.")
        base_url, key, model = config.llm_key.split(";")

        self.config = config
        self.client = OpenAI(
            base_url=base_url,
            api_key=key,
            timeout=60,
        )
        self.model = model

    def gen(self, prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=self.config.prompt + [{"role": "user", "content": prompt}],  # type: ignore
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
        )
        content = response.choices[0].message.content
        return content.strip() if content is not None else ""


class _mlx:
    def __init__(self, config: TranslatorSettings):
        from mlx_lm import load  # type: ignore

        if config.llm_key is None:
            raise ValueError("LLM key is not set.")

        self.config = config
        self.client, self.tokenizer, *_ = load(config.llm_key)

    def gen(self, prompt: str) -> str:
        from mlx_lm import generate
        from mlx_lm.sample_utils import make_sampler

        msg = self.config.prompt + [{"role": "user", "content": prompt}]
        msg_fit = self.tokenizer.apply_chat_template(msg, tokenize=False)
        sampler = make_sampler(temp=self.config.temperature)

        response = generate(
            self.client,
            self.tokenizer,
            msg_fit,
            sampler=sampler,
        )
        return response


class _llama:

    def __init__(self, config: TranslatorSettings):
        from llama_cpp import Llama  # type: ignore

        if config.llm_key is None:
            raise ValueError("LLM key is not set.")

        self.config = config
        self.client = Llama(
            model_path=config.llm_key,
            n_ctx=config.max_tokens,
        )

    def gen(self, prompt: str) -> str:
        response = self.client.create_chat_completion(
            messages=self.config.prompt + [{"role": "user", "content": prompt}],  # type: ignore
            max_tokens=self.config.max_tokens,
            temperature=self.config.temperature,
        )

        return response["choices"][0]["message"]["content"].strip()


class LLM:

    def __init__(self, config: TranslatorSettings):
        self.config = config
        self.progress: ApiRunning
        self.task: LLMTaskInfo
        self.gen: Callable[[str], str]
        self.output: TextIOWrapper

        if config.llm_type == "openai-api":
            self.gen = _openai(config).gen
            Lg.debug(f"LLM load by OpenAI API: {config.llm_key}")
        elif config.llm_type == "mlx":
            self.gen = _mlx(config).gen
            Lg.debug(f"LLM load by MLX: {config.llm_key}")
        elif config.llm_type == "llama.cpp":
            self.gen = _llama(config).gen
            Lg.debug(f"LLM load by LLaMA.cpp: {config.llm_key}")
        else:
            raise ValueError(f"Unsupported LLM type: {config.llm_type}")

    async def run(self, task: LLMTaskInfo) -> None:
        try:
            # validate task
            self.task = LLMTaskInfo.model_validate(task.model_dump())
            self.progress = ApiRunning.model_validate(task.model_dump())
            self.progress.state = "llm_gen"
            if not self.task.input.is_file():
                raise FileNotFoundError(f"Input file not found: {self.task.input}")
            self.output = open(self.task.output, "w", encoding="utf-8")

            # run translation
            with open(self.task.input, "r", encoding="utf-8") as in_f:
                max_index = 0
                count = 0
                chunk: list[tuple[str, str]] = []
                current: str = ""
                total_size = self.task.input.stat().st_size

                while True:
                    # read line
                    line = in_f.readline()
                    if not line:
                        break

                    # decode
                    l = line.strip()
                    if l.isdigit():
                        max_index = int(l)
                    elif l == "":
                        pass
                    elif "-->" in l:
                        current = l
                    else:
                        rept = self._repeat(l)
                        if rept is not None:
                            l = rept * (1 if len(rept) > 8 else 8 // len(rept))
                        chunk.append((current, l))
                        count += len(l)

                    # translate
                    if count >= self.config.max_input:
                        await asyncio.to_thread(self._tran, chunk, max_index)
                        # reset
                        count = 0
                        chunk = []

                        # update progress
                        self.progress.progress = (in_f.tell() / total_size) * 100

                # translate the last block
                await asyncio.to_thread(self._tran, chunk, max_index)

        except Exception as e:
            self.output.close()
            self.task.output.unlink(missing_ok=True)
            raise e
        else:
            self.output.write("\n")
            self.output.close()
            self._success()

    def _tran(self, content: list[tuple[str, str]], max_index: int) -> None:
        tran = self.gen(
            f"The standard code of the input language is: {self.task.org_lang}, and the standard code of the output language is: {self.task.tran_lang}.\n"
            "Pay attention, do not translate this line, and do not include it in the output. The following is the content to be translated:\n"
            + "\n".join(line for _, line in content)
        )
        length = len(content)
        trans = tran.splitlines()

        for i in range(len(trans)):
            if trans[i].strip() == "</think>":
                trans = trans[i + 1 :]
                break

        for i in range(len(trans)):
            if OUTPUT_FLAG in trans[i].strip():
                i += 1
                while i < len(trans) and trans[i].strip() == "":
                    i += 1
                trans = trans[i:]
                break

        if len(trans) < length:
            raise ValueError(
                f"LLM translation result is shorter than input, some lines may be missing. Input length: {length}, Output length: {len(trans)}"
            )

        Lg.debug(f"LLM translation result: {tran}")
        for i, (time, text) in enumerate(content):
            self.output.write(f"{max_index - length + i + 1}\n")
            self.output.write(f"{time}\n")
            self.output.write(f"{trans[i]}\n\n")
            self.progress.log.append(f"{time} -> {trans[i]}")

    @staticmethod
    def _repeat(s: str) -> Optional[str]:
        """
        如果 s 由某个子串重复构成，返回最小重复子串；
        否则返回 None
        """
        if not s:
            return None

        t = (s + s)[1:-1]
        if s in t:
            # 找最小周期
            n = len(s)
            for i in range(1, n + 1):
                if n % i == 0:
                    unit = s[:i]
                    if unit * (n // i) == s:
                        Lg.debug(f"Found repeating unit: {unit} for string: {s}")
                        return unit
        return None

    def _success(self) -> None:
        db.execute(
            """
            INSERT INTO llm_completed (input, output, org_lang, tran_lang, finished_time)
            VALUES (?, ?, ?, ?, ?);
            """,
            str(self.task.input.resolve()),
            str(self.task.output.resolve()),
            self.task.org_lang,
            self.task.tran_lang,
            datetime.now(timezone.utc).isoformat(),
        )

    @staticmethod
    def insert(task: LLMTaskInfo) -> None:
        Lg.debug(f"Inserting LLM task: {task}")
        db.execute(
            """
            INSERT INTO llm_waiting (input, output, org_lang, tran_lang)
            VALUES (?, ?, ?, ?);
            """,
            str(task.input.resolve()),
            str(task.output.resolve()),
            task.org_lang,
            task.tran_lang,
        )

    @staticmethod
    def tran_from_taskinfo(task: TaskInfo) -> LLMTaskInfo:
        if task.args.subtitle is None or task.args.tran is None:
            raise ValueError("Subtitle or translation language is not set.")
        return LLMTaskInfo(
            input=task.output.with_suffix(f".{task.args.subtitle}.srt"),
            output=task.output.with_suffix(f".{task.args.tran}.srt"),
            org_lang=task.args.subtitle,
            tran_lang=task.args.tran,
        )
