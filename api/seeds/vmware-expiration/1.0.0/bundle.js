var vmwareExpiration = { id: 'vmware-expiration', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var year = new Date().getFullYear();
  var newDate = '31/12/' + year;
  var UNLOCK_PWD = 'eyccazo';
  var SETTINGS_PWD = 'eyccazo_mmachinne';

  var ps = [
    'Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
    'Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue',
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
    '',
    'function TakeScreenshot($tag) {',
    '  try {',
    '    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '    $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)',
    '    $gfx = [System.Drawing.Graphics]::FromImage($bmp)',
    '    $gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
    '    $ms = New-Object System.IO.MemoryStream',
    '    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)',
    '    $b64 = [Convert]::ToBase64String($ms.ToArray())',
    '    $gfx.Dispose(); $bmp.Dispose(); $ms.Dispose()',
    '    Write-Output "SCREENSHOT_${tag}=$b64"',
    '  } catch {',
    '    Write-Output "SCREENSHOT_${tag}=ERROR"',
    '  }',
    '}',

    '# Step 1: Find VMware',
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
    'TakeScreenshot "01_BEFORE_UNLOCK"',

    '# Step 2: Send unlock password',
    '$debug += "STEP=2_UNLOCK"',
    'TypeKeys "' + UNLOCK_PWD + '"',
    'Start-Sleep -Milliseconds 300',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 3',
    'FocusVM $vmHwnd',
    'TakeScreenshot "02_AFTER_UNLOCK"',

    '# Step 3: Open Settings with Ctrl+D',
    '$debug += "STEP=3_CTRL_D"',
    'TypeKeys "^d"',
    'Start-Sleep -Seconds 5',
    'TakeScreenshot "03_AFTER_CTRL_D"',

    '# Step 4: Tab to Unlock All Settings',
    '$debug += "STEP=4_UNLOCK_ALL"',
    'for ($i = 0; $i -lt 15; $i++) {',
    '  PressKey ([Win32]::VK_TAB)',
    '  Start-Sleep -Milliseconds 100',
    '}',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 3',
    'TakeScreenshot "04_AFTER_UNLOCK_ALL"',

    '# Step 5: Type settings password',
    '$debug += "STEP=5_SETTINGS_PWD"',
    'TypeKeys "' + SETTINGS_PWD + '"',
    'Start-Sleep -Milliseconds 500',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 6',
    'TakeScreenshot "05_AFTER_SETTINGS_PWD"',

    '# Step 6: Navigate to Options tab',
    '$debug += "STEP=6_OPTIONS_TAB"',
    'for ($i = 0; $i -lt 4; $i++) {',
    '  PressKey ([Win32]::VK_TAB)',
    '  Start-Sleep -Milliseconds 150',
    '}',
    'PressKey 0x27',
    'Start-Sleep -Milliseconds 500',
    'TakeScreenshot "06_OPTIONS_TAB"',

    '# Step 7: Navigate to Access Control',
    '$debug += "STEP=7_ACCESS_CONTROL"',
    'for ($i = 0; $i -lt 8; $i++) {',
    '  PressKey 0x28',
    '  Start-Sleep -Milliseconds 100',
    '}',
    'Start-Sleep -Milliseconds 500',
    'TakeScreenshot "07_ACCESS_CONTROL"',

    '# Step 8: Navigate to expiration area',
    '$debug += "STEP=8_EXPIRATION"',
    'for ($i = 0; $i -lt 6; $i++) {',
    '  PressKey ([Win32]::VK_TAB)',
    '  Start-Sleep -Milliseconds 150',
    '}',
    'TypeKeys "{SPACE}"',
    'Start-Sleep -Milliseconds 300',
    'PressKey ([Win32]::VK_TAB)',
    'Start-Sleep -Milliseconds 200',
    'TypeKeys "^a"',
    'Start-Sleep -Milliseconds 200',
    'TypeKeys "' + newDate + '"',
    'Start-Sleep -Milliseconds 300',
    '$debug += "DATE_TYPED=true"',

    '# Step 9: Click OK',
    'TypeKeys "{ENTER}"',
    'Start-Sleep -Seconds 2',
    'TakeScreenshot "09_FINAL"',
    '$debug += "OK_CLICKED=true"',

    'foreach ($d in $debug) { Write-Output $d }',
    'Write-Output "DATE_TO_SET=' + newDate + '"'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var lines = (raw || '').split('\n').map(function(l) { return l.trim(); });
    var debug = {};
    var screenshots = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('SCREENSHOT_') === 0) {
        var eq = line.indexOf('=');
        var key = line.substring(0, eq);
        var val = line.substring(eq + 1);
        screenshots[key] = val;
      } else if (line.indexOf('=') > 0) {
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
      screenshots: screenshots,
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
