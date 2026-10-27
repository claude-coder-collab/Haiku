import generator.SudokuGenerator;
import org.teavm.jso.JSExport;
import solver.SudokuSolver;
import solver.SudokuSolverFactory;
import sudoku.ClipboardMode;
import sudoku.Options;
import sudoku.SolutionStep;
import sudoku.SolutionType;
import sudoku.StepConfig;
import sudoku.Sudoku2;

public class WebEntry {
    private static SudokuGenerator generator;
    private static SudokuSolver solver;

    private static boolean isFish(SolutionType t) {
        String n = t.name();
        return !n.contains("KRAKEN") && (n.endsWith("X_WING") || n.endsWith("SWORDFISH") || n.endsWith("JELLYFISH"));
    }

    private static boolean isEasy(SolutionType t) {
        switch (t) {
            case FULL_HOUSE:
            case HIDDEN_SINGLE:
            case NAKED_SINGLE:
            case LOCKED_CANDIDATES:
            case LOCKED_CANDIDATES_1:
            case LOCKED_CANDIDATES_2:
            case LOCKED_PAIR:
            case LOCKED_TRIPLE:
            case NAKED_PAIR:
            case NAKED_TRIPLE:
            case HIDDEN_PAIR:
            case HIDDEN_TRIPLE:
                return true;
            default:
                return false;
        }
    }

    @JSExport
    public static String generateOne() {
        if (generator == null) {
            init();
        }
        Sudoku2 puzzle = generator.generateSudoku(false);
        String clues = puzzle.getSudoku(ClipboardMode.CLUES_ONLY);
        Sudoku2 s = puzzle.clone();
        for (int guard = 0; guard < 400; guard++) {
            SolutionStep step = solver.getHint(s, false);
            if (step == null) {
                return "";
            }
            SolutionType t = step.getType();
            if (isFish(t)) {
                return t.name() + "\t" + clues + "\t" + step.toString(2);
            }
            if (!isEasy(t)) {
                return "";
            }
            solver.doStep(s, step);
        }
        return "";
    }

    private static void init() {
        Options opt = Options.getInstance();
        for (StepConfig sc : opt.solverSteps) {
            sc.setEnabled(isFish(sc.getType()) || isEasy(sc.getType()));
        }
        generator = new SudokuGenerator();
        solver = SudokuSolverFactory.getInstance();
    }

    public static void main(String[] args) {
    }
}
