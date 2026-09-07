var readHosts = { id: 'read-hosts', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent' };

  var ps = [
    '$ErrorActionPreference = "Stop"',
    '$hostsFile = "C:\\Windows\\System32\\drivers\\etc\\hosts"',
    '',
    'if (-not (Test-Path $hostsFile)) {',
    '  Write-Output "ERROR=Archivo no encontrado"',
    '  return',
    '}',
    '',
    'try {',
    '  $content = Get-Content $hostsFile -Raw',
    '  Write-Output "CONTENT_START"',
    '  Write-Output $content',
    '  Write-Output "CONTENT_END"',
    '} catch {',
    '  Write-Output "ERROR=" + $_.Exception.Message',
    '}'
  ].join('\r\n');

  try {
    var raw = await exec(ps);
    var content = '';
    var lines = (raw || '').split('\n');
    var inContent = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === 'CONTENT_START') { inContent = true; continue; }
      if (line === 'CONTENT_END') { inContent = false; continue; }
      if (line.indexOf('ERROR=') === 0) {
        return { ok: false, error: line.substring(6), at: new Date().toISOString() };
      }
      if (inContent) content += line + '\n';
    }
    return {
      ok: true,
      content: content.trim(),
      at: new Date().toISOString()
    };
  } catch (e) {
    return { ok: false, error: e.message, at: new Date().toISOString() };
  }
} };
