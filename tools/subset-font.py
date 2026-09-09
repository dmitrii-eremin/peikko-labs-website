"""One-off. Subsets Patrick Hand to the scripts the site serves and writes WOFF2.

Vietnamese (U+1EA0-1EF9) is the bulk of the original file and is not needed, so the
subset keeps only Latin plus the punctuation the copy uses. Run manually; commit
static/fonts/patrick-hand.woff2.

    python tools/subset-font.py
"""

from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "static" / "fonts" / "PatrickHand-Regular.ttf"
DST = ROOT / "static" / "fonts" / "patrick-hand.woff2"

# Basic Latin + Latin-1 Supplement + Latin Extended-A (covers fi/es/de) + punctuation.
UNICODES = "U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2027,U+2030-205E,U+20AC,U+2122"


def main():
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.flavor = "woff2"
    opts.notdef_outline = True
    opts.name_IDs = ["*"]
    opts.name_legacy = True
    opts.name_languages = ["*"]

    font = subset.load_font(SRC, opts)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    subset.save_font(font, DST, opts)

    print(f"{SRC.stat().st_size:,} -> {DST.stat().st_size:,} bytes  {DST.name}")


if __name__ == "__main__":
    main()
