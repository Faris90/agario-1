mode con lines=2000
for /l %%v in (0, 1,10000) do node .\src\index.js
pause