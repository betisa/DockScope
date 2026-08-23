# Application Icon

DockScope uses one project-native visual identity for the executable, installer, shortcuts, application window, and System Tray.

## Source and generated assets

```text
build/
├── icon.svg            # editable source
├── icon.png            # 1024 × 1024 runtime/packaging PNG
├── icon.ico            # multi-resolution Windows executable/installer icon
├── icon-tray.png       # 32 × 32 Tray icon
└── icon-tray@2x.png    # 64 × 64 high-DPI Tray source

assets/
├── app-icon.svg
└── app-icon.png
```

## Visual language

The icon intentionally uses a unique DockScope motif rather than copying the Docker trademark:

- dark navy developer-tool tile;
- three stacked storage/runtime blocks;
- blue operational layers;
- green live/healthy status indicator.

This aligns with the application's dashboard and README visual system.

## Windows integration

`package.json` configures:

- `build.win.icon`
- NSIS installer icon
- NSIS uninstaller icon
- installer header icon
- desktop shortcut
- Start Menu shortcut

Electron Main configures:

- `BrowserWindow.icon`
- System Tray image
- packaged `extraResources` for runtime PNGs
- stable Windows `AppUserModelID`

The installed EXE, taskbar identity, Start Menu shortcut, desktop shortcut, installer/uninstaller, and Tray therefore share the same product identity.

## Updating the icon

If `build/icon.svg` changes, regenerate:

- `icon.png`
- `icon.ico`
- `icon-tray.png`
- `icon-tray@2x.png`

The Windows ICO should include common sizes from 16 px through 256 px.
