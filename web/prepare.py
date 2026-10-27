import glob
import os
import re
import shutil
import sys

SRC = sys.argv[1]
OUT = sys.argv[2]
HERE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join(OUT, "java")


def read(path):
    with open(path, encoding="utf-8", newline="") as f:
        return f.read().replace("\r\n", "\n")


def write(path, text):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def del_method(s, sig):
    i = s.index(sig)
    start = s.rfind("\n", 0, i) + 1
    while True:
        prev = s.rfind("\n", 0, start - 1) + 1
        line = s[prev:start].strip()
        if line.startswith(("@", "*", "/**", "//")):
            start = prev
            if line.startswith("/**"):
                break
        else:
            break
    j = s.index("{", i)
    depth = 0
    k = j
    while True:
        c = s[k]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                break
        k += 1
    return s[:start] + s[k + 1:].lstrip("\n")


def edit(rel, fn):
    p = os.path.join(JAVA, rel)
    s = read(p)
    s2 = fn(s)
    assert s2 != s, rel
    write(p, s2)


def load_bundle(name):
    d = {}
    cur = ""
    with open(os.path.join(SRC, "intl", name + ".properties"), encoding="latin-1") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if cur:
                line = cur + line.lstrip()
                cur = ""
            if line.strip() == "" or line.lstrip().startswith(("#", "!")):
                continue
            if line.endswith("\\") and not line.endswith("\\\\"):
                cur = line[:-1]
                continue
            m = re.match(r"\s*((?:\\.|[^=:\s\\])+)\s*[=:\s]\s*(.*)$", line)
            if not m:
                continue
            d[unescape(m.group(1))] = unescape(m.group(2))
    return d


def unescape(x):
    out = ""
    i = 0
    while i < len(x):
        c = x[i]
        if c == "\\" and i + 1 < len(x):
            n = x[i + 1]
            if n == "u":
                out += chr(int(x[i + 2:i + 6], 16))
                i += 6
                continue
            out += {"n": "\n", "t": "\t", "r": "\r"}.get(n, n)
            i += 2
            continue
        out += c
        i += 1
    return out


def java_literal(s):
    o = '"'
    for c in s:
        if c == '"':
            o += '\\"'
        elif c == "\\":
            o += "\\\\"
        elif c == "\n":
            o += "\\n"
        elif c == "\t":
            o += "\\t"
        elif c == "\r":
            o += "\\r"
        elif ord(c) > 126 or ord(c) < 32:
            o += "\\u%04x" % ord(c)
        else:
            o += c
    return o + '"'


if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(JAVA)


for pkg in ("generator", "solver", "sudoku"):
    shutil.copytree(os.path.join(SRC, pkg), os.path.join(JAVA, pkg), ignore=shutil.ignore_patterns("*.form"))

KEEP_AWT = {"sudoku/Options.java", "sudoku/DifficultyLevel.java", "sudoku/SudokuUtil.java"}
for f in glob.glob(JAVA + "/*/*.java"):
    rel = os.path.relpath(f, JAVA).replace(os.sep, "/")
    if rel in KEEP_AWT:
        continue
    if re.search(r"java\.awt|javax\.swing", read(f)):
        os.remove(f)
for rel in ("sudoku/GuiState.java", "sudoku/RegressionTester.java", "generator/BackgroundGeneratorThread.java"):
    os.remove(os.path.join(JAVA, rel))

for sub in ("shim", "sudoku"):
    os.makedirs(os.path.join(JAVA, sub), exist_ok=True)
    for f in glob.glob(os.path.join(HERE, "overlay", sub, "*.java")):
        shutil.copy(f, os.path.join(JAVA, sub))
shutil.copy(os.path.join(HERE, "overlay", "root", "WebEntry.java"), JAVA)


def options(s):
    s = s.replace("import java.awt.Color;", "import shim.Color;").replace("import java.awt.Font;", "import shim.Font;")
    for imp in ("java.awt.GraphicsEnvironment", "java.beans.XMLDecoder", "java.beans.XMLEncoder", "generator.BackgroundGeneratorThread"):
        s = s.replace("import " + imp + ";\n", "")
    s = s.replace("            BackgroundGeneratorThread.getInstance().resetAll();\n", "")
    s = re.sub(r"public void writeOptions\(String fileName\) throws FileNotFoundException \{.*?\n    \}\n",
               "public void writeOptions(String fileName) throws FileNotFoundException {\n    }\n", s, count=1, flags=re.S)
    s = re.sub(r"public static void readOptions\(String fileName\) \{\n.*?\n        // readObject\(\) passt",
               "public static void readOptions(String fileName) {\n        instance = new Options();\n        // readObject() passt", s, count=1, flags=re.S)
    s = s.replace("availableFontNames = GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames();",
                  "availableFontNames = new String[0];")
    return del_method(s, "public static void main(String[] args)")


edit("sudoku/Options.java", options)
edit("sudoku/DifficultyLevel.java", lambda s: s.replace("import java.awt.Color;", "import shim.Color;"))
edit("sudoku/Sudoku2.java", lambda s: re.sub(
    r"(private static void initTemplates\(\) \{\n).*?(\n//        //Sudoku2 sudoku)",
    r"\1        templates = new SudokuSetBase[0];\2", s, count=1, flags=re.S))
edit("generator/SudokuGenerator.java", lambda s: s.replace("    protected SudokuGenerator() {", "    public SudokuGenerator() {"))
edit("generator/SudokuGeneratorFactory.java", lambda s: s.replace("    static {\n        thread.start();\n    }\n", ""))


def util(s):
    for sig in ("public static PrinterJob getPrinterJob()", "public static PageFormat getPageFormat()",
                "public static double adjustGraphicsForPrinting(", "public static void setLookAndFeel()",
                "public static void printFontDefaults()", "public static void main(String[] args)"):
        s = del_method(s, sig)
    s = re.sub(r"import (java\.awt|javax\.swing)[^\n]*\n", "", s)
    return re.sub(r"\n\s*private static (PrinterJob|PageFormat) \w+;", "", s)


edit("sudoku/SudokuUtil.java", util)


def solver(s):
    s = del_method(s, "public void getState(GuiState state, boolean copy)")
    s = del_method(s, "public void setState(GuiState state)")
    return s.replace("import sudoku.GuiState;\n", "")


edit("solver/SudokuSolver.java", solver)

bundles = {}
pat = re.compile(r'(?:java\.util\.)?ResourceBundle\.getBundle\("intl/(\w+)"\)\.getString\("([^"]*)"\)')


def bundle_sub(m):
    b, k = m.group(1), m.group(2)
    if b not in bundles:
        bundles[b] = load_bundle(b)
    return java_literal(bundles[b][k])


log_pat = re.compile(r"^[ \t]*Logger\.getLogger\([^;]*?\)\s*\.log\(Level\.(?:FINER|FINEST|FINE|INFO|CONFIG)\b[^;]*?\);\n", re.S | re.M)
for f in glob.glob(JAVA + "/*/*.java"):
    s = read(f)
    s2 = log_pat.sub("", pat.sub(bundle_sub, s))
    if s2 != s:
        write(f, s2)
