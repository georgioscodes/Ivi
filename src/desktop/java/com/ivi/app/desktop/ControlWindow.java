package com.ivi.app.desktop;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import javax.swing.WindowConstants;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Image;
import java.awt.SystemTray;
import java.awt.TrayIcon;
import java.awt.PopupMenu;
import java.awt.MenuItem;
import java.awt.image.BufferedImage;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.net.URI;

/**
 * The window that stands in for everything a desktop application normally has — a way back into
 * the app, a way to start over, and a way to stop.
 *
 * <p>Closing the browser tab does not stop the server, and there is no terminal to press Ctrl-C
 * in, so without this the practitioner has a Java process they cannot see and cannot end.
 */
final class ControlWindow {

    private ControlWindow() {
    }

    static void show(URI address, Runnable resetDemoData, Runnable quit) {
        SwingUtilities.invokeLater(() -> {
            JFrame frame = new JFrame("Ivi");
            frame.setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
            frame.setIconImage(icon(64));

            JPanel panel = new JPanel();
            panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
            panel.setBackground(Splash.Theme.SAND);
            panel.setBorder(BorderFactory.createEmptyBorder(20, 24, 20, 24));

            panel.add(heading("Ivi is running"));
            panel.add(body("Ivi has opened in your web browser."));
            panel.add(body(address.toString()));
            panel.add(Box.createVerticalStrut(16));

            JButton open = button("Open Ivi");
            open.addActionListener(e -> DesktopLauncher.openBrowser(address));

            JButton reset = button("Reset demo data");
            reset.addActionListener(e -> {
                int choice = JOptionPane.showConfirmDialog(frame,
                    """
                    This puts the demo clients back the way they started.

                    Anything you have added or changed yourself will be deleted.""",
                    "Reset demo data", JOptionPane.OK_CANCEL_OPTION, JOptionPane.WARNING_MESSAGE);
                if (choice != JOptionPane.OK_OPTION) {
                    return;
                }
                try {
                    resetDemoData.run();
                    JOptionPane.showMessageDialog(frame,
                        "The demo data has been restored.\nRefresh your browser to see it.",
                        "Reset demo data", JOptionPane.INFORMATION_MESSAGE);
                } catch (RuntimeException failure) {
                    showError(frame, "The demo data could not be reset.", failure);
                }
            });

            JButton stop = button("Quit Ivi");
            stop.addActionListener(e -> {
                if (confirmQuit(frame)) {
                    quit.run();
                }
            });

            panel.add(open);
            panel.add(Box.createVerticalStrut(8));
            panel.add(reset);
            panel.add(Box.createVerticalStrut(8));
            panel.add(stop);
            panel.add(Box.createVerticalStrut(16));

            panel.add(note("Preview build. The clients in it are made up —"));
            panel.add(note("please do not enter real client records."));

            frame.addWindowListener(new java.awt.event.WindowAdapter() {
                @Override
                public void windowClosing(java.awt.event.WindowEvent e) {
                    if (confirmQuit(frame)) {
                        quit.run();
                    }
                }
            });

            frame.setContentPane(panel);
            frame.pack();
            frame.setResizable(false);
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);

            installTrayIcon(address, frame);
        });
    }

    private static boolean confirmQuit(JFrame frame) {
        return JOptionPane.showConfirmDialog(frame,
            "Stop Ivi? The page in your browser will stop working.\n\nYour data is kept for next time.",
            "Quit Ivi", JOptionPane.OK_CANCEL_OPTION, JOptionPane.QUESTION_MESSAGE)
            == JOptionPane.OK_OPTION;
    }

    /**
     * A tray icon in addition to the window, so a minimised window is still recoverable. Best
     * effort — where the desktop environment has no tray, the window alone is enough.
     */
    private static void installTrayIcon(URI address, JFrame frame) {
        if (!SystemTray.isSupported()) {
            return;
        }
        try {
            PopupMenu menu = new PopupMenu();

            MenuItem open = new MenuItem("Open Ivi");
            open.addActionListener(e -> DesktopLauncher.openBrowser(address));
            menu.add(open);

            MenuItem show = new MenuItem("Show the Ivi window");
            show.addActionListener(e -> {
                frame.setVisible(true);
                frame.toFront();
            });
            menu.add(show);

            TrayIcon trayIcon = new TrayIcon(icon(16), "Ivi", menu);
            trayIcon.setImageAutoSize(true);
            trayIcon.addActionListener(e -> DesktopLauncher.openBrowser(address));
            SystemTray.getSystemTray().add(trayIcon);
        } catch (Exception ignored) {
            // The window is the supported path; the tray is a convenience.
        }
    }

    /**
     * Drawn rather than loaded: the only icon in the repository is an SVG, which ImageIO cannot
     * read, and a bitmap committed alongside it would be a second thing to keep in step.
     */
    private static Image icon(int size) {
        BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Splash.Theme.TAUPE);
        g.fillRoundRect(0, 0, size, size, size / 4, size / 4);
        g.setColor(Splash.Theme.INK);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, (int) (size * 0.68)));
        String letter = "i";
        int x = (size - g.getFontMetrics().stringWidth(letter)) / 2;
        int y = (size - g.getFontMetrics().getHeight()) / 2 + g.getFontMetrics().getAscent();
        g.drawString(letter, x, y);
        g.dispose();
        return image;
    }

    static void reportBrowserFailure(URI address) {
        SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(null,
            "Ivi is running, but your browser could not be opened automatically.\n\n"
                + "Please open this address yourself:\n" + address,
            "Ivi", JOptionPane.INFORMATION_MESSAGE));
    }

    /**
     * Last resort for a startup failure. There is no console attached to a double-clicked
     * application, so a stack trace printed to stderr goes nowhere at all.
     */
    static void showFatalError(Throwable error) {
        try {
            SwingUtilities.invokeAndWait(() -> showError(null, "Ivi could not start.", error));
        } catch (Exception ignored) {
            error.printStackTrace();
        }
    }

    private static void showError(Component parent, String message, Throwable error) {
        StringWriter detail = new StringWriter();
        error.printStackTrace(new PrintWriter(detail));

        JTextArea trace = new JTextArea(detail.toString(), 14, 72);
        trace.setEditable(false);
        trace.setFont(new Font(Font.MONOSPACED, Font.PLAIN, 11));

        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.add(new JLabel(message));
        panel.add(new JLabel("Please send this to whoever gave you the application:"));
        panel.add(Box.createVerticalStrut(8));
        panel.add(new JScrollPane(trace));

        JOptionPane.showMessageDialog(parent, panel, "Ivi", JOptionPane.ERROR_MESSAGE);
    }

    // --- small builders ----------------------------------------------------------------------

    private static JLabel heading(String text) {
        JLabel label = new JLabel(text);
        label.setFont(label.getFont().deriveFont(Font.BOLD, 18f));
        label.setForeground(Splash.Theme.INK);
        label.setAlignmentX(Component.CENTER_ALIGNMENT);
        return label;
    }

    private static JLabel body(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(Splash.Theme.INK);
        label.setAlignmentX(Component.CENTER_ALIGNMENT);
        label.setBorder(BorderFactory.createEmptyBorder(6, 0, 0, 0));
        return label;
    }

    private static JLabel note(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(Splash.Theme.INK);
        label.setFont(label.getFont().deriveFont(Font.ITALIC, 11f));
        label.setAlignmentX(Component.CENTER_ALIGNMENT);
        return label;
    }

    private static JButton button(String text) {
        JButton button = new JButton(text);
        button.setAlignmentX(Component.CENTER_ALIGNMENT);
        button.setMaximumSize(new Dimension(Integer.MAX_VALUE, 34));
        button.setPreferredSize(new Dimension(260, 34));
        return button;
    }
}
