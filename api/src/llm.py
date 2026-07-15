import asyncio
from io import TextIOWrapper
from typing import Callable
from datetime import datetime, timezone

from src.models import (
    ApiRunning,
    TranslatorSettings,
    LLMTaskInfo,
    TaskInfo,
)
from src.logger import Lg
from src.database import Database as db
from routes.settings import SettingsManager

OUTPUT_FLAG = "Singal: yyytttqqq."


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
        msg_fit = self.tokenizer.apply_chat_template(
            msg,
            tokenize=False,
            enable_thinking=False,
            add_generation_prompt=True,
        )
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
                        if count + len(l) >= self.config.max_input:
                            await asyncio.to_thread(self._tran, chunk, max_index - 1)
                            count = len(l)
                            chunk = [(current, l)]
                            self.progress.progress = (in_f.tell() / total_size) * 100
                        else:
                            chunk.append((current, l))
                            count += len(l)

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
        length = len(content)

        # Block translation
        trans = self._decoder("\n".join(text for _, text in content))

        if len(trans) < length:
            Lg.debug(
                f"LLM block translation result is less than expected: {len(trans)} < {length}. Returning to line-by-line translation."
            )

        for i, text in enumerate(content):
            if len(trans) >= length and trans[i] != text[1]:
                translation = trans[i]
            else:
                line_trans = self._decoder(text[1])
                if len(line_trans) > 0:
                    translation = line_trans[0]
                else:
                    translation = "<missing translation>"

            self.output.write(f"{max_index - length + i + 1}\n")
            self.output.write(f"{text[0]}\n")
            self.output.write(f"{translation}\n\n")
            self.progress.log.append(f"{text[0]} -> {translation}")

    def _decoder(self, prompt: str) -> list[str]:
        PROMPT = f"The standard code of the input language is: {self.task.org_lang}, and the standard code of the output language is: {self.task.tran_lang}.\n"
        PROMPT += "The following is the content to be translated:\n"

        trans: list[str] = []
        for _ in range(SettingsManager._general.retry):
            tran = self.gen(PROMPT + prompt)
            trans = tran.splitlines()

            # Remove any lines before the first occurrence of OUTPUT_FLAG
            for i in range(len(trans)):
                if OUTPUT_FLAG in trans[i].strip():
                    i += 1
                    while i < len(trans) and trans[i].strip() == "":
                        i += 1
                    trans = trans[i:]
                    break

            if len(trans) == 0:
                Lg.debug(
                    f"LLM Prompt and Output:\n{PROMPT + prompt}\n\n----------\n\n{tran}\n\n"
                )
            else:
                break

        return trans

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
