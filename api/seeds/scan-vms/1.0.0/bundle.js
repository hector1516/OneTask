var scanVms = { id: 'scan-vms', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var ps = [
    '$ErrorActionPreference = "Continue"',
    '',
    '# Get all available drives',
    '$drives = Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Used -ne $null } | Select-Object Name, Root, @{N="UsedGB";E={[math]::Round($_.Used/1GB,1)}}, @{N="FreeGB";E={[math]::Round($_.Free/1GB,1)}}',
    '$debug += "DRIVES=" + ($drives | ForEach-Object { $_.Root }) -join ","',
    '',
    '# VM file extensions to search',
    '$extensions = @("*.vmx", "*.vbox", "*.vhd", "*.vhdx", "*.ova", "*.ovf", "*.vmcx")',
    '',
    '# Search results',
    '$allVMs = @()',
    '',
    'foreach ($drive in $drives) {',
    '  $root = $drive.Root',
    '  foreach ($ext in $extensions) {',
    '    try {',
    '      $files = Get-ChildItem -Path $root -Filter $ext -Recurse -ErrorAction SilentlyContinue -Force | Select-Object FullName, Length, LastWriteTime',
    '      foreach ($f in $files) {',
    '        $vmType = "Unknown"',
    '        if ($ext -eq "*.vmx" -or $ext -eq "*.vmxf") { $vmType = "VMware" }',
    '        if ($ext -eq "*.vbox") { $vmType = "VirtualBox" }',
    '        if ($ext -eq "*.vhd" -or $ext -eq "*.vhdx") { $vmType = "Hyper-V" }',
    '        if ($ext -eq "*.ova" -or $ext -eq "*.ovf") { $vmType = "Export" }',
    '        if ($ext -eq "*.vmcx") { $vmType = "Hyper-V (New)" }',
    '        $allVMs += [PSCustomObject]@{',
    '          Type = $vmType',
    '          Path = $f.FullName',
    '          SizeMB = [math]::Round($f.Length / 1MB, 1)',
    '          Modified = $f.LastWriteTime.ToString("yyyy-MM-dd HH:mm")',
    '        }',
    '      }',
    '    } catch { }',
    '  }',
    '}',
    '',
    '# Output results',
    'Write-Output "TOTAL=" + $allVMs.Count',
    'foreach ($vm in $allVMs) {',
    '  Write-Output ("VM|" + $vm.Type + "|" + $vm.Path + "|" + $vm.SizeMB + "|" + $vm.Modified)',
    '}'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var lines = (raw || '').split('\n').map(function(l) { return l.trim(); });
    var vms = [];
    var total = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('TOTAL=') === 0) {
        total = parseInt(line.substring(6)) || 0;
      } else if (line.indexOf('VM|') === 0) {
        var parts = line.substring(3).split('|');
        vms.push({
          type: parts[0] || 'Unknown',
          path: parts[1] || '',
          sizeMB: parseFloat(parts[2]) || 0,
          modified: parts[3] || ''
        });
      }
    }
    return {
      ok: true,
      total: total,
      vms: vms,
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
