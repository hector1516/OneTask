var screenshot = { id: 'screenshot', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible en el Agent', at: new Date().toISOString() };
  
  var methods = [
    // Method 1: .NET System.Drawing
    function() {
      return exec('powershell -NoProfile -Command "' + [
        'Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop',
        'Add-Type -AssemblyName System.Drawing -ErrorAction Stop',
        '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
        'if($b.Width-eq 0){throw "No screen"}',
        '$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height)',
        '$g=[System.Drawing.Graphics]::FromImage($bmp)',
        '$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)',
        '$ms=New-Object System.IO.MemoryStream',
        '$bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png)',
        '$r=[Convert]::ToBase64String($ms.ToArray())',
        '$g.Dispose();$bmp.Dispose();$ms.Dispose()',
        '$r'
      ].join(';').replace(/"/g, '\\"') + '"');
    },
    // Method 2: PowerShell screenshot via COM
    function() {
      return exec('powershell -NoProfile -Command "' + [
        'Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop',
        '$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
        '$bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height)',
        '$g=[System.Drawing.Graphics]::FromImage($bmp)',
        '$g.CopyFromScreen(0,0,0,0,$b.Size)',
        '$ms=New-Object System.IO.MemoryStream',
        '$bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Jpeg)',
        '$r=[Convert]::ToBase64String($ms.ToArray())',
        '$g.Dispose();$bmp.Dispose();$ms.Dispose()',
        '$r'
      ].join(';').replace(/"/g, '\\"') + '"');
    }
  ];
  
  for (var i = 0; i < methods.length; i++) {
    try {
      var raw = await methods[i]();
      var trimmed = (raw || '').trim();
      if (trimmed && trimmed.length > 100 && /^[A-Za-z0-9+\/]/.test(trimmed)) {
        var fmt = i === 1 ? 'jpeg' : 'png';
        return { ok: true, output: { format: fmt, base64: trimmed, width: null, height: null, method: i }, at: new Date().toISOString() };
      }
    } catch (e) { continue; }
  }
  return { ok: false, error: 'No se pudo capturar pantalla. Verifica que la PC tenga sesion activa con escritorio.', at: new Date().toISOString() };
} };
