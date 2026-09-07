var hostsManager = { id: 'hosts-manager', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var TARGET_IP = '192.168.1.65';
  var DOMAINS = ['rvm.vmware.com', 'nsa.gov'];

  var ps = [
    '$ErrorActionPreference = "Stop"',
    '$hostsFile = "C:\\Windows\\System32\\drivers\\etc\\hosts"',
    '',
    '# Ping test to detect local network',
    '$reachable = $false',
    'try { $reachable = Test-Connection -ComputerName ' + TARGET_IP + ' -Count 1 -Quiet -TimeoutSeconds 2 } catch {}',
    '',
    '# Read current hosts file',
    '$lines = @()',
    'if (Test-Path $hostsFile) { $lines = @(Get-Content $hostsFile) }',
    '',
    '# Remove old entries containing our domains',
    '$domains = @("' + DOMAINS.join('", "') + '")',
    '$cleaned = @()',
    'foreach ($line in $lines) {',
    '  $skip = $false',
    '  if ($line -match "OneTask") { $skip = $true }',
    '  foreach ($d in $domains) { if ($line -match [regex]::Escape($d)) { $skip = $true } }',
    '  if (-not $skip) { $cleaned += $line }',
    '}',
    '',
    '# Determine IP to use',
    '$ip = ' + TARGET_IP,
    'if (-not $reachable) {',
    '  try {',
    '    $r = Invoke-RestMethod -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5',
    '    if ($r.ip) { $ip = $r.ip } else { $ip = [string]$r }',
    '  } catch { try { $ip = (Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing -TimeoutSec 5).Content } catch {} }',
    '}',
    '',
    '# Build new entries',
    '$newEntries = @("", "# OneTask Auto")',
    'foreach ($d in $domains) { $newEntries += "$ip`t$d" }',
    '',
    '# Write back',
    '$final = $cleaned + $newEntries',
    'Set-Content -Path $hostsFile -Value $final -Force -Encoding ASCII',
    '',
    '# Output result',
    'Write-Output "REACHABLE=$reachable"',
    'Write-Output "IP=$ip"'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var lines = (raw || '').split('\n').map(function(l) { return l.trim(); });
    var reachable = false;
    var ip = TARGET_IP;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('REACHABLE=') === 0) reachable = lines[i].substring(10) === 'True';
      if (lines[i].indexOf('IP=') === 0 && lines[i].length > 3) ip = lines[i].substring(3);
    }
    return {
      ok: true,
      onLocalNetwork: reachable,
      ipUsed: ip,
      domains: DOMAINS,
      hostsFile: 'C:\\Windows\\System32\\drivers\\etc\\hosts',
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
