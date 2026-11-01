' 后台无窗口启动「自由发」并打开控制台。调试请改用 start.bat（保留控制台输出）。
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "cmd /c node server.js", 0, False
WScript.Sleep 2500
shell.Run "cmd /c start """" http://127.0.0.1:8917", 0, False
