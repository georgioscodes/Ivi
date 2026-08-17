package com.ivi.app.desktop;

import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JWindow;
import javax.swing.SwingUtilities;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.WindowEvent;

/**
 * Something to look at while the database and the application start.
 *
 * <p>First launch takes appreciably longer than later ones — PostgreSQL has to initialise its
 * data directory before Flyway can run. Ten silent seconds after a double click reads as a
 * program that failed to open, and the practitioner's next move is to double click again.
 */
final class Splash extends JWindow {

    private final JLabel statusLabel;

    private Splash() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBackground(Theme.SAND);
        panel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(Theme.TAUPE, 2),
            BorderFactory.createEmptyBorder(28, 40, 28, 40)));

        JLabel title = new JLabel("Ivi");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 30f));
        title.setForeground(Theme.INK);
        title.setAlignmentX(CENTER_ALIGNMENT);

        statusLabel = new JLabel("Starting…");
        statusLabel.setForeground(Theme.INK);
        statusLabel.setAlignmentX(CENTER_ALIGNMENT);
        statusLabel.setBorder(BorderFactory.createEmptyBorder(12, 0, 0, 0));

        panel.add(title);
        panel.add(statusLabel);
        add(panel);
        pack();
        setLocationRelativeTo(null);
    }

    /** Named for what it does rather than {@code show()}, which {@link java.awt.Window} owns. */
    static Splash display() {
        Splash splash = new Splash();
        SwingUtilities.invokeLater(() -> splash.setVisible(true));
        return splash;
    }

    void status(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setText(message);
            pack();
        });
    }

    void close() {
        SwingUtilities.invokeLater(() -> {
            setVisible(false);
            dispatchEvent(new WindowEvent(this, WindowEvent.WINDOW_CLOSING));
            dispose();
        });
    }

    /** Brand colours, from docs/ui-palette.md. Surfaces only, always with dark ink on top. */
    static final class Theme {
        static final Color TAUPE = new Color(0xa1, 0x82, 0x76);
        static final Color SAND = new Color(0xda, 0xc6, 0xb5);
        static final Color SAGE = new Color(0xb9, 0xd2, 0xb1);
        static final Color INK = new Color(0x2b, 0x23, 0x20);

        private Theme() {
        }
    }
}
