# Hodoku Web: the HoDoKu Helper online.

Paste a puzzle and the hinter lists the steps HoDoKu finds, grouped by technique. Each step shows its pattern, eliminations and chains drawn on the board. Apply steps one at a time or a whole group at once (for example all Singles), with undo and redo.

Live page: https://claude-coder-collab.github.io/Hodoku-Web/

## Hinter

- Finds all available steps, with the technique named and explained.
- Draws patterns, eliminations and chains on the board.
- Filter steps by technique group; apply any step, or apply all in a group.
- Undo and redo.
- Kraken fish, forcing chains and forcing nets are optional because they are slow.

## Generator

The second page, https://claude-coder-collab.github.io/Hodoku-Web/generator.html, generates puzzles whose first advanced step is the chosen technique (X-Wing, Swordfish, Jellyfish; basic, finned, sashimi, etc.), wing (XY-Wing, XYZ-Wing, W-Wing) or turbot fish (Skyscraper, 2-String Kite, etc.), and exports them as a text file.

## How it works

The solver and generator are HoDoKu 2.2.0 (https://hodoku.sourceforge.net/, GPLv3), compiled to WebAssembly GC with TeaVM. Web workers run the hinter and the generator.

## Rebuilding

```
curl -L -o hodoku-src.zip "https://sourceforge.net/projects/hodoku/files/hodoku/hodoku_2.2.0/hodoku-2-2-0-src.zip/download"
unzip hodoku-src.zip -d hodoku-src
python3 web/prepare.py hodoku-src/HoDoKu/src web/src/main
cd web && mvn package
cp target/js/fishgen.wasm ../docs/
```

`web/prepare.py` strips the Swing GUI and file-based options from the upstream sources, inlines the English resource strings and adds `web/overlay`. The prepared sources are committed under `web/src/main/java`.

`docs/wasm-gc-runtime.js` is the TeaVM runtime from `org/teavm/backend/wasm/wasm-gc-runtime.min.js` in `teavm-core`.

`FishGen.java` is the original command-line harness used to build `fish_puzzles.txt`.
