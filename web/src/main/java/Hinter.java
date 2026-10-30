import java.util.List;
import solver.SudokuSolver;
import solver.SudokuSolverFactory;
import solver.SudokuStepFinder;
import sudoku.AlsInSolutionStep;
import sudoku.Candidate;
import sudoku.Chain;
import sudoku.Entity;
import sudoku.Options;
import sudoku.SolutionStep;
import sudoku.SolutionType;
import sudoku.StepConfig;
import sudoku.Sudoku2;

public class Hinter {
    public static final int PHASES = 27;

    private static SudokuStepFinder finder;
    private static boolean ready;

    private static void init() {
        if (ready) {
            return;
        }
        ready = true;
        Options opt = Options.getInstance();
        for (StepConfig sc : opt.solverSteps) {
            sc.setAllStepsEnabled(true);
        }
        finder = SudokuSolverFactory.getDefaultSolverInstance().getStepFinder();
    }

    private static boolean enabled(SolutionType type) {
        Options opt = Options.getInstance();
        for (StepConfig sc : opt.solverSteps) {
            if (sc.getType() == type) {
                return sc.isAllStepsEnabled();
            }
        }
        return false;
    }

    private static void filter(List<SolutionStep> steps) {
        for (int i = 0; i < steps.size(); i++) {
            if (!enabled(steps.get(i).getType())) {
                steps.remove(i);
                i--;
            }
        }
    }

    private static Sudoku2 make(String values, String masks) {
        Sudoku2 s = new Sudoku2();
        s.setSudoku(values);
        String[] m = masks.split(",");
        for (int i = 0; i < 81; i++) {
            if (s.getValue(i) != 0) {
                continue;
            }
            int mask = Integer.parseInt(m[i]);
            for (int c = 1; c <= 9; c++) {
                if ((mask & (1 << (c - 1))) == 0 && s.isCandidate(i, c)) {
                    s.delCandidate(i, c);
                }
            }
        }
        s.rebuildInternalData();
        return s;
    }

    private static List<SolutionStep> phase(Sudoku2 sudoku, int phase, boolean heavy) {
        Options opt = Options.getInstance();
        java.util.ArrayList<SolutionStep> steps = new java.util.ArrayList<SolutionStep>();
        List<SolutionStep> found;
        switch (phase) {
            case 0:
                steps.addAll(finder.findAllFullHouses(sudoku));
                steps.addAll(finder.findAllHiddenXle(sudoku));
                steps.addAll(finder.findAllNakedXle(sudoku));
                filter(steps);
                steps.addAll(finder.findAllLockedCandidates(sudoku));
                steps.addAll(finder.findAllSkyScrapers(sudoku));
                steps.addAll(finder.findAllEmptyRectangles(sudoku));
                steps.addAll(finder.findAllTwoStringKites(sudoku));
                steps.addAll(finder.getAllSueDeCoqs(sudoku));
                break;
            case 1: case 2: case 3: case 4: case 5: case 6: case 7: case 8: case 9:
                steps.addAll(finder.getAllFishes(sudoku, opt.getAllStepsMinFishSize(), opt.getAllStepsMaxFishSize(),
                        opt.getAllStepsMaxFins(), opt.getAllStepsMaxEndoFins(), null, phase, opt.getAllStepsMaxFishType()));
                break;
            case 10: case 11: case 12: case 13: case 14: case 15: case 16: case 17: case 18:
                if (heavy) {
                    steps.addAll(finder.getAllKrakenFishes(sudoku, opt.getAllStepsKrakenMinFishSize(),
                            opt.getAllStepsKrakenMaxFishSize(), opt.getAllStepsMaxKrakenFins(),
                            opt.getAllStepsMaxKrakenEndoFins(), null, phase - 9, opt.getAllStepsKrakenMaxFishType()));
                }
                break;
            case 19:
                found = finder.getAllUniqueness(sudoku);
                filter(found);
                steps.addAll(found);
                finder.setSudoku(sudoku);
                SolutionStep bug = finder.getStep(SolutionType.BUG_PLUS_1);
                if (bug != null) {
                    steps.add(bug);
                }
                found = finder.getAllWings(sudoku);
                filter(found);
                steps.addAll(found);
                steps.addAll(finder.findAllSimpleColors(sudoku));
                steps.addAll(finder.findAllMultiColors(sudoku));
                break;
            case 20:
                found = finder.getAllChains(sudoku);
                filter(found);
                steps.addAll(found);
                break;
            case 21:
                steps.addAll(finder.getAllNiceLoops(sudoku));
                break;
            case 22:
                steps.addAll(finder.getAllGroupedNiceLoops(sudoku));
                break;
            case 23:
                found = finder.getAllTemplates(sudoku);
                filter(found);
                steps.addAll(found);
                break;
            case 24:
                found = finder.getAllAlses(sudoku, true, true, true);
                filter(found);
                steps.addAll(found);
                found = finder.getAllDeathBlossoms(sudoku);
                filter(found);
                steps.addAll(found);
                break;
            case 25:
                if (heavy) {
                    steps.addAll(finder.getAllForcingChains(sudoku));
                }
                break;
            case 26:
                if (heavy) {
                    steps.addAll(finder.getAllForcingNets(sudoku));
                }
                break;
            default:
                break;
        }
        return steps;
    }

