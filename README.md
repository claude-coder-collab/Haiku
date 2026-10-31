# Haiku: Sudoku fish practice

Static page in `docs/` that generates Sudoku puzzles whose first advanced step is a chosen fish (X-Wing, Swordfish, Jellyfish; basic, finned, sashimi, Franken, finned Franken, mutant, finned mutant), wing (XY-Wing, XYZ-Wing, W-Wing) or turbot fish (Skyscraper, 2-String Kite, Empty Rectangle, Turbot Fish) and exports them as a text file.

Live page: https://claude-coder-collab.github.io/Haiku/

`docs/hinter.html` is a hinter: paste a puzzle and it lists every step HoDoKu can find (not only the easiest), grouped by technique, with the pattern, eliminations and chains drawn on the board. Steps can be applied with undo/redo. Kraken fish, forcing chains and forcing nets are optional because they are slow.

## How it works

The generator and solver are HoDoKu 2.2.0 (https://hodoku.sourceforge.net/, GPLv3), compiled to WebAssembly GC with TeaVM. The page runs a pool of web workers that generate puzzles and keep those whose first fish, wing or turbot fish step matches a selected type.

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
