#!/bin/bash
# Alfred PC Bridge — Instalador para Mac
# Uso: curl -fsSL https://alfred-frontend-vercel.vercel.app/install-mac.sh | bash -s -- TOKEN_AQUI

set -e

TOKEN="${1:-}"
if [ -z "$TOKEN" ]; then
  echo "Error: Debes proporcionar tu token"
  echo "Uso: curl -fsSL https://URL/install-mac.sh | bash -s -- TU_TOKEN"
  exit 1
fi

INSTALL_DIR="$HOME/.alfred-bridge"
PLIST="$HOME/Library/LaunchAgents/com.alfred.bridge.plist"

echo "🤖 Instalando Alfred PC Bridge..."

# Create directory
mkdir -p "$INSTALL_DIR"

# Download bridge script
curl -fsSL "https://alfred-frontend-vercel.vercel.app/alfred-bridge.py" -o "$INSTALL_DIR/alfred-bridge.py"

# Install Python dependencies
echo "📦 Instalando dependencias..."
pip3 install --user playwright websockets 2>/dev/null || python3 -m pip install --user playwright websockets
python3 -m playwright install chromium 2>/dev/null || true

# Save token
echo "$TOKEN" > "$INSTALL_DIR/.token"

# Create wrapper script
cat > "$INSTALL_DIR/run.sh" << 'WRAPPER'
#!/bin/bash
cd "$HOME/.alfred-bridge"
TOKEN=$(cat .token)
python3 alfred-bridge.py --token "$TOKEN" >> "$HOME/.alfred-bridge/bridge.log" 2>&1
WRAPPER
chmod +x "$INSTALL_DIR/run.sh"

# Create LaunchAgent (auto-start on login)
cat > "$PLIST" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.alfred.bridge</string>
    <key>ProgramArguments</key>
    <array>
        <string>${INSTALL_DIR}/run.sh</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/bridge.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/bridge-error.log</string>
</dict>
</plist>
PLIST

# Start the service
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo ""
echo "✅ Alfred PC Bridge instalado!"
echo "   Se ejecuta automaticamente al iniciar tu Mac."
echo "   Token: $TOKEN"
echo "   Logs: $INSTALL_DIR/bridge.log"
echo ""
echo "   Para desinstalar: launchctl unload $PLIST && rm -rf $INSTALL_DIR"
