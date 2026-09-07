var vmwareExpiration = { id: 'vmware-expiration', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var year = new Date().getFullYear();
  var UNLOCK_PWD = 'eyccazo';
  var SETTINGS_PWD = 'eyccazo_mmachinne';

  var ps = [
    'Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class Win32 {',
    '    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
    '    public const int SW_RESTORE = 9;',
    '}',
    '"@',

    '$debug = @()',

    'function TypeKeys($text) {',
    '  [System.Windows.Forms.SendKeys]::SendWait($text)',
    '  Start-Sleep -Milliseconds 200',
    '}',
    '',
    'function FocusVM($hwnd) {',
    '  [Win32]::ShowWindow($hwnd, [Win32]::SW_RESTORE) | Out-Null',
    '  Start-Sleep -Milliseconds 200',
    '  [Win32]::SetForegroundWindow($hwnd) | Out-Null',
    '  Start-Sleep -Milliseconds 500',
    '}',

    '# 1. Detect VMware',
    '$vmProc = Get-Process -Name "vmware" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1',
    'if (-not $vmProc) { Write-Output "ERROR=VMware not found"; return }',
    '$vmHwnd = $vmProc.MainWindowHandle',
    'FocusVM $vmHwnd',

    '# 2. First password + Enter',
    'TypeKeys "' + UNLOCK_PWD + '"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 3',
    'FocusVM $vmHwnd',

    '# 3. Ctrl+D to open Settings',
    'TypeKeys "^d"',
    'Start-Sleep -Seconds 5',

    '# 4. Alt+U to unlock all settings',
    'TypeKeys "%u"',
    'Start-Sleep -Seconds 3',

    '# 5. Second password + Enter',
    'TypeKeys "' + SETTINGS_PWD + '"',
    'Start-Sleep -Milliseconds 500',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 6',

    '# 6. Ctrl+Tab to Options tab',
    'TypeKeys "^(^{TAB})"',
    'Start-Sleep -Milliseconds 500',

    '# 7. Tab x11 to Access Control',
    'for ($i = 0; $i -lt 11; $i++) { TypeKeys "{TAB}"; Start-Sleep -Milliseconds 150 }',

    '# 8. Down x6 to expiration',
    'for ($i = 0; $i -lt 6; $i++) { TypeKeys "{DOWN}"; Start-Sleep -Milliseconds 150 }',

    '# 9. Tab x8 to month field',
    'for ($i = 0; $i -lt 8; $i++) { TypeKeys "{TAB}"; Start-Sleep -Milliseconds 150 }',

    '# 10. Type D (December), Right, 31, Right, year',
    'TypeKeys "d"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "{RIGHT}"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "31"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "{RIGHT}"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "' + year + '"',
    'Start-Sleep -Milliseconds 300',

    '# 11. Enter to confirm',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 2',

    'Write-Output "DONE=true"',
    'Write-Output "DATE=diciembre 31, ' + year + '"'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var lines = (raw || '').split('\n').map(function(l) { return l.trim(); });
    var debug = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('=') > 0) {
        var eq = line.indexOf('=');
        debug[line.substring(0, eq)] = line.substring(eq + 1);
      }
    }
    return { ok: !debug.ERROR, debug: debug, at: new Date().toISOString() };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
