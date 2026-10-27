import generator.*;
import solver.*;
import sudoku.*;
import java.util.*;

public class FishGen {
    static boolean fish(SolutionType t) {
        String n = t.name();
        return !n.contains("KRAKEN") && (n.endsWith("X_WING") || n.endsWith("SWORDFISH") || n.endsWith("JELLYFISH"));
    }
    static boolean easy(SolutionType t) {
        switch (t) {
            case FULL_HOUSE: case HIDDEN_SINGLE: case NAKED_SINGLE: case LOCKED_CANDIDATES: case LOCKED_CANDIDATES_1:
            case LOCKED_CANDIDATES_2: case LOCKED_PAIR: case LOCKED_TRIPLE: case NAKED_PAIR: case NAKED_TRIPLE:
            case HIDDEN_PAIR: case HIDDEN_TRIPLE:
                return true;
            default:
                return false;
        }
    }
    public static void main(String[] a) {
        int perType = Integer.parseInt(a[0]);
        long limitMs = Long.parseLong(a[1]) * 1000;
        Options opt = Options.getInstance();
        for (StepConfig sc : opt.solverSteps) {
            if (fish(sc.getType()) || easy(sc.getType())) sc.setEnabled(true);
            else sc.setEnabled(false);
        }
        SudokuGenerator gen = SudokuGeneratorFactory.getInstance();
        SudokuSolver solver = SudokuSolverFactory.getInstance();
        Map<SolutionType, Integer> counts = new TreeMap<>();
        long start = System.currentTimeMillis();
        int tried = 0;
        while (System.currentTimeMillis() - start < limitMs) {
            Sudoku2 puz = gen.generateSudoku(false);
            tried++;
            String clues = puz.getSudoku(ClipboardMode.CLUES_ONLY);
            Sudoku2 s = puz.clone();
            int guard = 0;
            while (guard++ < 400) {
                SolutionStep step = solver.getHint(s, false);
                if (step == null) break;
                SolutionType t = step.getType();
                if (fish(t)) {
                    int c = counts.getOrDefault(t, 0);
                    if (c < perType) {
                        counts.put(t, c + 1);
                        System.out.println("=== " + t.name() + " #" + (c + 1));
                        System.out.println("PUZZLE " + clues);
                        System.out.println("STEP " + step.toString(2));
                        System.out.println(s.getSudoku(ClipboardMode.PM_GRID));
                    }
                    break;
                }
                if (!easy(t)) break;
                solver.doStep(s, step);
            }
            boolean done = true;
            for (SolutionType t : SolutionType.values()) if (fish(t) && !t.name().startsWith("FRANKEN") && !t.name().contains("_FRANKEN") && counts.getOrDefault(t, 0) < perType) done = false;
            if (done) break;
        }
        System.err.println("tried=" + tried + " counts=" + counts);
    }
}