    public static String rate(String values) {
        init();
        try {
            Sudoku2 s = new Sudoku2();
            s.setSudoku(values);
            SudokuSolver solver = SudokuSolverFactory.getInstance();
            solver.setSudoku(s);
            boolean solved = solver.solve();
            java.util.LinkedHashMap<String, Integer> counts = new java.util.LinkedHashMap<String, Integer>();
            for (SolutionStep st : solver.getSteps()) {
                String n = st.getStepName();
                Integer c = counts.get(n);
                counts.put(n, c == null ? 1 : c + 1);
            }
            StringBuilder out = new StringBuilder("{\"solved\":").append(solved);
            out.append(",\"level\":").append(quote(solver.getLevelString()));
            out.append(",\"score\":").append(solver.getScore());
            out.append(",\"steps\":[");
            boolean first = true;
            for (java.util.Map.Entry<String, Integer> e : counts.entrySet()) {
                if (!first) {
                    out.append(',');
                }
                first = false;
                out.append('[').append(quote(e.getKey())).append(',').append(e.getValue()).append(']');
            }
            return out.append("]}").toString();
        } catch (RuntimeException e) {
            return "{\"error\":" + quote(String.valueOf(e)) + "}";
        }
    }

    public static String findPhase(String values, String masks, int phase, boolean heavy) {
        init();
        StringBuilder out = new StringBuilder();
        try {
            Sudoku2 sudoku = make(values, masks);
            List<SolutionStep> steps = phase(sudoku, phase, heavy);
            out.append('[');
            for (int i = 0; i < steps.size(); i++) {
                if (i > 0) {
                    out.append(',');
                }
                step(out, steps.get(i));
            }
            out.append(']');
        } catch (RuntimeException e) {
            return "{\"error\":" + quote(String.valueOf(e)) + "}";
        }
        return out.toString();
    }

    private static String quote(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') {
                b.append('\\').append(c);
            } else if (c == '\n') {
                b.append("\\n");
            } else if (c < 32) {
                b.append(' ');
            } else {
                b.append(c);
            }
        }
        return b.append('"').toString();
    }

    private static void ints(StringBuilder out, List<Integer> list) {
        out.append('[');
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(list.get(i));
        }
        out.append(']');
    }

    private static void cands(StringBuilder out, List<Candidate> list) {
        out.append('[');
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append('[').append(list.get(i).getIndex()).append(',').append(list.get(i).getValue()).append(']');
        }
        out.append(']');
    }

    private static void entities(StringBuilder out, List<Entity> list) {
        out.append('[');
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append('[').append(list.get(i).getEntityName()).append(',').append(list.get(i).getEntityNumber()).append(']');
        }
        out.append(']');
    }

    private static void step(StringBuilder out, SolutionStep st) {
        SolutionType t = st.getType();
        out.append("{\"type\":").append(quote(t.name()));
        out.append(",\"name\":").append(quote(st.getStepName()));
        out.append(",\"text\":").append(quote(st.toString(2)));
        out.append(",\"single\":").append(t.isSingle());
        StepConfig sc = t.getStepConfig();
        out.append(",\"cat\":").append(quote(sc == null ? "" : sc.getCategoryName()));
        out.append(",\"score\":").append(sc == null ? 0 : sc.getBaseScore());
        out.append(",\"idx\":");
        ints(out, st.getIndices());
        out.append(",\"vals\":");
        ints(out, st.getValues());
        out.append(",\"del\":");
        cands(out, st.getCandidatesToDelete());
        out.append(",\"fins\":");
        cands(out, st.getFins());
        out.append(",\"endo\":");
        cands(out, st.getEndoFins());
        out.append(",\"cann\":");
        cands(out, st.getCannibalistic());
        out.append(",\"base\":");
        entities(out, st.getBaseEntities());
        out.append(",\"cover\":");
        entities(out, st.getCoverEntities());
        out.append(",\"chains\":[");
        List<Chain> chains = st.getChains();
        for (int i = 0; i < chains.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            Chain ch = chains.get(i);
            int[] arr = ch.getChain();
            out.append('[');
            for (int j = ch.getStart(); j <= ch.getEnd(); j++) {
                if (j > ch.getStart()) {
                    out.append(',');
                }
                int e = arr[j];
                out.append("{\"c\":[").append(Chain.getSCellIndex(e));
                if (Chain.getSNodeType(e) == Chain.GROUP_NODE) {
                    out.append(',').append(Chain.getSCellIndex2(e));
                    int third = Chain.getSCellIndex3(e);
                    if (third != 127 && third >= 0 && third < 81) {
                        out.append(',').append(third);
                    }
                }
                out.append("],\"d\":").append(Chain.getSCandidate(e));
                out.append(",\"s\":").append(Chain.isSStrong(e));
                out.append(",\"t\":").append(Chain.getSNodeType(e));
                if (Chain.getSNodeType(e) == Chain.ALS_NODE) {
                    out.append(",\"als\":").append(Chain.getSAlsIndex(e));
                }
                out.append('}');
            }
            out.append(']');
        }
        out.append("],\"alses\":[");
        List<AlsInSolutionStep> alses = st.getAlses();
        for (int i = 0; i < alses.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append("{\"i\":");
            ints(out, alses.get(i).getIndices());
            out.append(",\"c\":");
            ints(out, alses.get(i).getCandidates());
            out.append('}');
        }
        out.append("],\"colors\":[");
        boolean first = true;
        for (java.util.Map.Entry<Integer, Integer> e : st.getColorCandidates().entrySet()) {
            if (!first) {
                out.append(',');
            }
            first = false;
            out.append('[').append(e.getKey()).append(',').append(e.getValue()).append(']');
        }
        out.append("]}");
    }
}
