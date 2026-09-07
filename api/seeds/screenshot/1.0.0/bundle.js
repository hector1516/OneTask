var screenshot = { id: 'screenshot', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent', at: new Date().toISOString() };
  try {
    var ps = [
      'Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop',
      'Add-Type -AssemblyName System.Drawing -ErrorAction Stop',
      '$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
      '$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)',
      '$g = [System.Drawing.Graphics]::FromImage($bmp)',
      '$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)',
      '$ms = New-Object System.IO.MemoryStream',
      '$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)',
      '[Convert]::ToBase64String($ms.ToArray())'
    ].join('; ');
    var raw = await exec(ps);
    var trimmed = (raw || '').trim();
    if (!trimmed || trimmed.length < 100 || trimmed.indexOf('SCREENSHOT_FAIL') !== -1) {
      return { ok: false, error: 'No se pudo capturar pantalla', raw: trimmed.substring(0, 500), at: new Date().toISOString() };
    }
    return { ok: true, output: { format: 'png', base64: trimmed, width: null, height: null }, at: new Date().toISOString() };
  } catch (e) { return { ok: false, error: e.message, at: new Date().toISOString() }; }
} };
