# Haiku: Sudoku fish practice

Static page in `docs/` that generates Sudoku puzzles whose first advanced step is a chosen fish (X-Wing, Swordfish, Jellyfish; basic, finned, sashimi, Franken, finned Franken, mutant, finned mutant) and exports them as a text file.

Enable GitHub Pages with source `docs/` on the branch you publish from.

## How it works

The generator and solver are HoDoKu 2.2.0 (https://hodoku.sourceforge.net/, GPLv3), compiled to WebAssembly GC with TeaVM. The page runs a pool of web workers that generate puzzles and keep those whose first fish step matches a selected type.

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
