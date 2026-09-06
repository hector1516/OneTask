var screenshot = { id: 'screenshot', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible', at: new Date().toISOString() };
  try {
    var ps = [
      'Add-Type -AssemblyName System.Windows.Forms',
      'Add-Type -AssemblyName System.Drawing',
      '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
      '$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)',
      '$graphics = [System.Drawing.Graphics]::FromImage($bitmap)',
      '$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
      '$ms = New-Object System.IO.MemoryStream',
      '$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)',
      '[Convert]::ToBase64String($ms.ToArray())',
      '$graphics.Dispose()',
      '$bitmap.Dispose()',
      '$ms.Dispose()'
    ].join('; ');
    var b64 = await exec('powershell -Command "' + ps.replace(/"/g, '\\"') + '"');
    var trimmed = b64.trim();
    if (!trimmed || trimmed.length < 100) return { ok: false, error: 'No se pudo capturar pantalla', raw: trimmed, at: new Date().toISOString() };
    return { ok: true, output: { format: 'png', base64: trimmed, width: null, height: null }, at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
