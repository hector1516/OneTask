var hostsManager = { id: 'hosts-manager', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var TARGET_IP = '192.168.1.65';
  var DOMAINS = ['rvm.vmware.com', 'nsa.gov'];

  var ps = [
    '$ErrorActionPreference = "Continue"',
    '$hostsFile = "C:\\Windows\\System32\\drivers\\etc\\hosts"',
    '$debug = @()',
    '',
    '# Check if hosts file exists',
    '$debug += "HOSTS_EXISTS=" + (Test-Path $hostsFile)',
    '',
    '# Ping test to detect local network',
    '$reachable = $false',
    'try {',
    '  $ping = New-Object System.Net.NetworkInformation.Ping',
    '  $result = $ping.Send("' + TARGET_IP + '", 2000)',
    '  $reachable = ($result.Status -eq "Success")',
    '  $debug += "PING_OK=" + $reachable',
    '} catch {',
    '  $debug += "PING_ERROR=" + $_.Exception.Message',
    '}',
    '',
    '# Read current hosts file',
    '$lines = @()',
    'try {',
    '  $lines = @(Get-Content $hostsFile -ErrorAction Stop)',
    '  $debug += "READ_OK=true LINES=" + $lines.Count',
    '} catch {',
    '  $debug += "READ_ERROR=" + $_.Exception.Message',
    '}',
    '',
    '# Remove old entries containing our domains',
    '$domains = @("' + DOMAINS.join('", "') + '")',
    '$cleaned = @()',
    '$removed = 0',
    'foreach ($line in $lines) {',
    '  $skip = $false',
    '  if ($line -match "OneTask") { $skip = $true }',
    '  foreach ($d in $domains) { if ($line -match [regex]::Escape($d)) { $skip = $true } }',
    '  if ($skip) { $removed++ } else { $cleaned += $line }',
    '}',
    '$debug += "REMOVED=" + $removed',
    '',
    '# Determine IP to use',
    '$ip = ' + TARGET_IP,
    'if (-not $reachable) {',
    '  try {',
    '    $r = Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop',
    '    $ip = $r.Content.Trim()',
    '    $debug += "PUBLIC_IP=" + $ip',
    '  } catch {',
    '    $debug += "IP_ERROR=" + $_.Exception.Message',
    '  }',
    '}',
    '',
    '# Build new entries',
    '$newEntries = @("", "# OneTask Auto")',
    'foreach ($d in $domains) { $newEntries += "$ip`t$d" }',
    '',
    '# Write back',
    'try {',
    '  $final = $cleaned + $newEntries',
    '  Set-Content -Path $hostsFile -Value $final -Force -Encoding ASCII -ErrorAction Stop',
    '  $debug += "WRITE_OK=true"',
    '} catch {',
    '  $debug += "WRITE_ERROR=" + $_.Exception.Message',
    '}',
    '',
    '# Output debug',
    'foreach ($d in $debug) { Write-Output $d }'
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
      ok: debug.WRITE_ERROR ? false : true,
      onLocalNetwork: debug.PING_OK === 'True',
      ipUsed: debug.PUBLIC_IP || TARGET_IP,
      debug: debug,
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
