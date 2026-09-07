var testExec = { id: 'test-exec', version: '1.0.0', run: async function(params, ctx) {
  var results = {};
  var exec = ctx.exec;
  
  // Test 1: exec exists?
  results.hasExec = typeof exec === 'function';
  if (!exec) return { ok: false, error: 'exec no existe', results: results, at: new Date().toISOString() };
  
  // Test 2: simple echo
  try {
    var t2 = await exec('echo HELLO_TEST');
    results.echoTest = (t2 || '').trim();
    results.echoOk = results.echoTest === 'HELLO_TEST';
  } catch(e) { results.echoTest = 'ERROR: ' + e.message; results.echoOk = false; }
  
  // Test 3: PowerShell version
  try {
    var t3 = await exec('powershell -NoProfile -Command "Write-Output $PSVersionTable.PSVersion.Major"');
    results.powershellVersion = (t3 || '').trim();
  } catch(e) { results.powershellVersion = 'ERROR: ' + e.message; }
  
  // Test 4: PowerShell with $ variable
  try {
    var t4 = await exec('powershell -NoProfile -Command "$x = 1 + 2; Write-Output $x"');
    results.psVarTest = (t4 || '').trim();
    results.psVarOk = results.psVarTest === '3';
  } catch(e) { results.psVarTest = 'ERROR: ' + e.message; results.psVarOk = false; }
  
  // Test 5: System.Windows.Forms available?
  try {
    var t5 = await exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop; Write-Output FORMS_OK"');
    results.formsTest = (t5 || '').trim();
    results.formsOk = results.formsTest.indexOf('FORMS_OK') !== -1;
  } catch(e) { results.formsTest = 'ERROR: ' + e.message; results.formsOk = false; }
  
  // Test 6: Screen bounds
  try {
    var t6 = await exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms -ErrorAction Stop; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output ($b.Width.ToString() + \"x\" + $b.Height.ToString())"');
    results.screenBounds = (t6 || '').trim();
    results.screenOk = results.screenBounds.indexOf('x') !== -1 && results.screenBounds !== '0x0';
  } catch(e) { results.screenBounds = 'ERROR: ' + e.message; results.screenOk = false; }
  
  // Test 7: fetch (for GPS)
  try {
    var hasFetch = typeof fetch !== 'undefined';
    results.hasFetch = hasFetch;
    if (hasFetch) {
      var t7 = await fetch('https://ip-api.com/json/');
      results.fetchStatus = t7.status;
      results.fetchOk = t7.ok;
    }
  } catch(e) { results.fetchTest = 'ERROR: ' + e.message; results.fetchOk = false; }
  
  return { ok: true, output: results, at: new Date().toISOString() };
} };
