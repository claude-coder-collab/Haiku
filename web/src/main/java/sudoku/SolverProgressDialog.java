package sudoku;

import solver.SudokuSolver;

public class SolverProgressDialog {
    public SolverProgressDialog(Object parent, boolean modal, SudokuSolver solver) {
    }

    public Thread getThread() {
        return null;
    }

    public void setVisible(boolean visible) {
    }

    public boolean isVisible() {
        return false;
    }

    public boolean isSolved() {
        return false;
    }

    public void initializeProgressState(int max) {
    }

    public void setProgressState(int cells, int candidates) {
    }
}
