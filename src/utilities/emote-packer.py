from argparse import ArgumentParser
from base64 import b64encode
from io import BytesIO
from json import dumps
from pathlib import Path
from sys import exit as just_exit

from PIL import Image

Formats = {
  "PNG": {"optimize": True},
  "WebP": {"lossless": True, "quality": 100, "exact": True, "save_all": True},
}


def _main(base: Path, name: str, image_format: str = "PNG") -> None:
  lists = [line for line in base.joinpath("list").read_text().split("\n") if line != ""]
  emoji_list = []
  _missing_images: list[str] = []
  for item in lists:
    filename, description = item.split(" ")
    target = base / filename
    if not target.is_file():
      _missing_images.append(filename)
      continue
    _image = Image.open(target)
    if _image.width != _image.height:
      message = f"{filename} ({description}) is not square ({_image.width}x{_image.height})"
      raise NotImplementedError(message)
    emoji_list.append(
      {
        "image": _image,
        "description": description,
      },
    )
  if len(_missing_images) > 0:
    print("\n".join(_missing_images))
    just_exit()

  final_emoji = []
  for emoji in emoji_list:
    buffer = BytesIO()
    emoji["image"].save(buffer, format=image_format, **Formats[image_format])
    final_emoji.append(
      {
        "name": emoji["description"],
        "image": b64encode(buffer.getvalue()).decode(),
      },
    )
  result = {
    "name": name,
    "emoji": final_emoji,
  }

  print(dumps(result, ensure_ascii=False, indent=None))


if __name__ == "__main__":
  parser = ArgumentParser()
  parser.add_argument("--base", required=True, type=Path, help="Base directory")
  parser.add_argument("--name", required=True, type=str, help="Name of the pack")
  parser.add_argument("--format", default="PNG", choices=Formats.keys(), type=str, help="Image format to use")
  config = parser.parse_args()
  _main(base=config.base, name=config.name, image_format=config.format)
