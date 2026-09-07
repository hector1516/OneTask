var vmwareExpiration = { id: 'vmware-expiration', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var year = new Date().getFullYear();
  var newDate = '31/12/' + year;

  var ps = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class Win32 {',
    '    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);',
    '    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
    '    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);',
    '    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);',
    '    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);',
    '    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);',
    '    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);',
    '    public const byte VK_TAB = 0x09;',
    '    public const byte VK_RETURN = 0x0D;',
    '    public const byte VK_ESCAPE = 0x1B;',
    '    public const uint KEYEVENTF_KEYUP = 0x0002;',
    '    public const int SW_RESTORE = 9;',
    '}',
    '"@',

    '$ErrorActionPreference = "Continue"',
    '$debug = @()',

    '# Helper: type a key',
    'function PressKey($vk) {',
    '  [Win32]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '  [Win32]::keybd_event($vk, 0, [Win32]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '}',
    '',
    '# Helper: type a string using SendKeys',
    'function TypeString($text) {',
    '  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
    '  [System.Windows.Forms.SendKeys]::SendWait($text)',
    '  Start-Sleep -Milliseconds 200',
    '}',
    '',
    '# Helper: Alt+Key',
    'function AltKey($vk) {',
    '  [Win32]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)  # Alt down',
    '  Start-Sleep -Milliseconds 50',
    '  PressKey $vk',
    '  Start-Sleep -Milliseconds 50',
    '  [Win32]::keybd_event(0x12, 0, [Win32]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)  # Alt up',
    '  Start-Sleep -Milliseconds 100',
    '}',

    '# Find VMware process',
    '$vmwareProcs = Get-Process -Name "vmware" -ErrorAction SilentlyContinue',
    'if (-not $vmwareProcs) {',
    '  Write-Output "ERROR=VMware no esta abierto"',
    '  return',
    '}',
    '$debug += "VMWARE_FOUND=true"',

    '# Find VMware main window',
    '$mainWindow = [IntPtr]::Zero',
    '$callback = [Win32+EnumWindowsProc]{',
    '  param($hwnd, $lParam)',
    '  $len = [Win32]::GetWindowTextLength($hwnd)',
    '  if ($len -gt 0) {',
    '    $sb = New-Object System.Text.StringBuilder($len + 1)',
    '    [Win32]::GetWindowText($hwnd, $sb, $sb.Capacity) | Out-Null',
    '    $title = $sb.ToString()',
    '    if ($title -match "VMware") {',
    '      $script:mainWindow = $hwnd',
    '      return $false',
    '    }',
    '  }',
    '  return $true',
    '}',
    '[Win32]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null',

    'if ($mainWindow -eq [IntPtr]::Zero) {',
    '  Write-Output "ERROR=No se encontro ventana de VMware"',
    '  return',
    '}',
    '$debug += "WINDOW_FOUND=true"',

    '# Bring VMware to foreground',
    '[Win32]::ShowWindow($mainWindow, [Win32]::SW_RESTORE) | Out-Null',
    'Start-Sleep -Milliseconds 300',
    '[Win32]::SetForegroundWindow($mainWindow) | Out-Null',
    'Start-Sleep -Milliseconds 500',

    '# Get window title',
    '$sb = New-Object System.Text.StringBuilder(512)',
    '[Win32]::GetWindowText($mainWindow, $sb, 512) | Out-Null',
    '$title = $sb.ToString()',
    '$debug += "TITLE=" + $title',

    '# Step 1: Try to type password using SendKeys (works with custom UI)',
    '$debug += "STEP=TYPING_PASSWORD"',
    'TypeString "eyccazo"',
    'Start-Sleep -Milliseconds 300',
    'PressKey ([Win32]::VK_RETURN)',
    'Start-Sleep -Seconds 3',
    '$debug += "PASSWORD_SENT=true"',

    '# Step 2: Wait for VM to start',
    '$debug += "STEP=WAITING_FOR_VM"',
    'Start-Sleep -Seconds 2',

    '# Refresh window title',
    '[Win32]::GetWindowText($mainWindow, $sb, 512) | Out-Null',
    '$title = $sb.ToString()',
    '$debug += "TITLE_AFTER_PWD=" + $title',

    '# Step 3: Open VM Settings via keyboard',
    '$debug += "STEP=OPENING_SETTINGS"',
    '[Win32]::SetForegroundWindow($mainWindow) | Out-Null',
    'Start-Sleep -Milliseconds 300',

    '# Use keyboard shortcut: Ctrl+E opens Settings in VMware',
    '[Win32]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)  # Ctrl down',
    'Start-Sleep -Milliseconds 50',
    'PressKey 0x45  # E key',
    'Start-Sleep -Milliseconds 50',
    '[Win32]::keybd_event(0x11, 0, [Win32]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)  # Ctrl up',
    'Start-Sleep -Seconds 2',
    '$debug += "CTRL_E_SENT=true"',

    '# Step 4: Type settings password if dialog appears',
    '$debug += "STEP=TYPING_SETTINGS_PWD"',
    'TypeString "eyccazo_mmachinne"',
    'Start-Sleep -Milliseconds 300',
    'PressKey ([Win32]::VK_RETURN)',
    'Start-Sleep -Seconds 2',
    '$debug += "SETTINGS_PWD_SENT=true"',

    '# Output debug',
    'foreach ($d in $debug) { Write-Output $d }',
    'Write-Output "DATE_TO_SET=' + newDate + '"'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var lines = (raw || '').split('\n').map(function(l) { return l.trim(); });
    var debug = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('=') > 0) {
        var eq = line.indexOf('=');
        var key = line.substring(0, eq);
        var val = line.substring(eq + 1);
        debug[key] = val;
      }
    }
    return {
      ok: !debug.ERROR,
      newDate: newDate,
      debug: debug,
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
