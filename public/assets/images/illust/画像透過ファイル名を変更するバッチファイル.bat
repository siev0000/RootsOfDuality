@echo off
cd /d "D:\VScode\card-game\assets\images\illust"
for %%f in (*-removebg-preview.png) do (
    set "filename=%%~nf"
    setlocal enabledelayedexpansion
    set "newname=!filename:-removebg-preview=!"
    ren "%%f" "!newname!.png"
    endlocal
)
echo 完了しました
pause
