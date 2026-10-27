package shim;

public class Color {
    public static final Color BLACK = new Color(0, 0, 0);
    public static final Color WHITE = new Color(255, 255, 255);
    public static final Color LIGHT_GRAY = new Color(192, 192, 192);
    public static final Color RED = new Color(255, 0, 0);
    public static final Color BLUE = new Color(0, 0, 255);
    public static final Color black = BLACK;

    private final int rgb;

    public Color(int rgb) {
        this.rgb = rgb;
    }

    public Color(int r, int g, int b) {
        this(0xff000000 | (r << 16) | (g << 8) | b);
    }

    public int getRGB() {
        return rgb;
    }
}
