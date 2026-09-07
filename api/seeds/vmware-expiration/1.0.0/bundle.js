var vmwareExpiration = { id: 'vmware-expiration', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var year = new Date().getFullYear();
  var newDate = '31/12/' + year;
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
    '    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);',
    '    public const uint KEYEVENTF_KEYUP = 0x0002;',
    '    public const int SW_RESTORE = 9;',
    '    public const byte VK_RETURN = 0x0D;',
    '    public const byte VK_TAB = 0x09;',
    '}',
    '"@',

    '$debug = @()',

    'function TypeKeys($text) {',
    '  [System.Windows.Forms.SendKeys]::SendWait($text)',
    '  Start-Sleep -Milliseconds 200',
    '}',
    '',
    'function PressKey($vk) {',
    '  [Win32]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '  [Win32]::keybd_event($vk, 0, [Win32]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '}',
    '',
    'function FocusVM($hwnd) {',
    '  [Win32]::ShowWindow($hwnd, [Win32]::SW_RESTORE) | Out-Null',
    '  Start-Sleep -Milliseconds 200',
    '  [Win32]::SetForegroundWindow($hwnd) | Out-Null',
    '  Start-Sleep -Milliseconds 500',
    '}',

    '# Step 1: Find VMware main window via Get-Process',
    '$debug += "STEP=1_FIND_VMWARE"',
    '$vmProc = Get-Process -Name "vmware" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1',
    'if (-not $vmProc) {',
    '  Write-Output "ERROR=VMware not found"',
    '  foreach ($d in $debug) { Write-Output $d }',
    '  return',
    '}',
    '$vmHwnd = $vmProc.MainWindowHandle',
    '$debug += "VMWARE_HANDLE=$vmHwnd"',
    'FocusVM $vmHwnd',

    '# Step 2: Send unlock password via SendKeys (works across sessions)',
    '$debug += "STEP=2_UNLOCK"',
    'TypeKeys "' + UNLOCK_PWD + '"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 3',
    'FocusVM $vmHwnd',
    '$debug += "UNLOCK_SENT=true"',

    '# Step 3: Open Settings with Ctrl+D (wait for it to open)',
    '$debug += "STEP=3_CTRL_D"',
    'TypeKeys "^d"',
    'Start-Sleep -Seconds 5',
    '$debug += "CTRL_D_SENT=true"',

    '# Step 4: Type settings password (SendKeys goes to whatever has focus)',
    '$debug += "STEP=4_SETTINGS_PWD"',
    'TypeKeys "' + SETTINGS_PWD + '"',
    'Start-Sleep -Milliseconds 500',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 3',
    '$debug += "SETTINGS_PWD_SENT=true"',

    '# Step 5: Navigate to Options tab (Tab 4 times then Right arrow)',
    '$debug += "STEP=5_OPTIONS_TAB"',
    'for ($i = 0; $i -lt 4; $i++) {',
    '  PressKey ([Win32]::VK_TAB)',
    '  Start-Sleep -Milliseconds 150',
    '}',
    'PressKey 0x27  # Right arrow',
    'Start-Sleep -Milliseconds 500',
    '$debug += "OPTIONS_TAB=true"',

    '# Step 6: Navigate to Access Control (down 8 times)',
    '$debug += "STEP=6_ACCESS_CONTROL"',
    'for ($i = 0; $i -lt 8; $i++) {',
    '  PressKey 0x28  # Down arrow',
    '  Start-Sleep -Milliseconds 100',
    '}',
    'Start-Sleep -Milliseconds 500',
    '$debug += "ACCESS_CONTROL=true"',

    '# Step 7: Navigate to expiration area (6 tabs)',
    '$debug += "STEP=7_EXPIRATION"',
    'for ($i = 0; $i -lt 6; $i++) {',
    '  PressKey ([Win32]::VK_TAB)',
    '  Start-Sleep -Milliseconds 150',
    '}',

    '# Toggle expiration checkbox',
    'TypeKeys "{SPACE}"',
    'Start-Sleep -Milliseconds 300',
    '$debug += "EXPIRATION_TOGGLED=true"',

    '# Tab to date field',
    'PressKey ([Win32]::VK_TAB)',
    'Start-Sleep -Milliseconds 200',

    '# Select all and type new date',
    'TypeKeys "^a"',
    'Start-Sleep -Milliseconds 200',
    'TypeKeys "' + newDate + '"',
    'Start-Sleep -Milliseconds 300',
    '$debug += "DATE_TYPED=true"',

    '# Click OK',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 2',
    '$debug += "OK_CLICKED=true"',

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
