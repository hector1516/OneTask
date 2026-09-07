var screenshot = { id: 'screenshot', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent', at: new Date().toISOString() };
  try {
    var ps = [
      'Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue',
      'Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue',
      'try {',
      '  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
      '  if ($bounds.Width -eq 0 -or $bounds.Height -eq 0) { Write-Error "Screen bounds zero"; exit 1 }',
      '  $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)',
      '  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
      '  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
      '  $ms = New-Object System.IO.MemoryStream',
      '  $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)',
      '  $b64 = [Convert]::ToBase64String($ms.ToArray())',
      '  $graphics.Dispose(); $bitmap.Dispose(); $ms.Dispose()',
      '  $b64',
      '} catch {',
      '  Write-Error ("SCREENSHOT_FAIL: " + $_.Exception.Message)',
      '  exit 1',
      '}'
    ].join(' ');
    var raw = await exec('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"');
    var trimmed = (raw || '').trim();
    if (!trimmed || trimmed.length < 100 || trimmed.indexOf('SCREENSHOT_FAIL') !== -1) {
      return { ok: false, error: 'No se pudo capturar pantalla', raw: trimmed.substring(0, 500), at: new Date().toISOString() };
    }
    return { ok: true, output: { format: 'png', base64: trimmed, width: null, height: null }, at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
