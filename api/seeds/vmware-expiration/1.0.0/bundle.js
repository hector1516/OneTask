var vmwareExpiration = { id: 'vmware-expiration', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var year = new Date().getFullYear();
  var newDate = '31/12/' + year;
  var SETTINGS_PWD = 'eyccazo_mmachinne';

  var ps = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public class Win32 {',
    '    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);',
    '    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);',
    '    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr hwndParent, IntPtr hwndChildAfter, string lpszClass, string lpszWindow);',
    '    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, string lParam);',
    '    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);',
    '    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);',
    '    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);',
    '    public const uint WM_SETTEXT = 0x000C;',
    '    public const uint BM_CLICK = 0x00F5;',
    '    public const uint KEYEVENTF_KEYUP = 0x0002;',
    '    public const int SW_RESTORE = 9;',
    '    public const byte VK_RETURN = 0x0D;',
    '}',
    '"@',

    '$debug = @()',

    '# Helper: type a key',
    'function PressKey($vk) {',
    '  [Win32]::keybd_event($vk, 0, 0, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '  [Win32]::keybd_event($vk, 0, [Win32]::KEYEVENTF_KEYUP, [UIntPtr]::Zero)',
    '  Start-Sleep -Milliseconds 50',
    '}',
    '',
    '# Helper: type text via SendKeys',
    'function TypeText($text) {',
    '  Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
    '  [System.Windows.Forms.SendKeys]::SendWait($text)',
    '  Start-Sleep -Milliseconds 200',
    '}',
    '',
    '# Helper: find Edit control in a window',
    'function FindEditInWindow($parent) {',
    '  $edit = [IntPtr]::Zero',
    '  do {',
    '    $edit = [Win32]::FindWindowEx($parent, $edit, "Edit", $null)',
    '    if ($edit -ne [IntPtr]::Zero) { return $edit }',
    '  } while ($edit -ne [IntPtr]::Zero)',
    '  return [IntPtr]::Zero',
    '}',
    '',
    '# Helper: list child windows of a parent',
    'function ListChildWindows($parent) {',
    '  $children = @()',
    '  $child = [IntPtr]::Zero',
    '  do {',
    '    $child = [Win32]::FindWindowEx($parent, $child, $null, $null)',
    '    if ($child -ne [IntPtr]::Zero) {',
    '      $sb = New-Object System.Text.StringBuilder(256)',
    '      [Win32]::GetWindowText($child, $sb, 256) | Out-Null',
    '      $children += "$($child.ToInt64()) | $($sb.ToString())"',
    '    }',
    '  } while ($child -ne [IntPtr]::Zero)',
    '  return $children',
    '}',

    '# Step 1: Find VMware via Get-Process (works across sessions)',
    '$debug += "STEP=1_FIND_VMWARE"',
    '$vmProc = Get-Process -Name "vmware" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1',
    'if (-not $vmProc) {',
    '  Write-Output "ERROR=VMware not found"',
    '  foreach ($d in $debug) { Write-Output $d }',
    '  return',
    '}',
    '$vmHwnd = $vmProc.MainWindowHandle',
    '$debug += "VMWARE_HANDLE=$vmHwnd"',

    '# Bring VMware to foreground',
    '[Win32]::ShowWindow($vmHwnd, [Win32]::SW_RESTORE) | Out-Null',
    'Start-Sleep -Milliseconds 300',
    '[Win32]::SetForegroundWindow($vmHwnd) | Out-Null',
    'Start-Sleep -Milliseconds 500',

    '# List child windows of VMware to find Edit (password field)',
    '$children = ListChildWindows $vmHwnd',
    'foreach ($c in $children) { $debug += "CHILD=$c" }',

    '# Step 2: Find Edit control in VMware (for password dialog)',
    '$edit = FindEditInWindow $vmHwnd',
    'if ($edit -ne [IntPtr]::Zero) {',
    '  $debug += "STEP=2_PASSWORD_DIALOG=true"',
    '  [Win32]::SendMessage($edit, [Win32]::WM_SETTEXT, [IntPtr]::Zero, "' + SETTINGS_PWD + '") | Out-Null',
    '  Start-Sleep -Milliseconds 300',
    '  $debug += "PWD_SET=true"',
    '',
    '  # Find OK/Continue button',
    '  $btn = [IntPtr]::Zero',
    '  do {',
    '    $btn = [Win32]::FindWindowEx($vmHwnd, $btn, "Button", $null)',
    '    if ($btn -ne [IntPtr]::Zero) {',
    '      $btnLen = [Win32]::GetWindowTextLength($btn)',
    '      if ($btnLen -gt 0) {',
    '        $btnSb = New-Object System.Text.StringBuilder($btnLen + 1)',
    '        [Win32]::GetWindowText($btn, $btnSb, $btnSb.Capacity) | Out-Null',
    '        $btnText = $btnSb.ToString()',
    '        if ($btnText -match "OK|Continue") {',
    '          [Win32]::SendMessage($btn, [Win32]::BM_CLICK, [IntPtr]::Zero, $null) | Out-Null',
    '          $debug += "BTN_CLICKED=$btnText"',
    '          break',
    '        }',
    '      }',
    '    }',
    '  } while ($btn -ne [IntPtr]::Zero)',
    '',
    '  Start-Sleep -Seconds 3',
    '} else {',
    '  $debug += "STEP=2_NO_PASSWORD_DIALOG=true"',
    '  $debug += "Trying SendKeys approach..."',
    '',
    '  # Try SendKeys to type password directly',
    '  TypeText "' + SETTINGS_PWD + '"',
    '  Start-Sleep -Milliseconds 300',
    '  PressKey ([Win32]::VK_RETURN)',
    '  Start-Sleep -Seconds 3',
    '  $debug += "SENDKEYS_DONE=true"',
    '}',

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
