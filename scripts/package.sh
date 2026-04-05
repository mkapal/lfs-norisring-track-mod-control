rm -rf dist/bin && \
pkg -o "dist/bin/Norisring AI.exe" . && \
cp config.toml dist/bin/ && \
cd dist/bin && \
zip "Norisring AI $(date +%F).zip" *