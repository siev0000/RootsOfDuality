@echo off
setlocal

set output=output_webp
if not exist "%output%" mkdir "%output%"

for %%f in (*.png) do (
    echo Converting: %%f
    cwebp -lossless -alpha_q 100 "%%f" -o "%output%\%%~nf.webp"
)

echo Done.
pause
